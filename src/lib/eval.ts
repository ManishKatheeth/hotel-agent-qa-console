import golden from "../../evals/golden.json";
import { kbVersions } from "./kb";
import { mockAgent } from "./agent";
import { grade } from "./grader";
import type { Agent, Category, CaseResult, Diff, GoldenCase, Metrics, RunReport } from "./types";

export const goldenCases = golden as GoldenCase[];

const rate = (n: number, d: number) => (d === 0 ? 0 : n / d);

export function computeMetrics(cases: CaseResult[]): Metrics {
  const cats: Category[] = ["answer", "handoff", "action"];
  const byCategory = Object.fromEntries(
    cats.map((c) => {
      const inCat = cases.filter((x) => x.category === c);
      return [c, { passed: inCat.filter((x) => x.pass).length, total: inCat.length }];
    }),
  ) as Metrics["byCategory"];
  const passed = cases.filter((c) => c.pass).length;
  return {
    total: cases.length,
    passed,
    passRate: rate(passed, cases.length),
    answerAccuracy: rate(byCategory.answer.passed, byCategory.answer.total),
    unsafeGuessRate: rate(byCategory.handoff.total - byCategory.handoff.passed, byCategory.handoff.total),
    wrongFactRate: rate(cases.filter((c) => c.failure === "wrong_fact").length, byCategory.answer.total),
    actionAccuracy: rate(byCategory.action.passed, byCategory.action.total),
    byCategory,
  };
}

export async function runEval(
  kbId: keyof typeof kbVersions,
  agent: Agent = mockAgent,
  cases: GoldenCase[] = goldenCases,
): Promise<RunReport> {
  const kb = kbVersions[kbId].entries;
  const results: CaseResult[] = [];
  for (const c of cases) results.push(grade(c, await agent(c.utterance, kb)));
  return { kb: kbId, metrics: computeMetrics(results), cases: results };
}

export function diffRuns(before: RunReport, after: RunReport): Diff {
  const prior = new Map(before.cases.map((c) => [c.id, c]));
  const diff: Diff = { fixed: [], regressed: [], stillFailing: [], stillPassing: 0 };
  for (const a of after.cases) {
    const b = prior.get(a.id);
    if (!b) continue;
    if (!b.pass && a.pass) diff.fixed.push(a);
    else if (b.pass && !a.pass) diff.regressed.push({ before: b, after: a });
    else if (!a.pass) diff.stillFailing.push(a);
    else diff.stillPassing += 1;
  }
  return diff;
}
