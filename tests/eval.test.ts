import { test } from "node:test";
import assert from "node:assert/strict";
import { diffRuns, goldenCases, runEval } from "../src/lib/eval";
import { buildQueue } from "../src/lib/queue";
import { mockAgent } from "../src/lib/agent";
import { live } from "../src/lib/kb";

test("golden set has all three categories and unique ids", () => {
  const ids = new Set(goldenCases.map((c) => c.id));
  assert.equal(ids.size, goldenCases.length);
  for (const cat of ["answer", "handoff", "action"]) {
    assert.ok(goldenCases.some((c) => c.category === cat), cat);
  }
});

test("agent hands off when nothing matches instead of guessing", () => {
  const r = mockAgent("Is there a laundromat nearby?", live.entries);
  assert.equal(r.outcome, "handoff");
});

test("agent extracts room numbers for work orders", () => {
  const r = mockAgent("The AC in room 412 isn't working.", live.entries);
  assert.equal(r.action?.room, "412");
  assert.equal(r.action?.dept, "maintenance");
});

test("live KB fails on stale price and hours facts", async () => {
  const live = await runEval("live");
  const failed = new Set(live.cases.filter((c) => !c.pass).map((c) => c.id));
  for (const id of ["a02", "a06", "a15"]) assert.ok(failed.has(id), id);
});

test("draft KB fixes stale facts but regresses previously passing cases", async () => {
  const diff = diffRuns(await runEval("live"), await runEval("draft"));
  const fixed = diff.fixed.map((c) => c.id);
  const regressed = diff.regressed.map((r) => r.after.id);
  assert.deepEqual(fixed.sort(), ["a06", "a15", "a19", "a20"]);
  assert.deepEqual(regressed.sort(), ["a03", "h11"]);
  // the late-checkout fee fix collides with the new late-arrival entry
  assert.ok(diff.stillFailing.some((c) => c.id === "a02"));
});

test("confident wrong answers are caught by the eval but invisible to the missed-question queue", async () => {
  const live = await runEval("live");
  const luggage = live.cases.find((c) => c.id === "h09")!;
  assert.equal(luggage.failure, "unsafe_guess");
  const queued = buildQueue(live.cases).flatMap((q) => q.utterances);
  assert.ok(!queued.includes(luggage.utterance));
});

test("missed-question queue clusters repeated themes", async () => {
  const live = await runEval("live");
  const laundry = buildQueue(live.cases).find((q) => q.key.startsWith("laund"));
  assert.equal(laundry?.count, 3);
});
