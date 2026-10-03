# User Flows

> Key workflows. Requirement IDs trace to `docs/Requirements.md`; phases to `docs/Roadmap.md`.

## 1. First-run onboarding

```
Landing page
  → Sign up (email/password)          [FR-AUTH-01]
  → Organization auto-created         [FR-TEN-01]
  → Demo dataset attached to org      [FR-TEN-02]
  → Dashboard (demo-labeled content)  [FR-DASH-01, FR-DASH-04]
```

A brand-new user immediately sees a populated, clearly demo-labeled dashboard — no empty-product
experience, and no requirement to configure any paid API.

## 2. Product discovery → save → watch

```
Discover → Products
  → search / category / filters / sort            [FR-PROD-01, FR-SEARCH-01]
  → product detail (fields, trend indicators)     [FR-PROD-02]
  → Save  /  Add to watchlist                     [FR-PROD-03, FR-WATCH-01]
```

Every estimated/calculated/demo metric on the detail page is visually marked non-verified
[FR-PROD-04].

## 3. Store investigation

```
Discover → Stores
  → search / filter                                [FR-STORE-01]
  → store profile: Overview | Products | Advertising
    | Landing Pages | Customer Intelligence | AI Analysis   [FR-STORE-02]
  → Save / watchlist / compare with another store  [FR-STORE-03, FR-WATCH-01]
```

## 4. Ad intelligence → AI analysis

```
Discover → Ads
  → filter (platform, advertiser, category, format, duration, date, keyword)  [FR-AD-02]
  → creative detail + advertiser/store links                                  [FR-AD-04]
  → "Analyze with AI" → background job
      → Hook / Problem / Promise / Offer / Structure / CTA / Audience / Angle [FR-AIAD-01, 02]
      → cached on repeat                                                      [FR-AIAD-04]
```

UI shows an "AI processing" state while the job runs; the result tags every claim as Observed /
Calculated / AI Interpretation / Assumption [FR-COMP-03, NFR-UI-02].

## 5. Competitor analysis

```
Research → Competitors
  → choose a store (from watchlist or search)        [FR-COMP-01]
  → create analysis job (does not block HTTP)        [FR-COMP-04, NFR-PERF-01]
  → structured report (11 sections)                  [FR-COMP-02]
  → evidence tags on every AI statement              [FR-COMP-03]
  → "Generate full report" → Reports module          [FR-RPT-01]
```

## 6. Customer intelligence → opportunities

```
Research → Customer Intelligence
  → review themes / sentiment / recurring complaints  [FR-REV-01, 02]
  → AI summary of pain points                         [FR-REV-03]
Research → Opportunities
  → gap analysis across products/ads/reviews          [FR-OPP-01]
  → opportunity card (Evidence, Confidence, …)        [FR-OPP-02]
```

Opportunities always read as "worth validating," never as advice [FR-OPP-03].

## 7. AI Analyst conversation

```
AI → AI Analyst
  → user question (natural language)                 [FR-AI-01]
  → assistant selects approved tools                 [FR-AI-02]
  → tools query tenant-scoped DB only                [FR-AI-02, NFR-TENANT-01]
  → response: evidence (with record refs) + labeled interpretation  [FR-AI-03, 05]
  → insufficient data → explicit "no data available" [FR-AI-04]
```

## 8. Monitoring loop

```
Monitor → Watchlist
  → tracked entities + change timeline               [FR-WATCH-02, 03]
  → change detection from seeded/triggered sync jobs [FR-WATCH-04]
  → alerts surface noteworthy changes                [FR-WATCH-05]
  → drill into change → back to discovery/research
```

## 9. Reports

```
AI → Reports (or from a competitor analysis)
  → generate report (background job)                 [FR-RPT-01, NFR-PERF-01]
  → web view / CSV export (PDF if practical)         [FR-RPT-02]
  → report history, org-scoped access                [FR-RPT-03]
```

## 10. Billing & limits

```
Pricing (public) → Account → Billing
  → choose plan (FREE/PRO, centralized config)       [FR-BILL-01]
  → Stripe test checkout (success/cancel return URLs)[FR-BILL-02]
  → webhook (verified, idempotent) → subscription active [FR-BILL-03]
  → Customer Portal for payment/plan/cancel          [FR-BILL-02]
  → cancel → PRO until period end → FREE             [FR-BILL-03]
  → payment fails → past-due grace + portal nudge    [FR-BILL-03]
  → usage counters increment on metered actions      [FR-BILL-04]
  → limit reached → server-side 429 + UI nudge       [FR-BILL-05]
  → dashboard + billing page show plan/usage/reset   [FR-BILL-05, FR-DASH-03]
```

## Error / degraded paths (by design)

| Situation | Behavior |
|-----------|----------|
| No AI key configured | AI features run in clearly labeled **Demo AI** mode (NFR-PROV-01) |
| Data provider unconfigured | Demo provider used; badge shows "Demo data" (NFR-PROV-02) |
| AI job fails | Error state + retry guidance; partial results kept if any |
| Rate/usage limit hit | Friendly upgrade nudge; action blocked server-side |
| Cross-tenant access attempt | 404/403 — never leaks existence (FR-TEN-05) |
| Empty watchlist | Empty state with a "discover products" shortcut |
