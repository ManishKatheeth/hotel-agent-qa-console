# Agent QA Console: a report card and publish check for hotel AI agents

> Independent PM case study about AI hotel-operations agents, prompted by my reading of [Lance](https://www.lance.live)'s public site and docs. I am not affiliated with, endorsed by, or working with Lance. It uses only public information and fully synthetic data (a fictional hotel, fictional guests). No company branding, logos or proprietary data.

**Problem.** AI agents that answer hotel calls and open work orders are only as good as the knowledge base a busy manager edits. When prices or policies change, nobody can tell whether the agent now answers correctly, or whether a "small tidy-up" broke something that worked. The public product docs describe call review and a staff-edited knowledge base, but not how quality is scored or how a change is checked before it goes live.

**What I built.** A console that runs a golden set of 40 synthetic calls against the live knowledge base and a draft, then shows what got fixed, what broke, and what the agent is guessing at.

**Result on the bundled data**

| | Live KB | Draft KB |
|---|---|---|
| Pass rate | 83% (33/40) | 88% (35/40) |
| Unsafe-guess rate | 18% | 27% |
| Wrong-fact rate | 15% | 10% |

Draft vs live: **4 fixed, 2 regressed, 3 still failing.** A headline pass rate that goes up still hides two newly broken calls, so the console blocks publishing on any regression.

## Run it

```bash
npm ci
npm test          # 7 tests
npm run eval      # prints the scorecard, writes evals/results.json
npm run dev       # http://localhost:3000, and /?kb=draft for the draft view
npm run build
```

`npm run eval -- --gate` exits non-zero if the draft regresses any previously passing call (CI-style publish gate).

Optional model mode: `AI_GATEWAY_API_KEY=... npm run eval:model` scores a real model (default `anthropic/claude-haiku-5-5`, override with `AGENT_MODEL`) on the same golden set. I have not run this path here (no key), so treat it as untested scaffolding; the mock agent is the verified baseline.

## What it shows

- **Report card.** Pass rate, answer accuracy, unsafe-guess rate (should have handed to a person but answered), wrong-fact rate, by call type.
- **Publish check.** Fixed / regressed / still failing, per case, with the reason. In the demo the manager updates the late-checkout fee, parking and shuttle hours and adds EV charging. Parking, shuttle and both EV questions get fixed. But removing "duplicate-looking" aliases from the checkout entry lets the new late-arrival entry steal "late check out" (regression), and the broad EV keyword "charger" now answers a guest who lost a phone charger (regression). The late-checkout fee question is still wrong.
- **Silent failures.** Some calls fail with confidence, for example "hold my luggage after checkout" gets the checkout time. These never reach a missed-question queue because the agent never admitted doubt. Only the golden set sees them.
- **Missed-question queue.** Calls with no match, grouped by theme (laundry x3, EV charging x3, ...). It proposes keywords but leaves the answer to a manager: the agent must not invent hotel policy.

## Key decisions and trade-offs

- **Deterministic mock agent.** Evaluating the harness, not a model, makes results reproducible and the demo keyless. The cost: the keyword agent is simpler than a real one, so absolute numbers mean little. The mechanism (golden set, grader, diff, gate) is what carries over.
- **Hand off over guess.** Unsafe-guess rate is a first-class metric because a wrong confident answer costs more than a transfer.
- **Simple clustering.** The queue groups by word stem. A production version should cluster with embeddings; the stem approach lumps "lost charger" with "EV charging" (visible in the demo).
- **Golden set is hand-written.** 40 cases is enough to show the idea, not to certify an agent. See the roadmap.

## What I would do next

1. Seed the golden set from real call transcripts (with consent and PII removed) and weight cases by call volume.
2. Run the check automatically on every knowledge-base edit and block publish on regressions.
3. Score a model-backed agent and track drift across model upgrades.
4. Add guest-satisfaction scoring with a documented rubric, and action-safety checks for agents that operate hotel software.

## Docs

- [PRD](docs/PRD.md) · [Metrics](docs/metrics.md) · [Roadmap](docs/roadmap.md) · [Teardown (public info)](docs/teardown.md)
- Golden set: [`evals/golden.json`](evals/golden.json) · Latest results: [`evals/results.json`](evals/results.json)

## Why Lance, why this problem

I read Lance's public product docs, buyer's guide and marketing site and noticed the gap between "the agent can act on hotel systems" and "a manager can tell it is still correct after a policy change". For an AI product team, this is the loop that turns a demo into something a hotel owner trusts. I may be wrong about gaps that exist internally; everything here is inferred from public pages. The teardown lists the evidence and the limits of what I could see from public pages.

Built by Manish Katheeth.
