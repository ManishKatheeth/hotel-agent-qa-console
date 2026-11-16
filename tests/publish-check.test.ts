import { test } from "node:test";
import assert from "node:assert/strict";
import { derivedChecks, diffKb, staleSweep } from "../src/lib/kbdiff";
import { replay } from "../src/lib/replay";
import { mockAgent } from "../src/lib/agent";
import { computeMetrics, diffRuns, goldenCases, runEvalVoted } from "../src/lib/eval";
import { evaluateGate, sweepId } from "../src/lib/gate";
import type { Agent, AgentResult, CaseResult, Call, KbEntry, RunReport } from "../src/lib/types";

const kb = (): KbEntry[] => [
  { id: "parking", keywords: ["parking", "garage"], answer: "Parking is $32 per night." },
  { id: "pool", keywords: ["pool"], answer: "The pool is open 7:00 AM to 10:00 PM." },
  { id: "checkout", keywords: ["checkout", "late checkout"], answer: "Checkout is 11:00 AM. Late checkout is $25." },
];
const calls: Call[] = [
  { id: "c1", utterance: "How much is parking?" },
  { id: "c2", utterance: "When is the pool open?" },
  { id: "c3", utterance: "How much is late checkout?" },
];

test("a price edit yields derived checks without any golden labels", () => {
  const draft = kb();
  draft[0].answer = "Parking is $38 per night.";
  const checks = derivedChecks(diffKb(kb(), draft));
  assert.deepEqual(checks, [
    { entryId: "parking", type: "forbid", fact: "$32" },
    { entryId: "parking", type: "require", fact: "$38" },
  ]);
});

test("a dropped value that another entry still states is flagged", () => {
  const draft = kb();
  draft[0].answer = "Parking is $38 per night.";
  draft.push({ id: "package", keywords: ["package"], answer: "The stay-and-park package includes $32 parking." });
  const sweep = staleSweep(diffKb(kb(), draft), draft);
  assert.deepEqual(sweep, [{ entryId: "parking", fact: "$32", foundIn: "package" }]);
});

test("replay: an unchanged KB produces no review items", async () => {
  const diff = diffKb(kb(), kb());
  const items = await replay(calls, diff, kb(), kb(), mockAgent);
  assert.ok(items.every((i) => i.kind === "unchanged"));
});

test("replay: a pure price edit produces only expected updates", async () => {
  const draft = kb();
  draft[0].answer = "Parking is $38 per night.";
  const items = await replay(calls, diffKb(kb(), draft), kb(), draft, mockAgent);
  assert.deepEqual(items.map((i) => i.kind), ["expected_update", "unchanged", "unchanged"]);
});

test("replay: a new entry that outranks an old one is flagged as an entry switch", async () => {
  const draft = kb();
  draft.unshift({ id: "late-arrival", keywords: ["late"], answer: "The desk is staffed 24 hours." });
  // the "tidy-up": dropping the alias lets the broader keyword win on a tie
  draft.find((e) => e.id === "checkout")!.keywords = ["checkout"];
  const items = await replay(calls, diffKb(kb(), draft), kb(), draft, mockAgent);
  const c3 = items.find((i) => i.id === "c3")!;
  assert.equal(c3.kind, "needs_review");
  assert.match(c3.reason!, /late-arrival/);
});

test("replay: an old value left in a changed entry's reply needs review", async () => {
  const draft = kb();
  draft[0].answer = "Parking is $38 per night.";
  const model: Agent = (u, k) =>
    k[0].answer.includes("$38")
      ? { outcome: "answer", entryId: "parking", reply: "Parking is $38, was $32." }
      : mockAgent(u, k);
  const items = await replay([{ id: "c1", utterance: "how much is parking" }], diffKb(kb(), draft), kb(), draft, model);
  assert.equal(items[0].kind, "needs_review");
  assert.match(items[0].reason!, /\$32/);
});

// --- gate and voting ---------------------------------------------------------

const result: AgentResult = { outcome: "handoff", reply: "" };
const mk = (id: string, category: CaseResult["category"], pass: boolean, failure?: CaseResult["failure"]): CaseResult => ({
  id, utterance: id, category, pass, failure, result,
});
const report = (cases: CaseResult[]): RunReport => ({ kb: "live", metrics: computeMetrics(cases), cases });

test("gate: a rise in unsafe guesses blocks even with zero regressions", () => {
  const live = report([mk("h1", "handoff", true), mk("h2", "handoff", true)]);
  const draft = report([mk("h1", "handoff", true), mk("h2", "handoff", false, "unsafe_guess")]);
  const gate = evaluateGate({ live, draft, diff: diffRuns(live, draft), replay: [], sweep: [], approvals: new Set() });
  // h2 passed before, so this is also a regression; assert the guardrail reason is present on its own
  assert.ok(gate.reasons.some((r) => r.startsWith("unsafe-guess rate rose")));

  const live2 = report([mk("h1", "handoff", true), mk("h2", "handoff", false, "unsafe_guess")]);
  const draft2 = report([mk("h1", "handoff", false, "unsafe_guess"), mk("h2", "handoff", true)]);
  const noRise = evaluateGate({ live: live2, draft: draft2, diff: diffRuns(live2, draft2), replay: [], sweep: [], approvals: new Set() });
  assert.ok(!noRise.reasons.some((r) => r.startsWith("unsafe-guess rate rose")));
});

test("gate: unreviewed replay items block, approvals unblock, regressions cannot be approved away", () => {
  const live = report([mk("a", "answer", true)]);
  const same = report([mk("a", "answer", true)]);
  const item = { id: "c9", utterance: "x", kind: "needs_review" as const, reason: "r", live: result, draft: result };
  const sweep = [{ entryId: "parking", fact: "$32", foundIn: "package" }];
  const base = { live, draft: same, diff: diffRuns(live, same), replay: [item], sweep };

  assert.ok(evaluateGate({ ...base, approvals: new Set() }).blocked);
  assert.ok(!evaluateGate({ ...base, approvals: new Set(["c9", sweepId(sweep[0])]) }).blocked);

  const broken = report([mk("a", "answer", false, "wrong_fact")]);
  const hard = evaluateGate({ live, draft: broken, diff: diffRuns(live, broken), replay: [], sweep: [], approvals: new Set(["a"]) });
  assert.ok(hard.blocked);
});

test("voting: a 1-of-3 failure is flaky and does not count as a failure", async () => {
  const seen = new Map<string, number>();
  const flaky: Agent = (u, k) => {
    const n = (seen.get(u) ?? 0) + 1;
    seen.set(u, n);
    return n === 1 ? { outcome: "answer", entryId: "x", reply: "wrong" } : mockAgent(u, k);
  };
  const cases = goldenCases.filter((c) => c.id === "a01");
  const r = await runEvalVoted("live", flaky, 3, cases);
  assert.equal(r.cases[0].pass, true);
  assert.equal(r.cases[0].flaky, true);
  assert.equal(r.cases[0].failures, 1);
});

test("voting: a 2-of-3 failure counts as failed", async () => {
  const seen = new Map<string, number>();
  const mostlyWrong: Agent = (u, k) => {
    const n = (seen.get(u) ?? 0) + 1;
    seen.set(u, n);
    return n <= 2 ? { outcome: "answer", entryId: "x", reply: "wrong" } : mockAgent(u, k);
  };
  const cases = goldenCases.filter((c) => c.id === "a01");
  const r = await runEvalVoted("live", mostlyWrong, 3, cases);
  assert.equal(r.cases[0].pass, false);
  assert.ok(!r.cases[0].flaky);
});

test("unsafe-guess rate excludes wrong work orders", () => {
  const m = computeMetrics([mk("h1", "handoff", false, "wrong_action"), mk("h2", "handoff", true)]);
  assert.equal(m.unsafeGuessRate, 0);
  assert.equal(m.wrongActionRate, 0.5);
});
