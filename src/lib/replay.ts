import { containsFact, factSet } from "./facts";
import type { Agent, AgentResult, Call, KbDiff, KbEntry, ReplayItem } from "./types";

/** Run `fn` over `items` with at most `limit` in flight, preserving order. */
export async function pmap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const sameAction = (a: AgentResult, b: AgentResult) =>
  a.action?.dept === b.action?.dept && a.action?.room === b.action?.room;

const same = (a: AgentResult, b: AgentResult) =>
  a.outcome === b.outcome && a.entryId === b.entryId && a.reply === b.reply && sameAction(a, b);

/**
 * Decide whether a call's change between live and draft is expected (the edit did
 * exactly what it says) or needs a manager to look. No expected answers are used:
 * the KB diff supplies what should have changed.
 */
export function classify(call: Call, live: AgentResult, draft: AgentResult, diff: KbDiff): ReplayItem {
  const base = { id: call.id, utterance: call.utterance, live, draft };
  const review = (reason: string): ReplayItem => ({ ...base, kind: "needs_review", reason });
  if (same(live, draft)) return { ...base, kind: "unchanged" };

  if (live.outcome !== draft.outcome) {
    if (live.outcome === "handoff") return review(`newly answered by "${draft.entryId ?? draft.action?.dept}" instead of a hand-off: confirm`);
    if (draft.outcome === "handoff") return review("now hands off; it used to answer");
    return review(`changed from ${live.outcome} to ${draft.outcome}`);
  }

  if (draft.outcome === "action") {
    return sameAction(live, draft) ? { ...base, kind: "unchanged" } : review("work order now has a different department or room");
  }
  if (draft.outcome === "handoff") return { ...base, kind: "unchanged" };

  if (live.entryId !== draft.entryId) {
    return review(`now answered by "${draft.entryId}" instead of "${live.entryId}"`);
  }

  const entry = diff.entries.find((e) => e.id === draft.entryId);
  if (!entry || entry.status === "unchanged") {
    return factSet(live.reply).size === factSet(draft.reply).size &&
      [...factSet(live.reply)].every((f) => factSet(draft.reply).has(f))
      ? { ...base, kind: "unchanged" }
      : review("wording changed and the facts differ although the entry did not");
  }

  const stale = entry.factsRemoved.filter((f) => factSet(draft.reply).has(f));
  if (stale.length) return review(`old value ${stale.join(", ")} still in the reply`);
  const missing = entry.factsAdded.filter((f) => !containsFact(draft.reply, f));
  if (missing.length) return review(`new value ${missing.join(", ")} missing from the reply`);
  return { ...base, kind: "expected_update", reason: `"${entry.id}" was edited and the reply reflects it` };
}

export async function replay(
  calls: Call[],
  diff: KbDiff,
  liveKb: KbEntry[],
  draftKb: KbEntry[],
  agent: Agent,
  concurrency = 4,
): Promise<ReplayItem[]> {
  return pmap(calls, concurrency, async (call) => {
    const [l, d] = await Promise.all([agent(call.utterance, liveKb), agent(call.utterance, draftKb)]);
    return classify(call, l, d, diff);
  });
}
