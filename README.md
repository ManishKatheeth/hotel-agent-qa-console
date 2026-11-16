# Agent QA Console: a publish check for hotel AI agents that a manager never has to maintain

> Independent PM case study about AI hotel-operations agents, prompted by my reading of [Lance](https://www.lance.live)'s public site and docs. I am not affiliated with, endorsed by, or working with Lance. It uses only public information and fully synthetic data (a fictional hotel, fictional guests). No company branding, logos or proprietary data.

**Problem.** AI agents that answer hotel calls and open work orders are only as good as the knowledge base a busy manager edits. When prices or policies change, nobody can tell whether the agent now answers correctly, or whether a "small tidy-up" broke something that worked. The public product docs describe call review and a staff-edited knowledge base, but not how a change is checked before it goes live.

**The catch with a plain regression suite.** A hand-written golden set has to be updated every time a price changes, which is exactly the chore a manager skips, so the suite goes stale. This console does not depend on that.

**What it does.** Before publish it:
1. **Diffs the two knowledge bases** and derives checks from the edit itself: a value that left an answer must not appear, a value that entered must. No golden labels needed.
2. **Replays recent calls** (60 unlabeled synthetic calls here) on live and draft and sorts the changes into *unchanged*, *changed as the edit intended*, and *needs your confirmation* (a different entry now answers, a hand-off became an answer, an old value is still in the reply).
3. **Sweeps for stale values** a manager forgot elsewhere (the old parking rate still in a package entry).
4. **Blocks publish** on a golden-set regression, a rise in unsafe guesses, a fall in action accuracy, or any unconfirmed review item.

The 40-case golden set stays as a supplement for known-critical calls and for the report card.

## Result on the bundled data (mock agent)

| | Live KB | Draft KB |
|---|---|---|
| Pass rate (golden set) | 83% (33/40) | 88% (35/40) |
| Unsafe-guess rate (answered when it should hand off) | 9% | 18% |
| Wrong-fact rate | 15% | 10% |
| Wrong-action rate | 3% | 3% |

Golden set, draft vs live: **4 fixed, 2 regressed, 3 still failing.** The headline pass rate goes up, but the unsafe-guess rate doubles.

Label-free replay of 60 calls: **40 unchanged, 9 changed as intended, 11 need a manager's look.** The 11 include both known regressions (late-checkout calls now answered by the new late-arrival entry; a lost phone charger now answered with EV charging) and the new answers (EV charging, after-hours arrival) that a manager should confirm. None of that needed a hand-written expected answer. Nine checks were derived from the edit itself.

Real-model results are **not included yet**: see "Model mode".

## Run it

```bash
npm ci
npm test          # 23 tests
npm run eval      # scorecard, derived checks, replay, gate verdict; writes evals/results.json
npm run dev       # http://localhost:3000, and /?kb=draft for the draft view
npm run build
```

`npm run eval -- --gate` exits non-zero when the gate blocks. A manager confirms review items with `--approve c02,c03` or by listing ids in `evals/approvals.json`. Golden-set regressions, a rise in unsafe guesses and a fall in action accuracy cannot be approved away.

## Model mode

```bash
AI_GATEWAY_API_KEY=... npm run eval:model            # 3 runs per case, majority vote
AI_GATEWAY_API_KEY=... npm run eval:model -- --runs 5
```

Scores a real model (default `anthropic/claude-haiku-5-5`, override with `AGENT_MODEL`) through the Vercel AI Gateway on the same golden set and replay. Models answer differently run to run, so a case counts as failed only if it fails in most runs; a case that fails in some runs is reported as flaky and does not block. Fact checks compare values, so "40 dollars" matches "$40" and "12 AM" matches "midnight". An answer that cites a non-existent KB entry, unparseable output, a timeout or a gateway error is treated as a hand-off, never as a pass.

I have **not run this path yet** (no key in the environment that built this), so treat model results as unmeasured. The mock agent is the verified baseline, and its two regressions come from keyword ties a real model may not make; the model run is how to find out.

## What it shows

- **Calls to review.** Replay results with live and draft answers side by side and the reason each is listed.
- **Publish check.** Fixed / regressed / still failing on the golden set, plus the gate's reasons.
- **Silent failures.** Some calls fail with confidence, for example "hold my luggage after checkout" gets the checkout time. These never reach a missed-question queue because the agent never admitted doubt.
- **Missed-question queue.** Calls with no match, grouped by theme. It proposes keywords but leaves the answer to a manager: the agent must not invent hotel policy.

## Key decisions and trade-offs

- **Derive checks from the edit, not from labels.** This removes the double entry that kills most eval suites. The cost: it can only say whether an edit *did what it says* and whether anything *else moved*; it cannot know a correct answer the edit never touched. That is what the golden set is for.
- **Review, do not auto-judge.** An entry switch or a new answer is shown to a person rather than scored right or wrong, because it is sometimes the intent (new EV entry) and sometimes a bug (lost charger).
- **Deterministic mock agent.** Makes results reproducible and the demo keyless; absolute numbers mean little.
- **Hand off over guess.** Unsafe-guess rate is a first-class metric, and now only counts answers given when a hand-off was right (wrong work orders are tracked separately).
- **Simple clustering.** The queue groups by word stem; a production version should use embeddings.
- **Synthetic call log.** The 60 replay calls are made up. In production this would be recent real calls, de-identified.

## What I would do next

1. Replay a rolling window of real, de-identified calls instead of the synthetic list.
2. Run the check automatically on every knowledge-base edit and show it inline in the editor.
3. Run model mode and publish the mock-vs-model comparison; track drift across model upgrades.
4. Guest-satisfaction scoring with a documented rubric, and action-safety checks for agents that operate hotel software.

## Docs

- [PRD](docs/PRD.md) · [Metrics](docs/metrics.md) · [Roadmap](docs/roadmap.md) · [Teardown (public info)](docs/teardown.md)
- Golden set: [`evals/golden.json`](evals/golden.json) · Replay calls: [`evals/calls.json`](evals/calls.json) · Latest results: [`evals/results.json`](evals/results.json)

## Why Lance, why this problem

I read Lance's public product docs, buyer's guide and marketing site and noticed the gap between "the agent can act on hotel systems" and "a manager can tell it is still correct after a policy change". For an AI product team, this is the loop that turns a demo into something a hotel owner trusts. I may be wrong about gaps that exist internally; everything here is inferred from public pages. The teardown lists the evidence and the limits of what I could see from public pages.

Built by Manish Katheeth.
