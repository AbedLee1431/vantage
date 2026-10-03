# Decisions — ADRs, Ambiguities & Contradictions

> Architecture Decision Records (spec §44). New dependency or major architecture change ⇒ add an
> ADR **before** implementing. Items below marked PROPOSED stand until GATE 4 approval.

**ADR template:** Problem → Options → Selected → Reason → Tradeoffs → Consequences

---

## ADR-001 — Fresh implementation; the demo-store repo is not used

**Problem.** The master spec (§3) frames `chec/commercejs-nextjs-demo-store` as the starting
repository and invites reuse of its UI/styling/layout.

**Findings (verified).**
- The working tree contains **no application code** — only `AGENTS.md`, docs, `.gitignore`,
  `.env.example`, and a pre-existing personal Obsidian vault (`TrendTrack/`).
- The GitHub repo exists: `chec/commercejs-nextjs-demo-store`, **BSD-3-Clause**, **archived**
  (last push 2024-01-29), JavaScript, and built on **commerce.js** (a paid commerce SaaS API) for
  a storefront use case.

**Options.** (a) Clone and strip it; (b) clone selectively; (c) fresh implementation.

**Selected: (c) fresh implementation.**

**Reason.** Nothing is present to reuse locally; the repo is archived and commerce-oriented;
its storefront architecture (cart/checkout/orders) is explicitly out of scope; reuse would
import a paid-vendor dependency and a Pages-era Next.js structure that conflicts with our
requirements. BSD-3 permits reuse with attribution, but there is **no demonstrated benefit**
against the "don't preserve code merely because it exists" principle.

**Tradeoffs.** Slower initial progress; zero licensing/branding contamination.

**Consequences.** The app is a greenfield build; all modules are implemented to our spec; the
referenced repo must not be cloned or copied.

---

## ADR-002 — Next.js (App Router) + TypeScript as the single application

**Problem.** Choose the web framework.

**Options.** Next.js App Router; Remix; SvelteKit; separate API + SPA.

**Selected: Next.js (App Router, React Server Components) + TypeScript (strict).**

**Reason.** RSC + Route Handlers + Server Actions in one app; mainstream hiring/maintainability;
matches the ecosystem around Prisma/Auth.js/Stripe; SSR helps the landing page SEO. TypeScript
end-to-end reduces the class of bugs the spec's tests target.

**Tradeoffs.** App Router is newer than Pages (the archived demo used Pages); build complexity.

**Consequences.** One deployable unit; no separate API service in the MVP.

---

## ADR-003 — PostgreSQL via Prisma

**Problem.** Datastore for a multi-tenant SaaS (spec §27).

**Options.** Postgres + Prisma; Postgres + Drizzle; MySQL/Prisma; SQLite for dev.

**Selected: PostgreSQL 15+ with Prisma ORM.**

**Reason.** Spec §27 requires a mainstream relational DB if none exists (none does). Postgres is
the SaaS default. Prisma gives typed queries, migration story, and seeding that keep the "lean
but safe" balance; broad familiarity.

**Tradeoffs.** Prisma adds a generator + some query overhead vs raw/Drizzle; acceptable for MVP.

**Consequences.** `prisma migrate` is the migration path; a tenant-scoped extension injects
`organizationId` on every query.

---

## ADR-004 — Auth.js (NextAuth v5) credentials provider + custom Organization/Membership

**Problem.** Email/password auth + orgs/memberships, self-hosted, no vendor lock-in (spec §28, §29).

**Options.** Auth.js credentials; Clerk; Supabase Auth; hand-rolled sessions.

**Selected: Auth.js v5, credentials provider, Argon2id hashing, custom Organization/Membership tables.**

**Reason.** Self-hosted (no paid vendor, no lock-in); satisfies email/password + sessions +
protected routes; pairs with Prisma adapter; keeps auth inside our codebase for full control of
the membership model.

**Tradeoffs.** More code than Clerk; we own password-reset/email plumbing (console link in demo).

**Consequences.** `AUTH_SECRET` required; reset tokens are signed, single-use, time-limited.

---

## ADR-005 — AIProvider abstraction; OpenAI-compatible client + labeled Demo fallback

**Problem.** Avoid AI vendor lock-in (spec §23) and remain usable with no key (spec §4.17).

**Options.** Native SDK per vendor; LangChain; hand-rolled interface over OpenAI-compatible HTTP.

**Selected: `AIProvider` interface with `DemoAIProvider` + `OpenAICompatibleProvider` (HTTP).**

**Reason.** A single OpenAI-compatible HTTP client serves OpenAI, OpenRouter, and local servers
via `AI_BASE_URL` — maximum coverage with one implementation. The Demo provider is explicitly
named and labeled, satisfying the provider-integrity rule (§25).

**Tradeoffs.** No SDK conveniences (streaming/tool parsing done by us); acceptable and explicit.

**Consequences.** AI modules degrade to "Demo AI" when unconfigured; every AI row records
provider + model + provenance.

---

## ADR-006 — Data-provider interfaces with Demo-only implementations for the MVP

**Problem.** Must not couple to one data vendor (§24) and must not fake external data (§25).

**Selected: Define `Product/Store/Advertising/Review` provider interfaces; ship only Demo
implementations; implement NO live provider in the MVP.**

**Reason.** If no external-fetching code exists, invented data can never be dressed as external
data. Live providers slot in later behind the same interface with an ADR + `DataSource`
provenance rows.

**Tradeoffs.** The MVP is demo-data-only — clearly labeled; this is acceptable per §4.17.

**Consequences.** All catalog rows carry `provenance`; the UI shows a "Demo provider in use"
badge where relevant.

---

## ADR-007 — DB-backed jobs + lightweight worker; no distributed queue

**Problem.** Expensive work (analysis, reports, sync) must not block HTTP (§37), without
over-engineering (§47).

**Selected: `Job` table + worker (separate `pnpm worker` process, or in-process runner for dev);
enqueue/dequeue behind a thin interface.**

**Reason.** A job table gives durability, status, retry, and observability for ~zero
infrastructure. The thin interface keeps a real queue (Inngest/QStash/SQS) a drop-in later.

**Tradeoffs.** Worker process must be run alongside the app in production; acceptable for MVP.

**Consequences.** Long endpoints return `202 { jobId }`; the client polls job status.

---

## ADR-008 — Stripe Checkout + Customer Portal + verified webhooks

**Problem.** SaaS subscriptions (spec §30) with centralized plan config (§31).

**Selected: Stripe-hosted Checkout + Portal; signature-verified webhooks; plan limits in one
central config file; usage meters enforced server-side.**

**Reason.** Least PCI surface; webhooks are the source of truth for subscription state; a single
config removes hard-coded pricing.

**Tradeoffs.** Less custom checkout UX; fine for FREE/PRO.

**Consequences.** Billing endpoints are "not configured" (not crashy) until Stripe keys exist.

---

## ADR-009 — Route Handlers + Zod + Server Actions; no tRPC/GraphQL

**Problem.** API surface style (spec §36/API-Specification).

**Selected: REST-ish Route Handlers with Zod validation, plus Server Actions for mutations.**

**Reason.** Mainstream, minimal dependencies, no extra build/babel config; RSC + Server Actions
already cover most reads/mutations with end-to-end TS safety.

**Tradeoffs.** No automatic type-safe client like tRPC; we keep the surface small and consistent.

---

## ADR-010 — Tailwind CSS + Radix primitives; brand centralized in one config + tokens

**Problem.** A professional analytics UI that can be renamed cheaply (spec §9, §34).

**Selected: Tailwind + Radix UI primitives + lucide-react + Recharts; brand strings in one
`brand` module, tokens in one theme file.**

**Reason.** Utility-first + tokens satisfy "centralized branding, two-file rename"; Radix gives
accessibility primitives without a heavy component-kit dependency.

**Tradeoffs.** We build/maintain a small set of components ourselves; acceptable (no big kit).

---

## ADR-011 — Deployment target: Vercel (primary), containerized Node (fallback)

**Problem.** Phase 0 must settle the hosting target because it shapes the background-job model
(`Architecture.md` §6) and the rate-limiting strategy (`Security.md` §7).

**Options.** (a) Vercel serverless for the web app; (b) containerized Node (Railway/Fly/Render/
VPS) with a persistent worker; (c) hybrid — web app on Vercel, worker in a container.

**Selected: Vercel as the primary target for the web app, with the architecture kept portable.**

- **Jobs:** in dev, an in-process runner; in production, a **cron-triggered Route Handler**
  processes a bounded batch of queued jobs per tick, behind the **same** thin enqueue/dequeue
  interface — so no job code changes between environments.
- **Rate limits & caching:** backed by **Postgres, not Redis** and never in-memory, so behavior is
  identical for one instance, many instances, or serverless cold starts. No new dependency.
- **No Vercel-specific APIs** in application code. A containerized Node deployment (web + worker
  process) remains a documented fallback, reachable by changing deployment config only.

**Reason.** Lowest operational burden for a lean MVP; Vercel is the canonical Next.js host;
Postgres-backed limits/caches avoid a Redis dependency and behave correctly under serverless.
Choosing portability over Vercel-only features (Edge Config, KV, etc.) preserves the fallback.

**Tradeoffs.** Cron-driven job processing has tick-granularity latency (target: every minute)
instead of immediate execution; serverless function duration caps force job handlers to be
**idempotent, short, and time-boxed**; DB-backed counters add a write per limited action.

**Consequences.** Job handlers must chunk work and stop before the function timeout; the runner
interface (ADR-007) is the seam; CI/CD via Vercel with `pnpm build` verified locally each phase.

---

## ADR-012 — Toolchain pinning: TypeScript 6.0.3 / ESLint 9.39.5, not the absolute latest

**Problem.** The registry's latest TypeScript is 7.0.2 and ESLint 10.11.0, but Phase 0 must lock
versions that actually resolve.

**Findings (empirical).** Installing `typescript@^7` + `eslint@^10` produced hard peer conflicts:
`eslint-config-next@16` pulls `typescript-eslint@8.71.0` (peer `typescript <6.1.0`) and
`eslint-plugin-{import,jsx-a11y,react}` (peer `eslint ^9`). Additionally, the `@eslint/eslintrc`
`FlatCompat` shim crashes on `eslint-config-next@16`'s native flat configs ("converting circular
structure to JSON").

**Options.** (a) Latest-of-everything and drop `eslint-config-next`; (b) pin the newest
ecosystem-compatible versions; (c) pin older LTS versions.

**Selected: (b) TypeScript `^6.0.3`, ESLint `^9.39.5`, and native flat-config imports of
`eslint-config-next` (no FlatCompat).**

**Reason.** Keeps the curated, battle-tested `eslint-config-next` ruleset (core-web-vitals +
typescript) with zero peer violations, on the newest versions that actually satisfy every peer.
ESLint 9 is in maintenance upstream (hence the deprecation notice), which is acceptable and
preferable to a broken lint pipeline.

**Tradeoffs.** Not bleeding-edge; the ESLint 9 deprecation warning will appear on install until
`eslint-config-next` ships ESLint 10-compatible plugins.

**Consequences.** Upgrade is a future task (re-run `pnpm view … peerDependencies`, bump, verify
gates). Recorded so the "why aren't we on TS 7?" question has an answer. Node is pinned by
`engines: >=20.9.0` (Next's floor; local 26.7.0 ✔) with `.nvmrc: 22` for CI.

---

## ADR-013 — No `server-only` package; enforcement via bundler + R2 ban + identity module

**Problem.** The `server-only` package throws in plain Node, breaking the tsx seed script and
vitest suites that legitimately import server modules. But Architectural Invariant #1 requires
client bundles to never contain server code (secrets, DB).

**Options.** (a) Keep `server-only` and duplicate server logic for seed/tests; (b) remove it and
enforce the invariant structurally.

**Selected: (b).** Removed the dependency. Three-layer enforcement replaces it:
1. The Next.js bundler fails the build if Client Components import Node-only modules
   (pg, argon2, next-auth server) — automatic backstop.
2. The R2 ESLint ban (broadened to `**/db/client` after it missed relative imports) forbids
   base-Prisma imports outside `src/server/db` — fails lint, which GATE 5 requires.
3. `src/server/db/identity.ts` owns ALL identity data access, so application modules never need
   the base client; tenant data goes exclusively through `tenantDb()`.

**Reason.** `server-only` is incompatible with Node-based tooling. The replacement covers the
same invariant with zero dependencies and keeps seed/tests able to import server code.

**Tradeoffs.** The explicit gate is lint (not build) — but lint is mandatory per phase, and the
bundler catches Node-dep leaks at build time regardless.

**Consequences.** No `server-only` in the tree. R2 pattern broadened. Identity queries centralized
for auditability.

---

## ADR-014 — Job execution: lazy processing via explicit trigger + poll (no worker process)

**Problem.** ADR-007/011 promise background jobs without a distributed queue, but Phase 4 needs
a concrete execution trigger that works on Vercel serverless (no persistent processes) and
locally, without new infrastructure.

**Options.** (a) Persistent worker process; (b) synchronous processing inside the request;
(c) enqueue + lazy execution on explicit trigger + poll.

**Selected: (c).** `POST analyze` checks cache, else creates a queued Job and returns 202 + jobId
(non-blocking, satisfies FR-COMP-04). The client calls `POST /api/jobs/process` (session: own
org, limit 5; cron secret: all orgs, limit 10), then polls `GET /api/jobs/:id` (pure read,
includes the result when done). Status transitions are atomic (`queued → running` only if still
queued), so cron + poll races resolve to no-ops, never double-processing.

**Reason.** Zero infrastructure (no worker, no Redis, no cron required for MVP correctness);
works identically serverless and local; Job rows still give full history, retry, and audit;
the thin seam from ADR-007 is preserved for a real queue later. Demo jobs complete in
milliseconds; live-model slowness surfaces as honest polling, not timeouts.

**Tradeoffs.** Work executes inside HTTP requests (process endpoint), not true background —
documented; long live-model calls are bounded by function timeouts. GET polling is chatty
(1.5s interval, 90s cap).

**Consequences.** `src/server/jobs/runner.ts` + `src/server/db/jobs.ts` own the pattern;
`CRON_SECRET` wires Phase 10 cron without code changes.

---

## ADR-015 — Fail-closed tenant isolation (explicit model registry, no silent passthrough)

**Problem.** Phase 5 testing caught `Opportunity` queries resolving cross-tenant rows: the
extension passed through any model not in its allowlist, so a forgotten table failed OPEN
(silent leak) instead of closed.

**Options.** (a) Remember to register every table (discipline only); (b) invert to default-scope
with an identity allowlist; (c) explicit TENANT + IDENTITY sets, throw on anything else.

**Selected: (c).** TENANT models inject `organizationId`; IDENTITY models
(User/Organization/Membership/PasswordResetToken/RateLimit) throw directing to
`server/db/identity`; UNREGISTERED models throw. Adding a table without registering it can only
break queries visibly in dev/tests — never leak rows. A regression test asserts identity access
via tenant clients throws.

**Reason.** Security boundaries must not depend on memory. Explicit registration + loud failure
is the only posture where the failure mode is always safe.

**Tradeoffs.** New tables require a one-line registry entry (enforced by tests failing loudly
until added); marginally more code than a single set.

**Consequences.** `TENANT_MODELS`/`IDENTITY_MODELS` in `src/server/db/tenant.ts` are
security-critical — review changes to either with suspicion. `AiMessage` gained a direct
`organizationId` (migration) so every tenant row carries its owner uniformly.

---

## ADR-016 — Report export: browser print/PDF + server CSV (no document stack)

**Problem.** FR-RPT-02 requires web view, CSV export, and PDF "if practical". Server-side PDF
needs a document engine (puppeteer/Chromium, pdfkit layout code, or a SaaS API) — heavy,
slow, and hostile to serverless.

**Options.** (a) Puppeteer/Chromium server rendering; (b) pdfkit/jsPDF manual layout;
(c) browser print stylesheet + Save-as-PDF plus server CSV; (d) CSV only.

**Selected: (c).** Print-optimized CSS (`@media print`: chrome-free, expanded disclosures,
ink-safe) with a Print button, plus per-section CSV generated server-side from frozen
snapshots. Zero new dependencies, zero server load, pixel-consistent with the web view
(better fidelity than a parallel PDF layout that would drift).

**Reason.** The spec makes PDF conditional ("if practical"); (a)/(b) violate lean-MVP rules
for a feature browsers do natively. CSV covers tabular data portability; print covers
human-readable export.

**Tradeoffs.** No single-click server PDF file; output depends on the user's browser print
dialog. Acceptable for MVP; revisit if customers demand server-generated PDFs.

**Consequences.** No document infrastructure added. CSV contract: RFC 4180, snapshot-frozen,
per tabular section. Print styles live in `globals.css`.

---

## ADR-017 — Phase 8 billing design (Stripe SDK, config plans, calendar-month quotas)

**Problem.** Phase 8 needs subscriptions + quotas without over-engineering (§47):
plan storage (DB table vs config), usage reset mechanics, canceled/grace
semantics, and a Stripe SDK that moved on since the spec was written.

**Options.** (a) `Plan` DB table + `Subscription` + `UsageRecord`; (b) plans as
central code config + `Subscription` + `UsageRecord`; (c) full Stripe-sync
(entitlements mirrored per webhook into a rules table).

**Selected: (b), plus a `StripeWebhookEvent` idempotency ledger.**

- **Plans are code config** (`src/lib/billing/plans.ts` — FREE/PRO, features,
  limits, display prices; Stripe price IDs from env). The `Plan` table from the
  early `Database.md` sketch is deliberately NOT created: a table adds
  seeding/sync chores for data that changes by deploy, not by user action.
  One config file is the "centralized, non-hard-coded" requirement (FR-BILL-01).
- **New dependency: `stripe` (22.6.2).** Justified — signature verification
  and Checkout/Portal must use the official SDK. No other new dependencies.
- **Usage periods are calendar months** (`YYYY-MM` period key; a new
  `UsageRecord` row per month = automatic reset, no cron). Subscription
  `currentPeriodEnd` from Stripe drives display/renewal copy only.
- **Lifecycle grace:** `active`/`trialing` → full PRO; `past_due`/`incomplete`
  → PRO retained + portal nudge; `unpaid`/`incomplete_expired`/`canceled` →
  effective FREE (webhook reverts the row; entitlement layer enforces even if
  the webhook is delayed). `cancel_at_period_end` → PRO until period end.
- **Stripe API v22 shapes:** period dates moved from the subscription root to
  `items.data[0].current_period_start/end`; invoice subscription refs moved to
  `parent.subscription_details`. Handlers read defensively (record helpers with
  legacy fallbacks) so payload evolution degrades gracefully.
- **Searches are tracked, not hard-blocked** (generous FREE 200/mo); AI,
  competitor, and report quotas return 429 + upgrade hint.

**Reason.** Smallest schema that satisfies FR-BILL-01…06; every choice keeps
Stripe as the payment record and the local DB as the authorization cache.

**Tradeoffs.** Plan changes require a deploy (acceptable for two MVP plans);
calendar-month quotas can differ from Stripe anniversaries by days (documented
in-product as "usage resets monthly").

**Consequences.** Tables: `Subscription`, `UsageRecord`, `StripeWebhookEvent`
(all in migration `billing-subscriptions`). `Subscription`/`UsageRecord` join
`TENANT_MODELS`; webhook events stay global (no session) via base-client
helpers in `src/server/db/billing.ts`.

---

## Ambiguities & contradictions register

| # | Issue in the master spec | Resolution |
|---|--------------------------|------------|
| A1 | §2/§3 assume the repo **is** the demo store; the working tree is empty (only an Obsidian vault). | ADR-001: fresh implementation; do not clone the referenced repo. |
| A2 | §9 forbids "TrendTrack" branding, yet the repo folder is `Trendtrack` and it contains an Obsidian vault (`TrendTrack/`). | Working name **"Vantage"**; the folder/vault are unrelated to product identity and are explicitly excluded from branding. |
| A3 | §25 forbids fake providers, while §4.17/§24 require the app to run without paid APIs. | Clearly named **Demo/Mock** providers with labels; interfaces and demo code kept separate; no live provider ships in the MVP (ADR-006). |
| A4 | AI features need a model, but the app must be usable with no AI key. | Non-AI modules fully demo-functional; AI modules run in explicitly labeled **Demo AI** mode when unconfigured (ADR-005). |
| A5 | §10 lists 14 modules while §47 says don't overbuild. | All modules ship but each stays lean; sequencing in `docs/Roadmap.md`. |
| A6 | §32 "PDF export if practical" — uncertain feasibility. | Web + CSV in scope; PDF evaluated in Phase 7, dropped if impractical (documented then). |
| A7 | §20 monitoring architecture vs "don't claim real-time". | Change detection from seeded/triggered jobs only; copy explicitly avoids real-time claims; automation is an extension point. |
| A8 | §36 "global search where practical" vs avoiding complex search infra. | Postgres text search for the MVP; no dedicated engine. |
| A9 | §29 "password reset where practical" + no email provider configured. | Signed-token reset; link logged to server console in dev; pluggable `NotificationProvider` later. |
| A10 | GATE 1 references **ponytail** and graphify. | **Resolved:** graphify CLI + OpenCode skill + project plugin wired; ponytail installed as an OpenCode plugin (`@dietrichgebert/ponytail` 4.10.0). Both load at session start. See `AGENTS.md` §11. |
| A11 | Node v26.7.0 installed; framework-supported range unknown until we pick a version. | Pin an LTS via `.nvmrc`/`engines` in Phase 0/1 and verify compatibility then (spec §4 environment note). |
| A12 | Docker installed but daemon not running; no local `psql`; no Stripe CLI. | Documented prerequisites; Postgres via Docker (daemon must be started) or Postgres.app; Stripe CLI installed before Phase 8. |

---

## GATE 3 — Final architecture review (record)

**Evidence gathered:** the referenced demo store's `package.json` and root tree were inspected
remotely. It is **Next.js 11 (Pages Router), React 17, Redux + next-redux-wrapper, JavaScript
(no TypeScript), SCSS, Swiper/Lottie, `@chec/commerce.js` (paid commerce SDK), Chec seeder,
Netlify plugin, `yarn.lock`** — and no database of its own (commerce.js *is* its data backend).

**Reuse verdict (ADR-001 ratified):** no meaningful benefit. Every candidate reuse target is
coupled to the wrong thing — components are bound to Chec product shapes, state is a cart/Redux
store, styling is SCSS (we use Tailwind), there is no auth/tenancy layer, and adopting any of it
imports a **paid third-party vendor dependency** and a deprecated architecture. Even
"styling/layout patterns" transfer poorly because the design system differs. Fresh implementation
confirmed; the repo must not be cloned.

**Full-stack coverage check:** all Master Prompt concern areas verified against the proposed
architecture — multi-tenancy, authn/authz, AIProvider abstraction, demo/mock provenance,
data-provider abstraction, AI evidence grounding, Stripe billing, usage limits, background jobs,
caching, security, testing, reporting, monitoring/watchlists, and Phases 0–10. **No gaps found;
no requirement is unaddressed.** Coverage details live in the matching `docs/` files and the
FR/NFR traceability matrix in `docs/Requirements.md`.

**Review refinements applied (documentation-only):**

| # | Refinement | Where |
|---|------------|-------|
| R1 | Hosting target (serverless vs container) decided in **Phase 0** — it gates the worker process model and rate-limit strategy | `Roadmap.md` Ph0, `Architecture.md` §6, `Security.md` §7 |
| R2 | Tenant scope enforced by **ESLint import ban**, not convention (a Prisma extension only protects the extended client) | `Architecture.md` §3 |
| R3 | **One org per user** in the MVP; switcher is an extension point — removes active-org state bugs | `Architecture.md` §3 |
| R4 | AI responses get **citation validation** — uncited interpretation is dropped/flagged before rendering | `Security.md` §9 |
| R5 | Phase 8 must handle **downgrade/cancellation** and **usage reset at period boundary** | `Roadmap.md` Ph8 |
| R6 | Landing page is **minimal in Phase 1**, full build-out in Phase 9 — keeps Ph1 on the Master's acceptance criteria | `Roadmap.md` Ph1/Ph9 |
| R7 | Auth.js credentials provider mandates **JWT sessions**; `AUTH_SECRET` rotation invalidates sessions | `Integrations.md` |
| R8 | In-memory rate limits are **single-instance only**; DB-backed counters if multi-instance | `Security.md` §7 |

**Sequencing note (intentional, not a gap):** usage *counting* begins in Phase 4 (AI usage
tracking) while *enforcement* arrives in Phase 8 (billing). Phases 4–7 ship without quotas by
design — there is nothing to bill against yet. This is acceptable because the app is
self-hosted/demo during that window; if external users are onboarded earlier, Phase 8 must move
up.

**Conclusion:** the architecture is appropriate for a lean, chargeable MVP. It introduces no
distributed queue, search engine, microservices, or vendor lock-in; every abstraction that exists
is spec-mandated (provider/AI interfaces, jobs) or a standard SaaS primitive (org scoping, Zod,
webhooks). Ready for GATE 4.
