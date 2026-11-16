import { generateText } from "ai";
import { HANDOFF_REPLY } from "./agent";
import type { Agent, AgentResult, KbEntry } from "./types";

/**
 * Optional model-backed agent for `npm run eval:model`.
 * Needs AI_GATEWAY_API_KEY (Vercel AI Gateway). AGENT_MODEL is a "provider/model" string.
 * The same golden set and grader score it, so you can compare a model against the mock baseline.
 */
const MODEL = process.env.AGENT_MODEL ?? "anthropic/claude-haiku-5-5";
const TIMEOUT_MS = 30_000;

const SYSTEM = `You are a hotel front-desk agent. Use ONLY the knowledge base. Reply with one JSON object and nothing else:
{"outcome":"answer","entryId":"<id>","reply":"<answer from the KB>"}
{"outcome":"action","dept":"maintenance"|"housekeeping","room":"<digits or null>","reply":"<short confirmation, or ask 'Which room are you in?' if room is missing>"}
{"outcome":"handoff","reply":"I'm not certain about that, so I'll connect you with the front desk."}
Rules: never guess prices, hours or policy not in the KB; hand off refunds, complaints, accessibility, stay changes, and anything not covered. Broken items and requests for towels/pillows/cleaning are actions.`;

export const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };

const handoff = (): AgentResult => ({ outcome: "handoff", reason: "no_match", reply: HANDOFF_REPLY });

/** Pull the first JSON object out of a model reply, tolerating code fences and prose. */
export function parseModelReply(text: string, kb: KbEntry[]): AgentResult {
  try {
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    if (json.outcome === "answer") {
      // An answer must cite a real entry; an invented id is treated as a guess and handed off.
      if (!kb.some((e) => e.id === json.entryId)) return handoff();
      return { outcome: "answer", entryId: json.entryId, reply: String(json.reply) };
    }
    if (json.outcome === "action" && (json.dept === "maintenance" || json.dept === "housekeeping")) {
      const room = json.room ? String(json.room) : undefined;
      return {
        outcome: "action",
        action: { type: "create_work_order", dept: json.dept, room },
        reply: String(json.reply),
      };
    }
  } catch {
    // fall through: unparseable output is treated as a handoff, the safe default
  }
  return handoff();
}

export const modelAgent: Agent = async (utterance: string, kb: KbEntry[]): Promise<AgentResult> => {
  const kbText = kb.map((e) => `[${e.id}] ${e.answer}`).join("\n");
  try {
    const res = await generateText({
      model: MODEL,
      system: SYSTEM,
      prompt: `Knowledge base:\n${kbText}\n\nGuest: ${utterance}`,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    usage.calls += 1;
    usage.inputTokens += res.usage?.inputTokens ?? 0;
    usage.outputTokens += res.usage?.outputTokens ?? 0;
    return parseModelReply(res.text, kb);
  } catch (e) {
    // A timeout or gateway error must not look like a pass; surface it but stay safe.
    console.error(`model call failed: ${(e as Error).message}`);
    return handoff();
  }
};
