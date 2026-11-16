import { test } from "node:test";
import assert from "node:assert/strict";
import { canonical, containsFact, extractFacts } from "../src/lib/facts";
import { parseModelReply } from "../src/lib/model-agent";

test("equivalent spellings of a fact canonicalize to the same value", () => {
  const same: string[][] = [
    ["$40", "40 dollars", "$40.00", "40 bucks"],
    ["midnight", "12 AM", "12:00 a.m."],
    ["1:00 pm", "1 PM", "1:00 P.M."],
    ["48 hours", "48 hrs", "48 Hours"],
  ];
  for (const group of same) {
    const set = new Set(group.map(canonical));
    assert.equal(set.size, 1, group.join(" | "));
  }
});

test("different values never collapse", () => {
  assert.notEqual(canonical("$25"), canonical("$250"));
  assert.notEqual(canonical("11:00 pm"), canonical("midnight"));
  assert.notEqual(canonical("30 minutes"), canonical("30 hours"));
});

test("containsFact matches typed facts by value and others by substring", () => {
  assert.ok(containsFact("Late checkout is forty... 40 dollars.", "$40"));
  assert.ok(containsFact("The shuttle runs until 12 AM.", "midnight"));
  assert.ok(!containsFact("Late checkout is $250.", "$25"));
  assert.ok(containsFact("Breakfast is 6:30 to 9:30 AM", "6:30"));
  assert.ok(containsFact("Oversized vehicles do NOT fit", "do not fit"));
});

test("extractFacts finds prices, times and quantities in order", () => {
  const values = extractFacts("Open 5:00 AM to midnight, $0.30 per kWh, every 30 minutes").map((f) => f.value);
  assert.deepEqual(values, ["5:00 am", "midnight", "$0.30", "30 minutes"]);
});

test("model replies: fences are tolerated, invented entry ids and junk become hand-offs", () => {
  const kb = [{ id: "parking", keywords: ["parking"], answer: "Parking is $38." }];
  const ok = parseModelReply('```json\n{"outcome":"answer","entryId":"parking","reply":"Parking is $38."}\n```', kb);
  assert.equal(ok.outcome, "answer");
  assert.equal(parseModelReply('{"outcome":"answer","entryId":"nope","reply":"x"}', kb).outcome, "handoff");
  assert.equal(parseModelReply("sure, happy to help!", kb).outcome, "handoff");
});
