import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffRuns, runEvalVoted } from "../src/lib/eval";
import { mockAgent } from "../src/lib/agent";
import { buildQueue } from "../src/lib/queue";
import { derivedChecks, diffKb, staleSweep } from "../src/lib/kbdiff";
import { replay } from "../src/lib/replay";
import { evaluateGate, sweepId } from "../src/lib/gate";
import { kbVersions } from "../src/lib/kb";
import calls from "../evals/calls.json";
import type { Agent, Call } from "../src/lib/types";

const args = process.argv.slice(2);
const useModel = args.includes("--model");
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
// Models are non-deterministic, so they get 3 votes per case by default; the mock needs one.
const runs = Number(flag("--runs") ?? (useModel ? 3 : 1));
const evalsDir = join(__dirname, "..", "evals");

function loadApprovals(): Set<string> {
  const ids = new Set<string>((flag("--approve") ?? "").split(",").filter(Boolean));
  const file = join(evalsDir, "approvals.json");
  if (existsSync(file)) for (const id of JSON.parse(readFileSync(file, "utf8")) as string[]) ids.add(id);
  return ids;
}

async function main() {
  let agent: Agent = mockAgent;
  let modelUsage: { calls: number; inputTokens: number; outputTokens: number } | undefined;
  if (useModel) {
    if (!process.env.AI_GATEWAY_API_KEY) {
      console.error("eval:model needs AI_GATEWAY_API_KEY in the environment.");
      process.exit(2);
    }
    const m = await import("../src/lib/model-agent");
    agent = m.modelAgent;
    modelUsage = m.usage;
  }
  const live = await runEvalVoted("live", agent, runs);
  const draft = await runEvalVoted("draft", agent, runs);
  const diff = diffRuns(live, draft);
  const kbDiff = diffKb(kbVersions.live.entries, kbVersions.draft.entries);
  const sweep = staleSweep(kbDiff, kbVersions.draft.entries);
  const replayed = await replay(calls as Call[], kbDiff, kbVersions.live.entries, kbVersions.draft.entries, agent);
  const gate = evaluateGate({ live, draft, diff, replay: replayed, sweep, approvals: loadApprovals() });
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  console.log(`agent: ${useModel ? "model" : "mock"}, ${runs} run(s) per case\n`);
  for (const r of [live, draft]) {
    const m = r.metrics;
    console.log(
      `${r.kb.padEnd(5)} pass ${m.passed}/${m.total} (${pct(m.passRate)})  answer ${pct(m.answerAccuracy)}  unsafe-guess ${pct(m.unsafeGuessRate)}  wrong-fact ${pct(m.wrongFactRate)}  wrong-action ${pct(m.wrongActionRate)}  action ${pct(m.actionAccuracy)}`,
    );
  }
  console.log(`\nDraft vs live (golden set): ${diff.fixed.length} fixed, ${diff.regressed.length} regressed, ${diff.stillFailing.length} still failing, ${diff.stillPassing} still passing`);
  for (const f of diff.fixed) console.log(`  + fixed     ${f.id} ${f.utterance}`);
  for (const r of diff.regressed) console.log(`  - REGRESSED ${r.after.id} ${r.after.utterance} -> ${r.after.detail}`);
  const flaky = [...live.cases, ...draft.cases].filter((c) => c.flaky);
  if (flaky.length) console.log(`  ~ flaky (failed in some runs, not blocking): ${flaky.map((c) => c.id).join(", ")}`);

  const checks = derivedChecks(kbDiff);
  console.log(`\nChecks derived from the edit itself (no golden labels): ${checks.length}`);
  for (const c of checks) console.log(`  ${c.type === "forbid" ? "must not say" : "must say    "} ${c.fact}  [${c.entryId}]`);

  const by = (k: string) => replayed.filter((r) => r.kind === k);
  console.log(`\nReplay of ${replayed.length} unlabeled calls: ${by("unchanged").length} unchanged, ${by("expected_update").length} expected update, ${by("needs_review").length} need review`);
  for (const r of by("needs_review")) console.log(`  ? ${r.id} "${r.utterance}": ${r.reason}`);
  for (const s of sweep) console.log(`  ! ${sweepId(s)}: "${s.fact}" dropped from ${s.entryId} but "${s.foundIn}" still says it`);

  if (modelUsage) console.log(`\nModel usage: ${modelUsage.calls} calls, ${modelUsage.inputTokens} input / ${modelUsage.outputTokens} output tokens`);

  console.log("\nMissed-question queue (live KB):");
  for (const q of buildQueue(live.cases)) console.log(`  ${q.count}x ${q.label}  [${q.suggestedKeywords.join(", ")}]`);

  writeFileSync(
    join(evalsDir, useModel ? "results.model.json" : "results.json"),
    JSON.stringify({ agent: useModel ? "model" : "mock", model: useModel ? (process.env.AGENT_MODEL ?? "anthropic/claude-haiku-5-5") : undefined, runs, live, draft, diff, kbDiff, sweep, replay: replayed, gate }, null, 2) + "\n",
  );

  if (gate.blocked) {
    console.error(`\nPUBLISH BLOCKED:\n${gate.reasons.map((r) => `  - ${r}`).join("\n")}`);
    if (args.includes("--gate")) process.exit(1);
  } else {
    console.log("\nPublish check passed.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
