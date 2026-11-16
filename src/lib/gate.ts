import type { Diff, ReplayItem, RunReport, SweepFinding } from "./types";

export interface GateInput {
  live: RunReport;
  draft: RunReport;
  diff: Diff;
  replay: ReplayItem[];
  sweep: SweepFinding[];
  /** ids a manager has confirmed: replay call ids, or `sweep:<entry>:<fact>` */
  approvals: Set<string>;
}

export interface GateResult {
  blocked: boolean;
  reasons: string[];
}

export const sweepId = (s: SweepFinding) => `sweep:${s.entryId}:${s.fact}`;

/**
 * Publish gate. Hard blocks (cannot be approved away): a consistent golden regression,
 * a rise in unsafe guesses, a fall in action accuracy. Soft blocks (a manager confirms
 * them): calls whose answer changed in a way the edit does not explain, and old values
 * still stated in another entry.
 */
export function evaluateGate(input: GateInput): GateResult {
  const { live, draft, diff, replay, sweep, approvals } = input;
  const reasons: string[] = [];

  if (diff.regressed.length) {
    reasons.push(`${diff.regressed.length} previously passing golden call(s) now fail: ${diff.regressed.map((r) => r.after.id).join(", ")}`);
  }
  if (draft.metrics.unsafeGuessRate > live.metrics.unsafeGuessRate) {
    const pct = (n: number) => `${Math.round(n * 100)}%`;
    reasons.push(`unsafe-guess rate rose ${pct(live.metrics.unsafeGuessRate)} -> ${pct(draft.metrics.unsafeGuessRate)}`);
  }
  if (draft.metrics.actionAccuracy < live.metrics.actionAccuracy) reasons.push("action accuracy fell");

  const pending = replay.filter((r) => r.kind === "needs_review" && !approvals.has(r.id));
  if (pending.length) reasons.push(`${pending.length} replayed call(s) need a manager's confirmation: ${pending.map((r) => r.id).join(", ")}`);

  const openSweep = sweep.filter((s) => !approvals.has(sweepId(s)));
  if (openSweep.length) reasons.push(`${openSweep.length} old value(s) still stated in another entry: ${openSweep.map(sweepId).join(", ")}`);

  return { blocked: reasons.length > 0, reasons };
}
