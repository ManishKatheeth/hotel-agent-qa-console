/**
 * Fact extraction and normalization. A "fact" is a checkable value in an answer:
 * a price, a clock time or a quantity. Comparing canonical forms means "$40",
 * "40 dollars" and "$40.00" are the same fact, and "12 AM" equals "midnight".
 */

export type FactKind = "money" | "time" | "qty";
export interface Fact {
  kind: FactKind;
  /** canonical form, e.g. "$40", "1:00 pm", "midnight", "48 hours" */
  value: string;
  start: number;
  end: number;
}

const MONEY = /\$\s?(\d+(?:\.\d+)?)|\b(\d+(?:\.\d+)?)\s*(?:dollars?|bucks)\b/gi;
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\b\.?|\b(midnight|noon)\b/gi;
const QTY = /\b(\d+)\s*(hours?|hrs?|minutes?|mins?|lbs?|pounds?)\b/gi;

function money(n: string): string {
  const v = Number(n);
  return Number.isInteger(v) ? "$" + v : "$" + v.toFixed(2);
}

function time(h: string, m: string | undefined, ap: string): string {
  const hour = Number(h);
  const min = m ?? "00";
  const p = ap.toLowerCase() === "a" ? "am" : "pm";
  if (hour === 12 && min === "00") return p === "am" ? "midnight" : "noon";
  return `${hour}:${min} ${p}`;
}

function unit(u: string): string {
  const x = u.toLowerCase();
  if (x.startsWith("h")) return "hours";
  if (x.startsWith("m")) return "minutes";
  return "lbs";
}

/** All checkable facts in `text`, in order of appearance. */
export function extractFacts(text: string): Fact[] {
  const out: Fact[] = [];
  for (const m of text.matchAll(MONEY)) {
    out.push({ kind: "money", value: money(m[1] ?? m[2]), start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(TIME)) {
    const value = m[4] ? m[4].toLowerCase() : time(m[1], m[2], m[3]);
    out.push({ kind: "time", value, start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(QTY)) {
    out.push({ kind: "qty", value: `${Number(m[1])} ${unit(m[2])}`, start: m.index!, end: m.index! + m[0].length });
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * If `fact` is exactly one typed fact ("$40", "12 AM", "48 hours") return it,
 * otherwise null and callers fall back to a plain case-insensitive substring.
 */
export function typedFact(fact: string): Fact | null {
  const t = fact.trim();
  const xs = extractFacts(t);
  return xs.length === 1 && xs[0].start === 0 && xs[0].end === t.length ? xs[0] : null;
}

export function canonical(fact: string): string {
  return typedFact(fact)?.value ?? fact.trim().toLowerCase();
}

export function containsFact(reply: string, fact: string): boolean {
  const typed = typedFact(fact);
  if (typed) return extractFacts(reply).some((f) => f.kind === typed.kind && f.value === typed.value);
  return reply.toLowerCase().includes(fact.trim().toLowerCase());
}

/** Canonical facts as a set of strings, for diffing two answers. */
export function factSet(text: string): Set<string> {
  return new Set(extractFacts(text).map((f) => f.value));
}
