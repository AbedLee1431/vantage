# Features — MVP Module Scope

> The MVP modules from the master specification (§10), each kept deliberately lean in line with
> the "don't overbuild" rule (§47). Requirement IDs trace to `docs/Requirements.md`.

## Module map and navigation

```
Dashboard

Discover
  Products
  Stores
  Ads
  Trends

Research
  Competitors
  Opportunities
  Customer Intelligence

Monitor
  Watchlist
  Alerts

AI
  AI Analyst
  Reports

Account
  Billing
  Settings
```

## 1. Dashboard

Overview cards + lists: tracked competitors, recent discoveries, recent ads, products, market
signals, AI insights, watchlist changes, usage, account/subscription status. Everything
demo-seeded is labeled demo.

**FR:** FR-DASH-01…04 · **Phase:** 1 (shell) → 4 (AI) → 8 (usage/billing)

## 2. Product Discovery

Search, category browse, filters, sorting, product details (name, category, description, price,
currency, store, URL, image, first/last seen, ad activity, trend indicators, source, tags),
save, add to watchlist. Metrics that are estimated/calculated/demo are presented as
non-verified.

**FR:** FR-PROD-01…04 · **Phase:** 2

## 3. Store / Brand Discovery

Search, filter, store profiles with sections: Overview (name, domain, category, country,
platform, description, product count), Products, Advertising, Landing Pages, Customer
Intelligence, AI Analysis. Save stores, add to watchlist, compare stores.

**FR:** FR-STORE-01…03 · **Phase:** 2 (overview/products) → 3 (ads) → 5 (reviews) → 4 (AI)

## 4. Competitor Analysis

Select/enter a store → structured report: Store Overview, Product Strategy, Pricing, Advertising
Activity, Creative Strategy, Landing Pages, Customer Feedback, Positioning, Observed Changes, AI
Insights, Opportunities to Investigate. Every AI item tagged Observed / Calculated / AI
Interpretation / Assumption. Runs as a background job.

**FR:** FR-COMP-01…04 · **Phase:** 4

## 5. Ad Intelligence

Ad database (advertiser, store, platform, title, primary text, headline, CTA, creative URL,
destination URL, format, first/last seen, duration, status, source). Filters: platform,
advertiser, category, format, duration, date, keyword. Creative detail view; advertiser/store
linkage. Data via the advertising provider abstraction.

**FR:** FR-AD-01…05 · **Phase:** 3

## 6. AI Ad Analysis

Per-ad analysis: Hook, Problem, Promise, Offer, Creative Structure, CTA, Audience Hypothesis,
Marketing Angle (price / convenience / transformation / problem-solution / social proof /
urgency / comparison / demonstration). Hedged language enforced. No success claims without
performance data. Results persisted and cached.

**FR:** FR-AIAD-01…04 · **Phase:** 4

## 7. Customer Review Intelligence

Reviews via provider abstraction. Extraction: positive/negative themes, recurring complaints,
feature requests, pricing/shipping/quality concerns, common use cases, sentiment. AI summary of
recurring pain points. Never fabricates reviews.

**FR:** FR-REV-01…04 · **Phase:** 5

## 8. Market Opportunities

Gap analysis across product/store/ad/review data. Signals: recurring complaints, missing
features, pricing gaps, positioning gaps, underserved use cases, differentiation opportunities.
Opportunity records: Opportunity, Evidence, Supporting Data, Competitors Observed, Customer Pain
Points, Potential Differentiation, Confidence. Presented as investigation, not advice.

**FR:** FR-OPP-01…03 · **Phase:** 5

## 9. Trends

Signals: increasing product activity, increasing ad activity, increasing store counts, category
momentum, change over time. Charts + plain-language explanations. Demo-labeled; no fake
real-time claims.

**FR:** FR-TREND-01…03 · **Phase:** 2

## 10. Watchlist / Monitoring

Save products, stores, advertisers, competitors. Per-entity watchlist dashboard. Change types:
new/removed product, new ad, ad activity change, price change, landing page change, review
change. Change detection from seeded data or manually triggered sync jobs; automated monitoring
is an extension point. Alert model included.

**FR:** FR-WATCH-01…05 · **Phase:** 2 (save) → 6 (change detection, alerts, jobs)

## 11. AI E-commerce Analyst

Conversational assistant ("Find emerging skincare opportunities", "Analyze this competitor",
"What advertising angles are appearing repeatedly?", "Summarize the biggest customer
complaints", "Compare these two stores", "What changed for this competitor?"). Operates only
through approved application tools/functions; cannot synthesize records; states when data is
insufficient.

**FR:** FR-AI-01…05 · **Phase:** 4

## 12. Reports

Structured reports: Executive Summary, Data Overview, Competitor Findings, Product Findings,
Advertising Findings, Customer Intelligence, Market Opportunities, AI Analysis, Sources,
Timestamps, Provenance. Web view, per-section CSV export, browser print/PDF styles. Report
history with type filter and delete flow; per-organization authorization.

**FR:** FR-RPT-01…03 · **Phase:** 7

## 13. Billing

Public pricing page (`/pricing`, from central config), Stripe test-mode Checkout
(server-created sessions, customer reuse), Customer Portal (plan changes/cancellation),
signature-verified idempotent webhooks (checkout/subscription/invoice events, downgrade
and cancel revert to FREE, past-due grace), centralized entitlements
(`src/server/billing/subscriptions.ts` — no scattered plan checks), monthly usage
quotas enforced server-side (429 + upgrade hint; searches tracked), billing page
(`/billing`: plan, status, renewal, usage meters, portal actions), dashboard plan/usage
widget, topbar plan badge. Plan config centralized (FREE / PRO, `src/lib/billing/plans.ts`).
Demo mode with no keys: fully usable on Free, explicit "not configured" states, never
fake charges.

**FR:** FR-BILL-01…06 · **Phase:** 8

## 14. Landing page & marketing site

Hero, product screenshots/mock dashboard, feature sections, workflow, pricing, FAQ, CTA, footer.
Original copy and design. SEO-optimized (Phase 9).

**FR:** FR-LP-01 · **Phase:** 1 → polish 9

## 15. Global search

Search products, stores, advertisers, competitors with filters/sorting. Implemented with Postgres
text search — deliberately not a dedicated search engine.

**FR:** FR-SEARCH-01…02 · **Phase:** 2

## 16. Account & Settings

Profile, password change, organization/workspace settings, demo-vs-live provider status,
sign-out.

**Phase:** 1 → 8

## Cross-cutting features (every module)

- **Provenance labeling** — demo/estimated/calculated/AI badges (NFR-PROV-03)
- **UI states** — loading, empty, error, success, partial data, demo, provider unavailable, AI
  processing (NFR-UI-02)
- **Usage accounting** — metered actions feed limits (FR-BILL-04)
- **Tenant scoping** — every query organization-scoped (NFR-TENANT-01)
