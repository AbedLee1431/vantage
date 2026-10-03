# Implementation Roadmap

> Phases 0–10 from the master specification (§45). Each phase ends with the GATE 5 checklist
> (§46): tests → typecheck → lint → build → acceptance criteria → docs update → summary → next
> phase. **Implementation does not start until GATE 4 (explicit approval).**

## Status

```
GATES 1–4 (setup, docs, architecture, approval)  ✅ complete
PHASE 0 (foundation audit & toolchain)            ✅ complete — verified
PHASE 1 (foundation)                              ✅ complete — verified
PHASE 2 (discovery)                               ✅ complete — verified
PHASE 3 (ad intelligence)                         ✅ complete — verified
PHASE 4 (AI intelligence)                         ✅ complete — verified
PHASE 5 (customer intelligence)                   ✅ complete — verified
PHASE 6 (competitor monitoring)                   ✅ complete — verified
PHASE 7 (reports)                                 ✅ complete — verified
PHASE 8 (Stripe billing)                          ✅ complete — verified
PHASE 9 (polish)                                  ✅ complete — verified
PHASE 10 (deployment readiness)                     ✅ complete — verified
```

---

## PHASE 0 — Foundation audit & architecture baseline

Inspect the (empty) repository; confirm the baseline; lock the toolchain; create the app
scaffold skeleton config. **No features.**

- Confirm nothing reusable exists (ADR-001); document.
- **Decide the hosting target** (serverless e.g. Vercel vs. containerized Node) — this
  determines whether a persistent worker process is viable and whether in-memory rate limits are
  sufficient (see `docs/Architecture.md` §6, `docs/Security.md` §7). Record as an ADR.
- Pin Node version (`.nvmrc` + `engines`), pnpm, and verify framework compatibility (Node 26 is
  installed; confirm the chosen Next.js version's supported range before pinning).
- Initialize the Next.js + TypeScript project, ESLint, Prettier, Vitest config.
- `docker-compose.yml` for Postgres; verify `docker compose up` works (start Docker Desktop).
- Verify `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test` all run (even with no content).

**Acceptance:** toolchain runs; empty app boots; CI-ready commands exist; hosting target decided;
ADR-001..012 confirmed.

**Verified (Phase 0):** `typecheck` ✔ `lint` ✔ `test` (3/3) ✔ `build` ✔ (routes `/`, `/_not-found`)
· `dev` + `start` both serve HTTP 200 · `format:check` clean · Postgres container healthy and
accepting connections on `localhost:5432` ✔ · CI workflow added (`.github/workflows/ci.yml`).

---

## PHASE 1 — Foundation

- Brand config + design tokens (centralized), app shell, sidebar navigation, top bar
- Prisma schema + initial migration for identity/tenancy/catalog core
- Auth: register, login, logout, password reset (console link in demo), sessions
- Organizations + memberships; default org on signup; **server-side tenant scoping helper**
- Demo seed (fictional brands, all rows `provenance = demo`): stores, products, advertisers,
  ads, reviews, trends, competitors, watchlists, change events, example AI analyses
- Dashboard shell with demo-labeled content; **minimal** landing page (hero + CTA + pricing
  placeholder) — the full marketing page is built out and polished in Phase 9
- Global design-system components + loading/empty/error states

**Acceptance:** app starts; register/login works; dashboard renders seeded demo data; migrations
+ seed are reproducible; tenant scope is enforced; demo data is labeled.

**Verified (Phase 1):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (43/43) ✔ `build` ✔ ·
register/login/logout/reset work (integration tests + live Auth.js session flow via curl) ·
dashboard + settings render with real session data · proxy redirects unauthenticated users ·
migrations (`init`, `watchlist-item-org`) apply cleanly · seed idempotent (wipe + rebuild,
demo org only) · 7 tenant-isolation tests green · all demo rows `provenance=demo`.
Deferred as designed: billing/AI/report/job tables, Radix, example AI analyses in seed (Ph4).

---

## PHASE 2 — Discovery

- Product discovery: search, categories, filters, sorting, detail pages, save, watchlist add
- Store discovery: search, filters, profiles (Overview, Products, Advertising placeholders)
- Global search across products/stores/advertisers/competitors (Postgres text search)
- Trends module: demo-labeled charts + plain-language explanations
- Watchlist basics (create, add/remove items)

**Acceptance:** demo data searchable and filterable; detail pages render; saving/watchlisting
works; cross-org access is impossible.

**Verified (Phase 2):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (67/67) ✔ `build` ✔ ·
products/stores searchable, filterable, sortable, paginated · detail pages + store profiles
render · save/unsave + named watchlists + add/remove work (actions + UI) · global search groups
by type · trends computed with explanations · all demo-labeled · cross-org blocked (extension +
service tests + save/add/remove guards).
**Scope notes:** no schema change (all tables existed); zero new dependencies; REST `/api/*`
discovery routes deferred until a programmatic consumer exists (pages use tested module queries;
ADR-009 style unchanged); Recharts deferred (hand-rolled SVG suffices); example AI analyses
remain Phase 4.

---

## PHASE 3 — Ad intelligence

- Ad schema fields fully wired; advertiser/store linkage; creative detail view
- Filters: platform, advertiser, category, format, duration, date, keyword
- `AdvertisingDataProvider` interface + `DemoAdvertisingProvider` with demo ad dataset
- "No success claims" copy rules enforced in UI (badges for ad status, not performance claims)

**Acceptance:** ads searchable/inspectable; relationships visible; provider abstraction present;
no fabricated real-world claims.

**Verified (Phase 3):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (78/78) ✔ `build` ✔ ·
`/ads` with keyword/platform/advertiser/category/format/duration/date filters + 3 sorts ·
`/ads/[id]` creative detail with provenance + explicit "Performance unknown" ·
`/advertisers/[id]` profiles with stats + ad lists · store profiles show real ads ·
advertiser/store linkage navigable both directions · all demo-labeled · cross-org blocked.
**Scope notes:** one column added (`Ad.durationDays`, computed by seed for DB filter/sort);
zero new dependencies; REST `/api/*` ads routes deferred (same rationale as Phase 2);
AI ad analysis remains Phase 4; no live providers, no scrapers.

---

## PHASE 4 — AI intelligence

- `AIProvider` interface + `DemoAIProvider` + `OpenAICompatibleProvider`
- AI ad analysis (Hook/Problem/Promise/Offer/Structure/CTA/Audience/Angle) as a job
- Competitor analysis (11 sections, evidence-tagged) as a job
- AI Analyst chat with the **tool layer** (tenant-scoped, evidence-only) and streaming
- Analysis persistence + cache-by-promptHash; AI usage tracking; timeouts/retries/budgets
- Evidence/interpretation/assumption rendering components

**Acceptance:** works with a configured AI provider; gracefully degrades to labeled Demo AI;
AI cannot fabricate records; repeat analyses hit cache; usage is metered.

**Verified (Phase 4):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (108/108) ✔ `build` ✔ ·
DemoAIProvider (default, zero-config) + OpenAICompatibleProvider (env-gated, mocked tests) ·
ad analysis (8 sections) + competitor analysis (11 sections) as jobs with cache-by-promptHash ·
analyst chat with 10 tenant-scoped tools + SSE streaming + persisted history ·
citation verification drops unverifiable refs (R4) · usage derived (no UsageRecord table) ·
cross-org/tools/auth/rate-limit all enforced and tested.
**Scope notes:** zero new npm dependencies (built-ins only); 4 tables added (AiAnalysis,
AiConversation, AiMessage+org, Job); UsageRecord deferred to Ph8; live provider never called
without keys (tests use mocks); example analyses still flow through jobs, not seed.

---

## PHASE 5 — Customer intelligence & opportunities

- Reviews via `ReviewDataProvider` + demo dataset; sentiment and theme extraction
- Positive/negative themes, complaints, feature requests, pricing/shipping/quality concerns
- AI summaries of recurring pain points
- Market-gap analysis → Opportunity records (Evidence, Confidence, Differentiation…)

**Acceptance:** review insights computed and clearly sourced; opportunities are hedged and
evidence-linked; no fabricated reviews.

**Verified (Phase 5):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (128/128) ✔ `build` ✔ ·
ReviewDataProvider + Demo impl; live sentiment/theme/pain-point computation (pure, unit-tested) ·
review exploration with filters; AI pain-point summaries (job + cache); gap analysis → hedged
Opportunity rows with evidence (dedupe, archive/restore); analyst answers complaint/opportunity
questions from tools; cross-org/tools/auth/rate-limit enforced.
**Scope notes:** one table added (Opportunity) + enum extensions; NO ReviewInsight table
(live computation suffices); zero new dependencies; ADR-015 (fail-closed isolation) after a
test-caught cross-org leak; live provider never called without keys.

---

## PHASE 6 — Competitor monitoring

- Watchlist dashboard per entity; change timeline; alert model + acknowledgment
- `ChangeEvent` types: new/removed product, new ad, ad activity, price, landing page, review
- Change detection from seeded data + manually triggered sync jobs (background)
- Extension point documented for future automated monitoring (no real-time claims)

**Acceptance:** changes surface on watchlists; alerts work; sync jobs run without blocking HTTP;
copy explicitly avoids "real-time" claims.

**Verified (Phase 6):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (136/136) ✔ `build` ✔ ·
monitoring dashboard (stats, sync status, alerts inbox + acknowledgment, filterable timeline,
lists) · catalog sync job detects real diffs only (empty on static data, deduped, baselined) ·
alerts with watchlist-priority severity · cross-org/tools/auth/rate-limit enforced ·
copy states manual-only, never real-time/scraped.
**Scope notes:** two tables added (Alert, SyncState) + enum extensions; zero new dependencies;
no AI summaries (not required — analyst covers changes via tools); no simulation gimmicks;
ADR-015 enforced throughout (one test-caught gap fixed + regression test).

---

## PHASE 7 — Reports

- Report generation (background job): all sections + sources + timestamps + provenance
- Web view, CSV export per section, PDF export if practical
- Report history with per-org authorization

**Acceptance:** reports generate and render; CSV export works; cross-org report access denied.

**Verified (Phase 7):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (144/144) ✔ `build` ✔ ·
7 report types with frozen snapshots + AI summaries + evidence refs · web view with print
styles · per-section CSV from snapshots · history with type filter + delete flow ·
cross-org/auth/validation enforced · all demo-labeled.
**Scope notes:** one table added (Report); zero new dependencies; PDF via browser print
(ADR-016, no server stack); reports are historical records (reruns create rows, no cache).

---

## PHASE 8 — Stripe billing

- Central plan config (FREE/PRO limits); pricing page wired to it
- Stripe test checkout, customer creation, subscription creation
- Signature-verified webhooks → subscription status sync, **including downgrade/cancellation**
  (subscription deleted/expired → revert to FREE) and **usage-counter reset at period boundary**
- Usage meters + server-side limit enforcement; billing page with usage/remaining/plan/reset

**Acceptance:** checkout lifecycle works in test mode; webhooks update state; limits block
over-use server-side with a friendly UI nudge.

**Verified (Phase 8):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (167/167, +23 billing) ✔
`build` ✔ · central plan config (FREE/PRO, no price IDs in client code) · server-side
checkout (price picked by server, customer reuse, 409 when already PRO) · portal sessions ·
signature-verified webhooks (raw body, idempotent ledger, unknown events acked, replays
no-op) with lifecycle sync incl. downgrade/cancel revert + past_due grace · entitlements
layer (`active`/`trialing` full PRO, `past_due`/`incomplete` grace + nudge,
`unpaid`/`incomplete_expired`/`canceled` effective FREE) · monthly quotas enforced
server-side (429 + upgrade hint) on AI/competitor/report routes, searches tracked ·
/billing + /pricing pages, dashboard plan widget, topbar plan badge · demo mode fully
usable with no keys (503 checkout, explicit "not configured" states, never fake charges).
**Scope notes:** one migration (`billing-subscriptions`: Subscription, UsageRecord,
StripeWebhookEvent); one dependency (`stripe` 22.6.2, ADR-017); no `Plan` table
(config instead); usage periods are calendar months; live Stripe checkout/webhook
delivery requires test-mode keys + CLI (mock-tested, see report).

---

## PHASE 9 — Polish

- Responsive pass (tablet/mobile), loading/empty/error/partial/demo states audit
- Accessibility pass (keyboard, ARIA, color-contrast)
- **Full landing-page build-out** (features, workflow, FAQ, footer) + SEO; performance pass;
  navigation and onboarding improvements
- Light Playwright E2E for the top flows
- Remove dead code and unnecessary dependencies

**Acceptance:** full suite green; production build passes; no dead dependencies.

**Verified (Phase 9):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (167/167) ✔ `build` ✔ ·
full landing page (hero, pillars, features, workflow, trust, FAQ, CTA) + SEO metadata ·
MarketingFooter with product/legal links · dashboard + root loading states ·
dead code removed (StatCardSkeleton, Brand type, unused BarChart3 import) ·
responsive + a11y audited (existing patterns already strong — no regressions).
**Scope notes:** Playwright E2E deferred (no new dependency for 3 flows); no dead
dependencies found; no nav/onboarding changes needed (already clean).

---

## PHASE 10 — Deployment readiness

- Production env/config documentation; migration + deployment runbooks
- Stripe webhook setup instructions; AI provider configuration docs
- Error logging strategy; security review; final production build
- **Do not auto-deploy** unless explicitly requested

**Acceptance:** deployment is documented and reproducible; security review complete; build green.

**Verified (Phase 10):** `format` ✔ `typecheck` ✔ `lint` ✔ `test` (167/167) ✔ `build` ✔ ·
health check endpoint (`GET /api/health`) · multi-stage Dockerfile + .dockerignore ·
environment validation module (`src/lib/env.ts`) · security headers (X-Content-Type-Options,
X-Frame-Options, Referrer-Policy, Permissions-Policy) · CI/CD workflow (`.github/workflows/ci.yml`) ·
deployment documentation (`docs/Deployment.md`) · all docs updated (Architecture, Security, Roadmap).
**Scope notes:** no production deployment performed; no live Stripe credentials used; no DNS changes.

---

## Cross-phase rules

- **Never start the next phase with a red gate** (§46).
- **Docs sync within the phase** that changes behavior (§7).
- **New dependency or major change ⇒ ADR first** (§44).
- **No future-phase work leaks in early** (§47): monitoring automation, live data providers,
  agency workspaces, SSO, white-label, and PDF (if impractical) are explicitly deferred.
