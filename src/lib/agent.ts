import type { AgentResult, Dept, KbEntry } from "./types";

/**
 * Deterministic stand-in for a hotel voice/ops agent. It is intentionally simple
 * (keyword retrieval, a confidence threshold, a few action rules) so the eval
 * harness, not the agent, is the product under test. Swap in model-agent.ts for a real model.
 */

const ACTION_RULES: { dept: Dept; re: RegExp }[] = [
  {
    dept: "maintenance",
    re: /\b(broken|not working|isn't working|isnt working|doesn't work|doesnt work|won't work|clogged|leak(ing)?|no hot water|is out|burned out|burnt out)\b/,
  },
  {
    dept: "housekeeping",
    re: /\b(towels?|pillows?|blankets?|toiletries|housekeeping|clean my room|trash)\b/,
  },
];

const ROOM_RE = /(?:room|rm|in|of)\s*#?(\d{3,4})\b/;

export const HANDOFF_REPLY = "I'm not certain about that, so I'll connect you with the front desk.";

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-/]/g, " ")
    .replace(/[^a-z0-9$\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(text: string, phrase: string): boolean {
  const re = new RegExp(`\\b${phrase}(s|ing|ed|er)?\\b`);
  return re.test(text);
}

export function retrieve(utterance: string, kb: KbEntry[]): { entry: KbEntry; score: number } | null {
  const text = normalize(utterance);
  let best: { entry: KbEntry; score: number } | null = null;
  for (const entry of kb) {
    let score = 0;
    for (const k of entry.keywords) {
      if (matches(text, k)) score += k.split(" ").length;
    }
    // Strictly greater: ties go to the entry listed first.
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

export const mockAgent = (utterance: string, kb: KbEntry[]): AgentResult => {
  const text = normalize(utterance);

  for (const rule of ACTION_RULES) {
    if (rule.re.test(text)) {
      const room = ROOM_RE.exec(text)?.[1];
      return {
        outcome: "action",
        action: { type: "create_work_order", dept: rule.dept, room },
        reply: room
          ? `Done. I've sent a ${rule.dept} request to room ${room}.`
          : `Happy to help with that. Which room are you in?`,
      };
    }
  }

  const hit = retrieve(utterance, kb);
  if (!hit) return { outcome: "handoff", reason: "no_match", reply: HANDOFF_REPLY };
  return { outcome: "answer", entryId: hit.entry.id, reply: hit.entry.answer };
};
