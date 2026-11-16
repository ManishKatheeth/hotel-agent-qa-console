import type { CaseResult, QueueItem } from "./types";
import { normalize } from "./agent";

const STOP = new Set(
  "the and for you your can could would have has had are was were this that with night nights last two next what when where how much any there their them from about into over under please need want like get got just does did our out not but all yes hotel room stay nearby offer provide".split(" "),
);

const tokens = (s: string) => normalize(s).split(" ").filter((t) => t.length >= 3 && !STOP.has(t));
// Crude stem so "charge/charger/chargers" and "laundry/laundromat" land in one theme.
// A production version would cluster on embeddings; this keeps the demo dependency-free.
const stem = (t: string) => t.replace(/s$/, "").slice(0, 5);

/**
 * Cluster calls the agent could not match into themes for the manager to answer.
 * Deliberately never drafts an answer: the agent must not invent hotel policy.
 */
export function buildQueue(cases: CaseResult[]): QueueItem[] {
  const missed = cases.filter((c) => c.result.outcome === "handoff" && c.result.reason === "no_match");
  const freq = new Map<string, number>();
  for (const m of missed) for (const t of new Set(tokens(m.utterance).map(stem))) freq.set(t, (freq.get(t) ?? 0) + 1);

  const groups = new Map<string, string[]>();
  const words = new Map<string, string[]>();
  for (const m of missed) {
    const ts = tokens(m.utterance).map(stem);
    if (ts.length === 0) continue;
    const key = [...ts].sort((a, b) => (freq.get(b)! - freq.get(a)!) || b.length - a.length || a.localeCompare(b))[0];
    groups.set(key, [...(groups.get(key) ?? []), m.utterance]);
    for (const t of tokens(m.utterance)) if (stem(t) === key) words.set(key, [...(words.get(key) ?? []), t]);
  }

  return [...groups.entries()]
    .map(([key, utterances]) => {
      const local = new Map<string, number>();
      for (const u of utterances) for (const t of new Set(tokens(u).map(stem))) local.set(t, (local.get(t) ?? 0) + 1);
      const seen = words.get(key) ?? [key];
      const label = [...new Set(seen)].sort((a, b) => seen.filter((x) => x === b).length - seen.filter((x) => x === a).length || a.length - b.length)[0];
      const suggestedKeywords = [...local.entries()]
        .filter(([t, n]) => t === key || n >= 2)
        .map(([t]) => (t === key ? label : t));
      return { key, label, count: utterances.length, utterances, suggestedKeywords, status: "needs_manager_answer" as const };
    })
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
