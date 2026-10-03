# Requirements

> Traceable requirements. Each row maps back to the master specification section it came from.
> Format: `FR-xx` (functional) / `NFR-xx` (non-functional). Implementation phases reference these
> IDs in `docs/Roadmap.md`.

## 1. Functional requirements

### 1.1 Authentication & identity

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-AUTH-01 | Email/password registration with hashed password storage | 29 | 1 |
| FR-AUTH-02 | Login and logout | 29 | 1 |
| FR-AUTH-03 | Session management with protected routes | 29 | 1 |
| FR-AUTH-04 | Password reset via signed token (email or console link in demo mode) | 29 | 1 |
| FR-AUTH-05 | No plaintext passwords at rest or in logs | 29, 39 | 1 |
| FR-AUTH-06 | Authorization: users may only act within organizations they belong to | 28, 29 | 1 |

### 1.2 Multi-tenancy

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-TEN-01 | User → Organization (workspace) → tenant-owned data hierarchy | 28 | 1 |
| FR-TEN-02 | Every tenant-owned entity has an explicit ownership relationship | 28 | 1 |
| FR-TEN-03 | Active organization derived from authenticated session + membership — never from client input | 28 | 1 |
| FR-TEN-04 | Isolation enforced server-side on every query (not only in the UI) | 28 | 1 |
| FR-TEN-05 | Cross-organization data access is rejected as an error, not silently filtered | 28 | 1 |

### 1.3 Dashboard

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-DASH-01 | Overview of tracked competitors, recent discoveries, recent ads, products, market signals | 11 | 1 |
| FR-DASH-02 | AI insights and watchlist change summaries | 11 | 4 |
| FR-DASH-03 | Usage and account/subscription status widgets | 11, 31 | 8 |
| FR-DASH-04 | All demo-seeded content visibly labeled as demo | 11, 40 | 1 |

### 1.4 Product discovery

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-PROD-01 | Search products; browse categories; filter; sort | 12, 36 | 2 |
| FR-PROD-02 | Product detail view with: name, category, description, price, currency, store, URL, image, first/last seen, ad activity, trend indicators, source, tags | 12 | 2 |
| FR-PROD-03 | Save products; add products to watchlist | 12, 20 | 2 |
| FR-PROD-04 | Estimated/calculated/demo metrics presented as non-verified | 12 | 2 |

### 1.5 Store / brand discovery

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-STORE-01 | Search, filter, and open store profiles; save stores; add to watchlists | 13 | 2 |
| FR-STORE-02 | Store profile sections: Overview, Products, Advertising, Landing Pages, Customer Intelligence, AI Analysis | 13 | 2–5 |
| FR-STORE-03 | Compare two or more stores | 13 | 4 |

### 1.6 Competitor analysis

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-COMP-01 | Select/enter a store and generate a structured competitor report | 14 | 4 |
| FR-COMP-02 | Report sections: Overview, Product Strategy, Pricing, Advertising Activity, Creative Strategy, Landing Pages, Customer Feedback, Positioning, Observed Changes, AI Insights, Opportunities to Investigate | 14 | 4 |
| FR-COMP-03 | Every AI section tags items as Observed / Calculated / AI Interpretation / Assumption | 14 | 4 |
| FR-COMP-04 | Run as a background job (does not block HTTP) | 14, 37 | 4 |

### 1.7 Ad intelligence

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-AD-01 | Ad database with fields: advertiser, store, platform, title, primary text, headline, CTA, creative URL, destination URL, format, first/last seen, duration, status, source | 15 | 3 |
| FR-AD-02 | Filter ads by platform, advertiser, category, format, duration, date, keyword | 15 | 3 |
| FR-AD-03 | Advertising data via a provider abstraction — no hard-coded single external API | 15 | 3 |
| FR-AD-04 | Creative detail view and advertiser/store linkage | 15 | 3 |
| FR-AD-05 | No success claims for ads without supporting performance data | 15, 16 | 3 |

### 1.8 AI ad analysis

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-AIAD-01 | AI analysis of an ad covering Hook, Problem, Promise, Offer, Creative Structure, CTA, Audience Hypothesis, Marketing Angle | 16 | 4 |
| FR-AIAD-02 | Marketing-angle taxonomy: price, convenience, transformation, problem/solution, social proof, urgency, comparison, demonstration | 16 | 4 |
| FR-AIAD-03 | Hedged language enforced ("The available data suggests…", "This should be validated…") | 16, 22 | 4 |
| FR-AIAD-04 | Analysis persisted; repeated identical analysis served from cache | 16, 38 | 4 |

### 1.9 Customer review intelligence

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-REV-01 | Reviews via provider abstraction; sentiment and theme extraction | 17 | 5 |
| FR-REV-02 | Analyze positive themes, negative themes, recurring complaints, feature requests, pricing/shipping/quality concerns, common use cases, sentiment | 17 | 5 |
| FR-REV-03 | AI summary of recurring pain points | 17 | 5 |
| FR-REV-04 | Reviews are never fabricated; absent reviews are reported as absent | 17, 25 | 5 |

### 1.10 Market opportunities

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-OPP-01 | Gap analysis from product, store, advertising, and review data | 18 | 5 |
| FR-OPP-02 | Opportunity records: Opportunity, Evidence, Supporting Data, Competitors Observed, Customer Pain Points, Potential Differentiation, Confidence | 18 | 5 |
| FR-OPP-03 | Opportunities framed as investigation, never guaranteed business advice | 18 | 5 |

### 1.11 Trends

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-TREND-01 | Signals: product activity, ad activity, store count, category momentum, change over time | 19 | 2 |
| FR-TREND-02 | Charts with plain-language explanations | 19 | 2 |
| FR-TREND-03 | Demo trends labeled; no fake "real-time" claims | 19 | 2 |

### 1.12 Watchlist / monitoring

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-WATCH-01 | Save products, stores, advertisers, competitors to watchlists | 20 | 2 |
| FR-WATCH-02 | Watchlist dashboard per tracked entity | 20 | 6 |
| FR-WATCH-03 | Change types: new/removed product, new ad, ad activity change, price change, landing page change, review change | 20 | 6 |
| FR-WATCH-04 | Change detection via seeded data or manually triggered sync jobs; automated monitoring is an extension point, not a claim | 20, 37 | 6 |
| FR-WATCH-05 | Alert model (records of noteworthy changes) | 20 | 6 |

### 1.13 AI e-commerce analyst

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-AI-01 | Conversational assistant answering product/store/ad/review/competitor/trend/opportunity questions | 21 | 4 |
| FR-AI-02 | Assistant acts only through approved application tools/functions that query the DB — it cannot synthesize records | 21, 22 | 4 |
| FR-AI-03 | Retrieved application data is the factual evidence; interpretation is labeled | 22 | 4 |
| FR-AI-04 | Insufficient data is stated explicitly; hypotheses are labeled as hypotheses | 22 | 4 |
| FR-AI-05 | Reference underlying records where practical | 22 | 4 |

### 1.14 Reports

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-RPT-01 | Structured reports: executive summary, data overview, competitor/product/advertising findings, customer intelligence, opportunities, AI analysis, sources, timestamps, provenance | 32 | 7 |
| FR-RPT-02 | Web view; CSV export for tabular data; PDF export if practical | 32 | 7 |
| FR-RPT-03 | Report history and authorization per organization | 32 | 7 |

### 1.15 Billing & usage

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-BILL-01 | Plans (FREE / PRO) with centralized, non-hard-coded configuration | 30, 31 | 8 |
| FR-BILL-02 | Stripe customer, subscription, checkout (test mode) | 30 | 8 |
| FR-BILL-03 | Signature-verified webhooks update subscription state | 30 | 8 |
| FR-BILL-04 | Usage tracking: searches, competitor analyses, AI analyses, reports, tracked competitors | 31 | 8 |
| FR-BILL-05 | Limits enforced server-side; UI shows usage, remaining, plan, reset period | 31 | 8 |
| FR-BILL-06 | Billing page and pricing page | 30, 33 | 8 |

### 1.16 Landing page & search

| ID | Requirement | Spec § | Phase |
|----|-------------|--------|-------|
| FR-LP-01 | Polished landing page: hero, product mock, features, workflow, pricing, FAQ, CTA, footer — original copy/design | 33 | 1 |
| FR-SEARCH-01 | Global search across products, stores, advertisers, competitors with filters/sorting | 36 | 2 |
| FR-SEARCH-02 | Simple search infrastructure (Postgres text search) — no complex search engine for MVP | 36 | 2 |

## 2. Non-functional requirements

| ID | Requirement | Spec § |
|----|-------------|--------|
| NFR-SEC-01 | Secrets only in server-side env vars; never in client bundles or source control | 39, 42 |
| NFR-SEC-02 | Input validation (Zod) on every endpoint | 39 |
| NFR-SEC-03 | Authentication + authorization checks on every protected route | 39 |
| NFR-SEC-04 | Rate limiting where appropriate | 39 |
| NFR-SEC-05 | Parameterized/safe DB queries (ORM) — no raw string SQL | 39 |
| NFR-SEC-06 | Stripe webhook signature verification | 30, 39 |
| NFR-SEC-07 | CSRF protection where applicable; XSS-safe rendering; safe URL handling | 39 |
| NFR-SEC-08 | Secure password hashing (Argon2id/bcrypt) | 29, 39 |
| NFR-PROV-01 | Runs fully locally without paid third-party APIs; demo data clearly labeled | 4.17, 25, 40 |
| NFR-PROV-02 | Provider integrity: live only when truly communicating with the external service | 25 |
| NFR-EVID-01 | <a id="AI-EVIDENCE"></a>**AI Evidence Rule** — AI must never fabricate DB records, metrics, reviews, or API responses; missing data reported as missing | 22, 1 |
| NFR-PROV-03 | Provenance labels (Demo/Mock/Estimated/Calculated/External/AI/User) on relevant records | 26 |
| NFR-CLAIM-01 | No unsupported claims: no fake real-time, no fabricated timestamps, no success guarantees | 8, 16, 19 |
| NFR-UI-01 | Modern, clean, responsive SaaS UI; desktop-first, tablet/mobile responsive | 34 |
| NFR-UI-02 | States everywhere: loading, empty, error, success, partial data, demo data, provider unavailable, AI processing | 34 |
| NFR-UI-03 | Consistent design system, centralized brand | 9, 34 |
| NFR-PERF-01 | Expensive operations (competitor analysis, AI analysis, report generation, sync, watchlist refresh) run as background jobs | 37 |
| NFR-COST-01 | Caching, deduplication, request limits, persisted analyses, retry and timeout handling for AI/external calls | 38 |
| NFR-TENANT-01 | Server-side tenant isolation; client-supplied org IDs are untrusted | 28 |
| NFR-MAINT-01 | Minimal, justified dependencies; no premature optimization or abstraction | 4, 47 |
| NFR-DOC-01 | Docs stay in sync with implementation; significant decisions recorded as ADRs | 7, 44 |
| NFR-BUILD-01 | Tests, typecheck, lint, and (where appropriate) production build pass at every phase end | 5, 41, 46 |

## 3. Out of scope for the MVP (explicit)

- Customer shopping cart / checkout / purchasing
- Orders, fulfillment, inventory, shipping management
- Mobile applications, microservices, Kubernetes, event streaming, data warehouses
- Enterprise SSO, complex team permissions, white-label
- Custom per-platform crawlers, advanced ML models, recommendation engines
- Real data-provider integrations (Meta/TikTok/Google ads, Shopify, Amazon) — interfaces only

## 4. Open constraints on requirements

- **Node.js v26.7.0** is installed. The chosen framework's supported Node range must be
  verified at Phase 1 and an LTS pinned via `engines`/`.nvmrc`.
- **No local Postgres client**; Postgres runs in Docker (daemon currently stopped) or Postgres.app.
- **No Stripe CLI**; install before Phase 8 webhook testing.
- **No AI/Stripe keys configured**; demo fallbacks are the default path.
