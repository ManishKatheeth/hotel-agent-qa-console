import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { diffRuns, runEval } from "../src/lib/eval";
import { mockAgent } from "../src/lib/agent";
import { buildQueue } from "../src/lib/queue";
import type { Agent } from "../src/lib/types";

const useModel = process.argv.includes("--model");

async function main() {
  let agent: Agent = mockAgent;
  if (useModel) {
    const { modelAgent } = await import("../src/lib/model-agent");
    agent = modelAgent;
  }
  const live = await runEval("live", agent);
  const draft = await runEval("draft", agent);
  const diff = diffRuns(live, draft);
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

  for (const r of [live, draft]) {
    const m = r.metrics;
    console.log(
      `${r.kb.padEnd(5)} pass ${m.passed}/${m.total} (${pct(m.passRate)})  answer ${pct(m.answerAccuracy)}  unsafe-guess ${pct(m.unsafeGuessRate)}  wrong-fact ${pct(m.wrongFactRate)}  action ${pct(m.actionAccuracy)}`,
    );
  }
  console.log(`\nDraft vs live: ${diff.fixed.length} fixed, ${diff.regressed.length} regressed, ${diff.stillFailing.length} still failing, ${diff.stillPassing} still passing`);
  for (const f of diff.fixed) console.log(`  + fixed     ${f.id} ${f.utterance}`);
  for (const r of diff.regressed) console.log(`  - REGRESSED ${r.after.id} ${r.after.utterance} -> ${r.after.detail}`);
  console.log("\nMissed-question queue (live KB):");
  for (const q of buildQueue(live.cases)) console.log(`  ${q.count}x ${q.label}  [${q.suggestedKeywords.join(", ")}]`);

  writeFileSync(
    join(__dirname, "..", "evals", useModel ? "results.model.json" : "results.json"),
    JSON.stringify({ agent: useModel ? "model" : "mock", live, draft, diff }, null, 2) + "\n",
  );

  // Release gate: a draft KB must not regress any previously passing case.
  if (diff.regressed.length > 0) {
    console.error(`\nGATE FAILED: draft KB regresses ${diff.regressed.length} previously passing case(s).`);
    if (process.argv.includes("--gate")) process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
