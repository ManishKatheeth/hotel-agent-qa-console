# Metrics

**North star:** % of KB publishes with zero regressions on the golden set.

## Inputs
| Metric | Definition | Demo value (live / draft) |
|---|---|---|
| Pass rate | Golden cases passed / total | 83% / 88% |
| Answer accuracy | Answer cases with all expected facts and no stale facts | 75% / 90% |
| Unsafe-guess rate | Handoff-expected cases where the agent answered or acted | 18% / 27% |
| Wrong-fact rate | Answer cases with a missing or stale fact | 15% / 10% |
| Action accuracy | Work orders with correct dept and room | 100% / 100% |
| Regressions per publish | Cases that passed before and fail after | 2 |
| Time to fix | Missed-question cluster created to approved answer | not instrumented |

## Guardrails
- Unsafe-guess rate must not rise on any publish.
- Action accuracy must not fall.
- Gate override rate under 10% of publishes.

## Instrumentation plan
- Log each eval run with KB version hash, agent/model version, per-case outcome.
- Track queue cluster age and approval events.
- Compare golden-set pass rate against real-call outcomes (transfer rate, resolution) to check the set predicts production quality.

Demo values come from `npm run eval` on synthetic data and are illustrative only.
