import { extractFacts } from "./facts";
import type { DerivedCheck, EntryDiff, KbDiff, KbEntry, SweepFinding } from "./types";

const facts = (answer: string) => new Set(extractFacts(answer).map((f) => f.value));
const minus = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));

/**
 * Compare two knowledge bases entry by entry. This is what lets the publish check
 * run without a hand-written golden answer for every price change: the edit itself
 * says which values left (now forbidden) and which entered (now required).
 */
export function diffKb(live: KbEntry[], draft: KbEntry[]): KbDiff {
  const before = new Map(live.map((e) => [e.id, e]));
  const after = new Map(draft.map((e) => [e.id, e]));
  const entries: EntryDiff[] = [];

  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const a = before.get(id);
    const b = after.get(id);
    const fa = facts(a?.answer ?? "");
    const fb = facts(b?.answer ?? "");
    const ka = new Set(a?.keywords ?? []);
    const kb = new Set(b?.keywords ?? []);
    const keywordsAdded = minus(kb, ka);
    const keywordsRemoved = minus(ka, kb);
    const status: EntryDiff["status"] = !a
      ? "added"
      : !b
        ? "removed"
        : a.answer !== b.answer || keywordsAdded.length || keywordsRemoved.length
          ? "changed"
          : "unchanged";
    entries.push({ id, status, keywordsAdded, keywordsRemoved, factsRemoved: minus(fa, fb), factsAdded: minus(fb, fa) });
  }
  return { entries };
}

/** Old values must not appear in answers from the entry; new values must. */
export function derivedChecks(diff: KbDiff): DerivedCheck[] {
  return diff.entries.flatMap((e) => [
    ...e.factsRemoved.map((fact) => ({ entryId: e.id, type: "forbid" as const, fact })),
    ...e.factsAdded.map((fact) => ({ entryId: e.id, type: "require" as const, fact })),
  ]);
}

/**
 * Stale-value sweep: a value an entry dropped that another draft entry still states.
 * Often a leftover (the old parking rate in a packages entry); occasionally legitimate
 * (an unrelated $25 fee), so the manager confirms rather than the tool deciding.
 */
export function staleSweep(diff: KbDiff, draft: KbEntry[]): SweepFinding[] {
  const out: SweepFinding[] = [];
  for (const e of diff.entries) {
    for (const fact of e.factsRemoved) {
      for (const other of draft) {
        if (other.id !== e.id && facts(other.answer).has(fact)) out.push({ entryId: e.id, fact, foundIn: other.id });
      }
    }
  }
  return out;
}
