# Lance teardown (public information only; independent, not affiliated)

Date: 2026-11-15. Sources: lance.live public pages (REA passive inspection of the homepage + page text fetches of /product-docs, /guides/ai-voice-agent-for-hotels, /news), YC company page, a Chinese-language article (woshipm), and web search summaries. Company claims are marked as claims, not verified.

## Business model
- AI "operations staff" for hotels: voice front desk agent, sales agent, task/work-order routing, housekeeping boards, preventive maintenance (Lance Predictive, launched 10/14), AI labor scheduling, Agent Builder, and Lance Pad (tablet/mobile for floor staff).
- Sold as a per-hotel subscription scoped to enabled products (per Lance's own buyer's guide). No public pricing; "Book a demo" is the only CTA.
- YC W26, SF, ~10 people (YC page). $5M seed announced 2026-04-28 (YC, SV Angel; per secondary trackers).
- Founders: Caleb Chan (CEO), Gavin Brennen (COO), Gatik Trivedi (CTO). Third-party profiles disagree on founding year (2024 vs 2026).

## Customers / ICP
- Hotel GMs and owners of branded select/limited-service properties (Marriott, Hilton, Aloft/Hyatt-family testimonials on site; "50+ hotels" is a company claim).
- Testimonials on the homepage: Homewood Suites San Jose "1 hr -> 20 min" (a process, not specified); Aloft Dublin-Pleasanton owner "pays for itself", 3 properties.
- Pain cited by Lance (their figures, unverified): 65% of hotels report staffing shortages; up to 40% of calls missed at busy/after-hours times.

## Pricing
Not published. Positioning on ROI ("clearest ROI decision") but no ROI numbers disclosed.

## Product surface (from docs/pages)
- **Front Desk:** dashboard (call volume, outcomes, calls handled without staff, guest satisfaction signals, work created from calls), call history/review, Knowledge Base of approved answers, transfer routing to department lines with front desk as required fallback.
- **Ops:** room boards, task system (houseman, maintenance, complaints), Lance Pad, Engineering/preventive maintenance.
- **Sales:** call records, structured inquiries, guest profiles, pre-arrival workflows, upsells, manager briefs.
- Voice agent connects via SIP trunk next to the existing PBX (buyer's guide). Handoff-over-guessing: low-confidence FAQ matches transfer; missed questions go to a review queue; approved answers go live on next call.
- JD/YC text says agents are "Computer Use Agent" based and operate existing hotel software. Docs and homepage name no PMS integrations.

## Inferred stack (REA, homepage only)
Observed by REA on https://www.lance.live/ (10s passive window, accessibility text + scripts + storage inventory):
- Next.js static chunk layout (`/_next/static/immutable/chunks/`) with a Turbopack runtime chunk.
- Vercel Speed Insights script (`/_vercel/speed-insights/script.js`).
- PostHog-style product analytics config served through a first-party `/ingest/` proxy path.
- Security page claims: SOC 2 Type I, GDPR support, PCI DSS self-attested (SAQ A, explicitly "not a third-party certification").
- No local/session storage, IndexedDB or cache entries at load.
Limits: observation began at attach so earlier network is unavailable; request/response bodies and headers are not retained; no logged-in surfaces inspected; nothing about the voice/agent backend is visible from a marketing page. Stack claims above are hints, not a full architecture.

## Competitors
Canary Technologies, Akia, Q Concierge, ALICE, and numerous hotel voice-AI startups (names from search/article, not exhaustive). Lance differentiates on rebuilding internal execution (work orders, housekeeping, maintenance) rather than only answering the front desk.

## Recent launches / news
- 04/28/2026: $5M seed.
- 08/22: AI Task Management; Lance Boards.
- 10/14: Lance Predictive (preventive maintenance); Homewood Suites San Jose case study.
- 07/01: AC Hotel South San Francisco case study.
- Open roles (YC): Member of Technical Staff, Product Engineer, interns, Deployment Specialist (contract). A deployment-specialist hire hints that onboarding is still hands-on.

## What the JD reveals
- Title says Product Engineer but body describes a Product Manager (roadmap, backlog, customer feedback, performance measurement).
- Priorities: customer feedback loops, evaluating product performance, multiple concurrent products, SaaS/AI/hospitality plus. Intense culture ("996").

## Ranked problems / opportunities
| # | Problem | Evidence | Impact | Effort |
|---|---------|----------|--------|--------|
| 1 | **No visible way to prove or regression-test agent quality.** Managers get call review and satisfaction "signals", but docs do not explain how satisfaction or low-confidence matching is scored, and staff are told to re-verify the KB after price/policy changes by hand. A wrong answer or wrong PMS action costs trust fast. | Docs: KB maintenance is manual; "low-confidence FAQ matches" unexplained; buyer's guide lists "missed questions" and handoff as the quality metrics. | High | Med |
| 2 | **Revenue impact of the Sales/Voice agent isn't surfaced.** Lance pitches "close sales" and "pays for itself", but the buyer's guide omits booking conversion and no ROI numbers are public. | Buyer's guide metrics list has no conversion; homepage ROI claim is a quote only; pricing hidden. | High | Low-Med |
| 3 | **Agent action safety for computer-use work.** Agents can create work orders and operate hotel software, but docs describe no approval workflow or risk tiering for actions (e.g., edit a reservation, comp a room). | Docs: "staff stay in control" but no approval workflow; PMS integrations unnamed. | High | Med-High |
| 4 | **Onboarding/time-to-value.** KB setup, front-desk FAQ verification and a contract Deployment Specialist role suggest hand-held rollout. | Docs onboarding steps; open roles. | Med | Med |
| 5 | **Staff adoption of Lance Pad / boards** (replace radios and verbal handoffs). | woshipm article; Homewood case study. | Med | Med |

Items 1-3 are stated as hypotheses grounded in public docs; Lance's internal data may already address them.
