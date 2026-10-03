# Architecture

> **Status: IMPLEMENTED (Phases 0–10 complete).** This document is the architecture baseline;
> significant changes must be recorded as ADRs in `docs/Decisions.md`.

## 1. Technology stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js (LTS pinned via `engines`/`.nvmrc`) | Single language across server/client |
| Package manager | pnpm | Installed, fast, disk-efficient, good workspace support |
| Framework | Next.js (App Router, RSC) | SSR + API routes + RSC in one app; mainstream for SaaS |
| Language | TypeScript (strict) | Type safety end-to-end; maintainability |
| Database | PostgreSQL 15+ (Docker locally) | Mainstream relational DB for multi-tenant SaaS (spec §27) |
| ORM | Prisma | Typed queries, migrations, seeding; mainstream DX |
| Auth | Auth.js v5 (credentials provider) | Self-hosted, no vendor lock-in, email/password (spec §29) |
| Validation | Zod | Shared client/server schemas |
| UI | Tailwind CSS + Radix UI primitives + lucide-react | Composable, accessible, token-driven (centralized brand) |
| Charts | Recharts | Simple, React-native; trends module |
| Billing | Stripe (Checkout + Customer Portal + webhooks) | Required by spec §30 |
| AI | OpenAI-compatible HTTP client behind `AIProvider` | Provider-agnostic (spec §23) |
| Jobs | DB-backed `Job` table + worker | Spec §37: no distributed queue unless needed |
| Testing | Vitest + React Testing Library | Fast unit/integration; spec §41 |
| Quality | ESLint + Prettier + `tsc --noEmit` | Spec §46 gate-5 checks |

**Resolved versions (Phase 0, ADR-012):** Next 16.3.7 · React 19.3 · TypeScript 6.0.3 · ESLint
9.39.5 · Vitest 5.0.2 · Prettier 3.9.9. Node `>=20.9.0` (`engines`), local 26.7.0, `.nvmrc` pins
22 for CI. These are the newest versions that satisfy every peer dependency (ADR-012).

**Phase 1 additions:** Prisma 7.10.0 + `@prisma/adapter-pg`/`pg` (driver adapter is mandatory in
v7) · `next-auth@5.0.0-beta.32` (Auth.js v5, credentials only, **no Prisma adapter** — JWT
sessions need none) · `@node-rs/argon2` (Argon2id) · Zod 4 · Tailwind 4 + `@tailwindcss/postcss`
· `lucide-react` · `clsx` + `tailwind-merge` · `tsx` + `dotenv` (seed runner) · testing:
RTL + jest-dom + jsdom + `@vitejs/plugin-react`.

**Deliberately excluded for the MVP:** tRPC/GraphQL (ADR-009), a dedicated search engine
(Postgres text search suffices), message brokers, microservices, containers orchestration.

## 2. System architecture

Single Next.js application, strictly layered to keep server-only code out of client bundles:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT (browser)                              │
│   React components · Tailwind design system · React Query (cache)    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  HTTPS (validated, session-authenticated)
┌───────────────────────────────▼──────────────────────────────────────┐
│                    NEXT.JS APPLICATION                               │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ App Router │  │ Route        │  │ Server Actions               │  │
│  │ (pages/RSC)│  │ Handlers/API │  │ (form mutations)             │  │
│  └────────────┘  └──────────────┘  └──────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Application layer (server-only): services, authorization, usage │ │
│  │   • tenant scope from session (never client orgId)              │ │
│  │   • Zod validation on every boundary                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────┐  ┌────────────────────┐  ┌────────────┐   │
│  │ AI providers          │  │ Data providers     │  │ Job runner │   │
│  │ AIProvider interface  │  │ *Provider iface    │  │ (Job rows) │   │
│  │  ├ DemoAIProvider     │  │  ├ Demo*Provider   │  │            │   │
│  │  └ OpenAI-compatible  │  │  └ (future: live)  │  │            │   │
│  └───────────────────────┘  └────────────────────┘  └────────────┘   │
└──────────────┬───────────────────────────┬───────────────────────────┘
               │                           │
   ┌───────────▼──────────┐    ┌───────────▼──────────────┐
   │  PostgreSQL + Prisma │    │  External (server-side)  │
   │  (tenant-scoped)     │    │  Stripe · AI endpoint    │
   └──────────────────────┘    └──────────────────────────┘
```

### Layering rule

```
src/app         → routes/pages only; no business logic
src/modules/*   → feature services; the ONLY place business logic lives
src/server/*    → db, auth, jobs, provider implementations (server-only import)
src/lib         → pure utilities + provider interfaces + brand config
src/components  → presentational + design-system components
```

Server Actions live in `src/modules/*` (`"use server"`) and are imported by pages.
Identity data access lives in `src/server/db/identity.ts`; tenant data exclusively
through `tenantDb()` (ADR-013). Auth splits into `src/server/auth.ts` (full,
Node-only: Credentials + DB + argon2) and `src/server/auth-edge.ts` (minimal,
Edge-safe JWT verification for `src/proxy.ts` — Next 16 renamed middleware to proxy).

## 3. Multi-tenancy architecture

```
User ──< Membership >── Organization ──< tenant-owned entities
```

- Session contains `userId`; the **active organization is resolved server-side** from memberships.
- **MVP scope: exactly one organization per user, auto-created on signup.** The
  `User ──< Membership >── Organization` model supports multi-org later, but the org switcher is
  an *extension point*, not a Phase-1 feature — this removes a whole class of "which org is
  active" state bugs from the MVP.
- Every tenant entity carries `organizationId`; **all queries go through a tenant-scoped
  data-access helper** (`db` extension injecting `where: { organizationId }`).
- **Hard enforcement, not convention:** a Prisma extension only protects code that uses the
  extended client. Therefore the *base* `PrismaClient` import is banned outside `src/server/db`
  via ESLint `no-restricted-imports`, so no code can bypass the tenant scope by accident.
- **Fail-closed registry (ADR-015):** the extension scopes explicit TENANT models, throws a
  guiding error for IDENTITY models (query those via `server/db/identity`), and throws for
  unregistered models. New tables cannot silently leak — forgetting registration breaks loudly.
- Client-supplied `organizationId` is **never trusted** (spec §28); it is ignored and re-derived.
- Cross-tenant reads return not-found (no existence leak).

## 4. AI architecture (spec §21, §22, §23)

```
User question
   ↓
AI Analyst (server)
   ↓
Tool layer: searchProducts / getStore / getAds / getReviews / getTrends / getOpportunities …
   ↓  (each tool is tenant-scoped, parameterized, evidence-only)
Database / Demo data providers
   ↓
Retrieved records (facts)
   ↓
Model call grounded in tool results
   ↓
Response: Observed → Calculated → AI Interpretation → Assumption
```

- **`AIProvider` interface**: `chat(messages, tools) → stream/text`, `embed(text)`.
- Implementations: `DemoAIProvider` (deterministic, clearly labeled, no network) and
  `OpenAICompatibleProvider` (works for OpenAI, OpenRouter, local endpoints via `AI_BASE_URL`).
- The **tool layer is the only data source** the model may read. It cannot create records.
- Analysis results are **persisted with a cache key** so identical analyses are served from the
  DB (spec §38). Timeouts, retries, and request budgets are enforced.
- If no AI key is set, AI modules use `DemoAIProvider` and every output is labeled "Demo AI".

## 5. Data-provider architecture (spec §24, §25)

```
interface ProductDataProvider      → DemoProductProvider      (future: Shopify, Amazon)
interface StoreDataProvider        → DemoStoreProvider        (future: Shopify, Amazon)
interface AdvertisingDataProvider  → DemoAdvertisingProvider  (future: Meta, TikTok, Google Ads)
interface ReviewDataProvider       → DemoReviewProvider       (future: review sources)
```

- Interfaces live in `src/lib/providers`; demo implementations seed and serve fictional data.
- A provider is **"live" only when it actually calls the external service**. For the MVP **no
  live provider is implemented** — only interfaces + demo providers — so nothing can be
  mislabeled as external data (spec §25).
- The `DataSource` table records, per record batch, which provider produced it and its
  provenance (Demo/External/User/AI).

## 6. Background-job architecture (spec §37)

```
HTTP request → create Job row (status: queued) → 202 + jobId
                     ↓
Worker picks queued jobs → status: running → process → results row → status: done | failed
```

- **MVP:** a `Job` table + a worker that can run as (a) a separate `pnpm worker` process using
  the same Prisma client, or (b) an in-process runner for local dev. Jobs are idempotent and
  retryable; failed jobs keep partial results when available.
- **Phase 4 realization (ADR-014):** no persistent worker process. Enqueue returns instantly
  (202 + jobId); execution is lazy — the client triggers `POST /api/jobs/process` (session:
  caller's org; cron secret: all orgs, bounded), then polls `GET /api/jobs/:id` (pure read).
  Status transitions are atomic (no double-processing); Job rows give history + retry. The
  thin enqueue/dequeue seam is preserved for a real queue later.
- **Hosting interaction (decide in Phase 0):** a persistent worker process requires a
  containerized Node host, not a serverless function. If a serverless target is chosen, the
  worker becomes a cron-triggered Route Handler (or a hosted queue) behind the **same** thin
  enqueue/dequeue interface — so this choice changes deployment shape, not job code.
- **Extension point:** the enqueue/dequeue boundary is a thin interface, so a real queue can be
  dropped in later without touching job logic.
- Used for: competitor analysis, AI analyses, report generation, sync/seed-refresh, watchlist
  refresh.

## 7. Billing architecture (spec §30, §31; IMPLEMENTED Phase 8, ADR-017)

```
Application → BillingProvider → StripeBillingProvider (Stripe SDK) | DemoBillingProvider
Subscription → Entitlements → feature/usage checks (src/server/billing/subscriptions.ts)
```

- Plans defined **once** in `src/lib/billing/plans.ts` (FREE/PRO: features, limits,
  display prices; Stripe price IDs from env only). No hard-coded prices scattered in code;
  `/api/plans` never exposes price IDs to the browser.
- Stripe Customer created on first checkout (reused after); Subscription via Stripe
  Checkout (server picks the price); Customer Portal for payment/plan/cancel management;
  status synced by **signature-verified (raw-body), idempotent webhooks** (event ledger;
  unknown events acked; replays no-op).
- Lifecycle: `active`/`trialing` → full PRO; `past_due`/`incomplete` → PRO + portal
  nudge; `unpaid`/`incomplete_expired`/`canceled` → effective FREE; `cancel_at_period_end`
  → PRO until period end, then webhook reverts to FREE.
- Usage counters (`UsageRecord`, `YYYY-MM` period keys = automatic monthly reset)
  incremented server-side on metered actions; limits enforced **server-side** before the
  action (429 + upgrade hint), with the UI showing usage/remaining/plan/reset period.
  Security rate limits (per-hour, `RateLimit`) and product quotas (monthly, `UsageRecord`)
  are separate mechanisms.
- Demo mode: with no Stripe keys the app runs fully on Free via `DemoBillingProvider`
  (checkout → 503, explicit "not configured" UI, never fake charges).

## 8. Project structure (planned, Phase 1)

```
/
├── AGENTS.md
├── README.md
├── .env.example
├── docs/                    # this knowledge base
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed/                # demo dataset (fictional brands, labeled demo)
├── src/
│   ├── app/                 # App Router routes + route handlers
│   ├── components/          # design system + feature components
│   ├── modules/             # feature services (business logic)
│   ├── server/              # db, auth, jobs, provider implementations (server-only)
│   ├── lib/                 # provider/AI interfaces, utils, brand config
│   └── styles/              # Tailwind + tokens
├── tests/                   # unit + integration
└── docker-compose.yml       # Postgres for local dev
```

## 9. Architectural invariants (must never be violated)

1. Client bundles must never import `src/server/**` or contain secrets — enforced by the
   bundler (Node deps fail client builds) + the R2 import ban + code review (ADR-013; no
   `server-only` package, which breaks Node tooling).
2. No business logic in `src/app`; routes delegate to modules.
3. No DB access outside a tenant scope (except global admin/seed paths).
4. No AI output without the tool layer retrieving evidence first.
5. No new external dependency without an ADR.
6. Demo data is never returned through a provider interface labeled "live".
