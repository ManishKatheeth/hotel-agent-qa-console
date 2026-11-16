# PRD: Agent QA Console

## Problem
Hotel AI agents answer calls and create work orders from a staff-maintained knowledge base (KB). KB edits are frequent (prices, hours, policies). There is no pre-publish check, and the existing missed-question queue only shows calls where the agent admitted it was unsure. Two failure modes are invisible: stale facts after a policy change, and confident wrong answers.

## Users
- **GM / front-desk manager** (primary): edits the KB, needs to know a change is safe.
- **Deployment / customer-success lead**: onboarding new properties, needs a quality baseline to show the customer.
- **Product team**: needs a regression suite before shipping agent or model changes.

## Goals
1. Before publishing a KB change, show what it fixes and what it breaks, in plain language.
2. Make "hand off instead of guess" measurable.
3. Turn missed questions into a short list of answers a manager can approve.

## Non-goals
- Real-time call monitoring, voice quality, or transcription accuracy.
- Auto-writing hotel policy. The agent never invents an answer.
- Integration with any real hotel system in this MVP.

## Requirements (MVP, shipped)
| # | Requirement | Status |
|---|---|---|
| R1 | Golden set of calls with expected facts, forbidden (stale) facts, hand-off and work-order expectations | Done (40 cases) |
| R2 | Grader with failure types: unsafe guess, wrong fact, missed answer, wrong action | Done |
| R3 | Compare two KB versions: fixed, regressed, still failing | Done |
| R4 | Publish gate that fails on any regression | Done (`--gate`) |
| R5 | Missed-question queue clustered by theme, answers left to a manager | Done |
| R6 | Same suite runs against a real model, with repeated runs and majority vote | Built, not yet run (needs a gateway key) |
| R7 | Label-free publish check: derive checks from the KB diff and replay unlabeled calls | Done |
| R8 | Stale-value sweep across entries | Done |
| R9 | Gate enforces unsafe-guess and action-accuracy guardrails; items needing review are confirmed by a manager | Done |

## User stories
- As a manager, when I change the parking rate, I see every call whose answer changed and whether it is now right.
- As a manager, I am warned if my edit makes the agent worse on a question that used to work.
- As a product lead, I can run the same suite against a new model before rollout.

## Success metrics
See [metrics.md](metrics.md). North star: share of KB publishes with zero regressions on the golden set.

## Risks
- Golden set coverage: 40 synthetic cases do not represent real calls, and a hand-written set goes stale. Mitigation: the label-free replay needs no expected answers; seed the call log from real de-identified calls.
- Mock agent differs from production. Mitigation: model mode, and treat absolute numbers as illustrative.
- Over-blocking: strict gate slows managers. Mitigation: allow a documented override with a reason.

## Rollout
1. Offline: run on every KB export internally.
2. Pilot with 3-5 properties in "warn" mode.
3. Gate publishes; expose the report card to GMs.
