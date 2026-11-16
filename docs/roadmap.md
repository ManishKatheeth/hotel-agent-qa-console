# Roadmap

## Now (shipped in this MVP)
- Golden set, grader, publish gate, missed-question queue, report-card UI.
- Label-free publish check: KB diff, derived checks, call replay, stale-value sweep, enforced guardrails, majority-vote model mode.

## Next
- Replace the synthetic replay list with a rolling window of real, de-identified calls; weight by volume.
- Run model mode and publish the mock-vs-model comparison.
- Run automatically on every KB edit; show the diff inline in the editor.
- Approve-an-answer flow that turns a queue cluster into a KB entry and re-runs the suite.
- Embedding-based clustering for the queue.

## Later
- Scoring rubric for guest satisfaction and tone.
- Action-safety checks (approval tiers) for agents operating hotel software.
- Model/version comparison dashboard to catch drift on upgrades.
- Per-brand and per-property suites.
