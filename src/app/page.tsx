import Link from "next/link";
import { diffRuns, runEval } from "../lib/eval";
import { kbVersions } from "../lib/kb";
import { buildQueue } from "../lib/queue";
import type { CaseResult, Category, FailureType, Metrics } from "../lib/types";

const pct = (n: number) => `${Math.round(n * 100)}%`;

const FAILURE_LABEL: Record<FailureType, string> = {
  unsafe_guess: "Unsafe guess",
  wrong_fact: "Wrong or stale fact",
  missed_answer: "Missed answer",
  wrong_action: "Wrong action",
};

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4">
      <div className="muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${tone ?? ""}`}>{value}</div>
      <div className="muted mt-1 text-xs">{hint}</div>
    </div>
  );
}

function CategoryBars({ m }: { m: Metrics }) {
  const rows: { cat: Category; label: string }[] = [
    { cat: "answer", label: "Answer from KB" },
    { cat: "handoff", label: "Hand off when unsure" },
    { cat: "action", label: "Create work order" },
  ];
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold">Pass rate by call type</h2>
      <div className="mt-3 space-y-3">
        {rows.map(({ cat, label }) => {
          const { passed, total } = m.byCategory[cat];
          return (
            <div key={cat}>
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="muted">
                  {passed}/{total}
                </span>
              </div>
              <div className="mt-1 h-2 rounded" style={{ background: "var(--line)" }}>
                <div className="h-2 rounded" style={{ width: pct(passed / total), background: "var(--accent)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CaseRow({ c }: { c: CaseResult }) {
  return (
    <tr className="border-t" style={{ borderColor: "var(--line)" }}>
      <td className="py-2 pr-3 align-top text-xs muted">{c.id}</td>
      <td className="py-2 pr-3 align-top text-sm">{c.utterance}</td>
      <td className="py-2 pr-3 align-top text-sm">{c.failure ? FAILURE_LABEL[c.failure] : "Pass"}</td>
      <td className="py-2 align-top text-sm muted">{c.detail}</td>
    </tr>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ kb?: string }> }) {
  const { kb } = await searchParams;
  const kbId = kb === "draft" ? "draft" : "live";
  const [live, draft] = await Promise.all([runEval("live"), runEval("draft")]);
  const current = kbId === "draft" ? draft : live;
  const diff = diffRuns(live, draft);
  const queue = buildQueue(current.cases);
  const failures = current.cases.filter((c) => !c.pass);
  const m = current.metrics;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <p className="muted text-xs uppercase tracking-wide">Independent case study · synthetic data · not affiliated with any company</p>
        <h1 className="mt-1 text-2xl font-semibold">Agent QA Console</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          A report card for a hotel front-desk AI agent: run a golden set of calls against the knowledge base a
          manager is about to publish, and see what got fixed, what broke, and what the agent is guessing at.
        </p>
      </header>

      <nav className="mt-6 flex gap-2 text-sm" aria-label="Knowledge base version">
        {(["live", "draft"] as const).map((id) => (
          <Link
            key={id}
            href={id === "live" ? "/" : "/?kb=draft"}
            className="card px-3 py-1.5"
            style={id === kbId ? { borderColor: "var(--accent)", fontWeight: 600 } : undefined}
            aria-current={id === kbId ? "page" : undefined}
          >
            {kbVersions[id].label}
          </Link>
        ))}
      </nav>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pass rate" value={pct(m.passRate)} hint={`${m.passed} of ${m.total} golden calls`} />
        <Stat
          label="Answer accuracy"
          value={pct(m.answerAccuracy)}
          hint="Questions the KB covers, answered with the right facts"
          tone={m.answerAccuracy < 0.9 ? "bad" : "good"}
        />
        <Stat
          label="Unsafe guess rate"
          value={pct(m.unsafeGuessRate)}
          hint="Calls that should reach a person but got an answer or work order"
          tone={m.unsafeGuessRate > 0 ? "bad" : "good"}
        />
        <Stat
          label="Wrong-fact rate"
          value={pct(m.wrongFactRate)}
          hint="Answers with a stale or missing fact"
          tone={m.wrongFactRate > 0 ? "bad" : "good"}
        />
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-2">
        <CategoryBars m={m} />
        <div className="card p-4">
          <h2 className="text-sm font-semibold">Draft changes under review</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {kbVersions.draft.changelog.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card mt-6 p-4" aria-labelledby="diff">
        <h2 id="diff" className="text-lg font-semibold">
          Publish check: draft vs live
        </h2>
        <p className="mt-1 text-sm">
          <span className="good font-semibold">{diff.fixed.length} fixed</span> ·{" "}
          <span className="bad font-semibold">{diff.regressed.length} regressed</span> ·{" "}
          <span className="warn font-semibold">{diff.stillFailing.length} still failing</span> · {diff.stillPassing} unchanged
        </p>
        {diff.regressed.length > 0 && (
          <p className="bad mt-2 text-sm font-medium">
            Publish blocked: the draft breaks {diff.regressed.length} call{diff.regressed.length > 1 ? "s" : ""} that passed before.
          </p>
        )}
        <table className="mt-3 w-full text-left">
          <thead>
            <tr className="muted text-xs uppercase">
              <th className="pr-3 pb-1">Case</th>
              <th className="pr-3 pb-1">Guest says</th>
              <th className="pr-3 pb-1">Change</th>
              <th className="pb-1">Why</th>
            </tr>
          </thead>
          <tbody>
            {diff.regressed.map(({ after }) => (
              <tr key={after.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-2 pr-3 text-xs muted">{after.id}</td>
                <td className="py-2 pr-3 text-sm">{after.utterance}</td>
                <td className="bad py-2 pr-3 text-sm font-medium">Regressed</td>
                <td className="py-2 text-sm muted">{after.detail}</td>
              </tr>
            ))}
            {diff.fixed.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-2 pr-3 text-xs muted">{c.id}</td>
                <td className="py-2 pr-3 text-sm">{c.utterance}</td>
                <td className="good py-2 pr-3 text-sm font-medium">Fixed</td>
                <td className="py-2 text-sm muted">Now answers with the updated fact</td>
              </tr>
            ))}
            {diff.stillFailing.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-2 pr-3 text-xs muted">{c.id}</td>
                <td className="py-2 pr-3 text-sm">{c.utterance}</td>
                <td className="warn py-2 pr-3 text-sm font-medium">Still failing</td>
                <td className="py-2 text-sm muted">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card mt-6 p-4" aria-labelledby="fails">
        <h2 id="fails" className="text-lg font-semibold">
          Failures on {kbVersions[kbId].label}
        </h2>
        <p className="muted text-sm">
          Confident wrong answers do not show up in the missed-question queue, because the agent never admitted it
          was unsure. Only a golden set catches them.
        </p>
        <table className="mt-3 w-full text-left">
          <thead>
            <tr className="muted text-xs uppercase">
              <th className="pr-3 pb-1">Case</th>
              <th className="pr-3 pb-1">Guest says</th>
              <th className="pr-3 pb-1">Failure</th>
              <th className="pb-1">Detail</th>
            </tr>
          </thead>
          <tbody>
            {failures.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-sm">
                  No failures.
                </td>
              </tr>
            ) : (
              failures.map((c) => <CaseRow key={c.id} c={c} />)
            )}
          </tbody>
        </table>
      </section>

      <section className="card mt-6 p-4" aria-labelledby="queue">
        <h2 id="queue" className="text-lg font-semibold">
          Missed-question queue
        </h2>
        <p className="muted text-sm">
          Calls the agent handed off because nothing matched, grouped by theme. The console proposes keywords only; a
          manager supplies the answer, since the agent must never invent hotel policy.
        </p>
        <ul className="mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
          {queue.map((q) => (
            <li key={q.key} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium capitalize">{q.label}</span>
                <span className="muted text-xs">
                  {q.count} call{q.count > 1 ? "s" : ""} · keywords: {q.suggestedKeywords.join(", ")} · needs manager answer
                </span>
              </div>
              <ul className="muted mt-1 list-disc pl-5 text-sm">
                {q.utterances.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <footer className="muted mt-8 text-xs">
        Agent: deterministic mock (run <code>npm run eval:model</code> to score a real model on the same set). Hotel,
        guests and policies are fictional. No company branding or proprietary data is used.
      </footer>
    </main>
  );
}
