# Product Vision

## 1. Vision statement

> **Understand what is happening in e-commerce before making your next move.**

Vantage is an AI-powered command center for e-commerce competitive intelligence. It exists
because competitive signals (products, stores, ads, reviews, trends) are abundant but
*uninterpretable*. Raw feeds answer *what*. Vantage answers *so what* and *now what*.

## 2. The evolution curve

The product matures along a deliberate path; each stage is only as good as the data and
reasoning beneath it:

```
Data → Analytics → AI Intelligence → Recommendations → Monitoring
```

- **Data** — observed, sourced, provenance-labeled records
- **Analytics** — app-computed metrics over those records
- **AI Intelligence** — interpretation grounded strictly in retrieved evidence
- **Recommendations** — hedged, opportunity-level next actions to *investigate*
- **Monitoring** — watchlists and change detection that close the loop

## 3. Product principles

1. **Insight over inventory.** Show fewer things, understood better.
2. **Evidence before interpretation.** Facts and inferences are visually and structurally
   distinct, always.
3. **Honest by default.** Missing data is shown as missing — never filled with invention.
4. **Actionable, not absolute.** Opportunities are framed as "worth validating," never as
   guaranteed outcomes.
5. **Replaceable providers.** No hard coupling to any AI or data vendor.
6. **Simple until proven complex.** No abstraction, infrastructure, or optimization without a
   demonstrated need.

## 4. Target users and their jobs-to-be-done

| User | Job to be done |
|------|----------------|
| Founder | Find underserved categories and defensible product gaps before committing spend |
| Marketer | Understand which hooks, angles, and offers competitors actually run |
| Agency | Research multiple brands quickly and produce shareable evidence-backed reports |
| Product researcher | Track category momentum and customer pain points over time |

## 5. Core loop

```
Discover (products, stores, ads, trends)
   ↓
Investigate (store profiles, creatives, reviews)
   ↓
Analyze (competitor reports, AI ad analysis, gap analysis)
   ↓
Understand (evidence vs. interpretation, clearly labeled)
   ↓
Identify Opportunities (hedged, confidence-scored)
   ↓
Monitor (watchlists, change detection, alerts)
   ↓
Act (reports, export, next experiments)
```

## 6. What the product is NOT

- Not a storefront: no cart, checkout, payment for goods, orders, inventory, or shipping.
- Not a scraper vendor: the MVP runs on configured/sourced data, not custom crawlers.
- Not a prediction engine: no "this will succeed" claims, ever.
- Not a dashboard-only tool: every screen ends in an action or a next question.

## 7. Brand identity (working, centralized, changeable)

> **Working name: "Vantage"** — a place affording a good view. Temporary by design.

- All brand strings live in **one configuration module** (`brand` config) and design tokens in
  **one Tailwind theme file**, so a rename touches two files, not dozens.
- Voice: **direct, evidence-qualified, useful.** "The available data suggests…", "A possible
  explanation is…", "This should be validated before acting."
- Visual identity: professional analytics product — deep slate primary, teal/emerald accent,
  generous whitespace, data-first typography. Full spec: `docs/UI-Design.md`.

## 8. Build philosophy <a id="build-philosophy"></a>

1. Inspect before modifying.
2. Reuse code only when genuinely useful (here: nothing to reuse — see ADR-001).
3. Prefer simple, maintainable architecture.
4. Do not preserve code merely because it exists.
5. Do not over-engineer the MVP.
6. Do not fabricate external data.
7. Keep external data providers replaceable.
8. Keep AI providers replaceable.
9. Build with future scalability in mind, not with future complexity.
10. Use background jobs for expensive operations.
11. Secrets in environment variables, never hard-coded, never committed.
12. Add proper error handling and loading/empty/success/partial-data/error states.
13. Fully usable with clearly labeled demo data, without paid APIs.
14. Do not implement future features until the current phase works.
15. Run tests/build/lint after every phase.
16. Avoid unnecessary dependencies and infrastructure.
17. No abstractions without demonstrated need; no premature optimization.
18. Understandable by another developer.
