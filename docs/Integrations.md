# Integrations

> External providers, required configuration, and the **live-vs-demo matrix** (spec §24, §25, §42).
> Golden rule: a provider is "live" **only** when it actually talks to the external service.

## 1. Environment variables

Template in `.env.example`. The app runs fully on demo data with all optional keys unset.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection |
| `AUTH_SECRET` | **Yes** | Auth.js session signing (`openssl rand -base64 32`) |
| `AUTH_TRUST_HOST` | Dev only | Trusted host behind proxy |
| `APP_URL` | **Yes** | Canonical app URL (links, webhooks) |
| `AI_PROVIDER` | Optional | `demo` (default) or `openai-compatible` |
| `AI_MODEL` | Optional | Model id (required for live) |
| `AI_API_KEY` | Optional | AI provider key (server-side only, never logged) |
| `AI_BASE_URL` | Optional | OpenAI-compatible endpoint (default OpenAI) |
| `AI_TIMEOUT_MS` | Optional | Provider fetch timeout (default 30000) |
| `AI_MAX_TOKENS` | Optional | Per-call token budget (default 2000) |
| `CRON_SECRET` | Optional | Bearer secret for `POST /api/jobs/process` across orgs (Phase 10 cron) |
| `STRIPE_SECRET_KEY` | Optional\* | Stripe test-mode secret |
| `STRIPE_PUBLISHABLE_KEY` | Optional\* | Stripe test-mode publishable key |
| `STRIPE_WEBHOOK_SECRET` | Optional\* | Webhook signature verification |
| `STRIPE_PRICE_FREE` / `STRIPE_PRICE_PRO` | Optional\* | Price IDs per plan |

\* Stripe is optional for local dev (demo billing mode: Free plan, explicit
"not configured" states) and required for live checkout/webhooks (Phase 8 implemented).

**Auth note:** the credentials provider mandates **JWT-based sessions** (not DB sessions) in
Auth.js v5 — plan session payloads accordingly. `AUTH_SECRET` signs those tokens and must be
stable across restarts; rotating it invalidates all sessions.

## 2. AI providers

| Provider class | Env | Live? | Notes |
|----------------|-----|-------|-------|
| `DemoAIProvider` | none | **No — by design** | Deterministic, labeled "Demo AI"; used when `AI_PROVIDER` is unset or `demo`. Never claims to be external. Rows persist with `provenance = demo`. |
| `OpenAICompatibleProvider` | `AI_PROVIDER=openai-compatible`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | **Yes** when a key + reachable endpoint are configured | Works with OpenAI, OpenRouter, and local OpenAI-compatible servers. Rows persist with `provenance = ai`. Misconfigured live (key/model missing) fails loudly — never silent demo. |

Switching providers is an env change only — business logic talks to the `AIProvider` interface
(spec §23). AI calls are cached, budgeted, and retried (NFR-COST-01).

## 3. Data providers

| Interface | MVP implementation | Live? | Future implementations |
|-----------|--------------------|-------|------------------------|
| `ProductDataProvider` | `DemoProductProvider` | No | Shopify, Amazon |
| `StoreDataProvider` | `DemoStoreProvider` | No | Shopify, Amazon |
| `AdvertisingDataProvider` | `DemoAdvertisingProvider` | No | Meta Ads, TikTok Ads, Google Ads |
| `ReviewDataProvider` | `DemoReviewProvider` | No | Review sources |

**For the MVP, no live data provider is implemented** — only the interfaces + demo providers
(ADR-006). It is then impossible to mislabel invented data as external data, because no
external-fetching code exists. Live providers are added later *behind the same interface*,
recorded as ADRs; every new `DataSource` row records provenance.

## 4. Payment (IMPLEMENTED Phase 8)

- **Stripe** (test mode in development) via Checkout + Customer Portal behind the
  `BillingProvider` abstraction (`src/server/billing/provider.ts`); `DemoBillingProvider`
  keeps the app usable with no keys and never fabricates charges.
- Plans: `src/lib/billing/plans.ts` (FREE/PRO); price IDs from `STRIPE_PRICE_PRO` only.
- The webhook endpoint (`POST /api/webhooks/stripe`) verifies the **raw-body signature**
  before mutating subscription state; processing is idempotent via `StripeWebhookEvent`.
- Lifecycle/entitlement policy: active/trialing → PRO; past_due/incomplete → PRO with
  portal nudge; unpaid/incomplete_expired/canceled → FREE; cancel-at-period-end → PRO
  until period end. Usage quotas reset monthly (`YYYY-MM` periods).
- Stripe CLI is **not installed** locally — webhook delivery was validated with
  HMAC-signed unit/integration tests (no network). Install the CLI and configure
  test-mode keys for end-to-end checkout testing
  (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`).

## 5. Email / notifications

- **No email provider is configured for the MVP.** Password-reset links are written to the
  server console in development and clearly labeled as such. A pluggable
  `NotificationProvider` interface is the extension point.

## 6. Infrastructure & tooling

| Resource | Status | Notes |
|----------|--------|-------|
| Docker | 29.7.2 — daemon running; `vantage-postgres` healthy on `localhost:5432` | `docker compose up -d postgres` |
| PostgreSQL | 17.11 in the Docker container (recommended) or Postgres.app | No local `psql` client |
| Stripe CLI | **Not installed** | Needed in Phase 8 |
| Agent skills | `agent-reach`, `find-skills` (auto-discovered) | Available — live |
| graphify | pipx `graphifyy` 0.9.53 → `graphify` + `graphify-mcp` on PATH | Skill installed to `~/.config/opencode/skills/graphify/`; project plugin `.opencode/plugins/graphify.js` (only active when `graphify-out/graph.json` exists) |
| ponytail | npm `@dietrichgebert/ponytail` 4.10.0 (cached for OpenCode) | Registered in `.opencode/opencode.json`; YAGNI/laziness ruleset, complements the build philosophy |

## 7. Deployment (ADR-011)

- **Primary target: Vercel** for the web app. Lowest ops for a lean MVP; canonical Next.js host.
- **Background jobs:** in-process runner in dev; in production a **cron-triggered Route Handler**
  drains a bounded batch of queued jobs per tick — behind the same enqueue/dequeue interface, so
  no job code changes between environments. Handlers must be idempotent, short, and time-boxed to
  fit serverless function limits.
- **Rate limits & caching are Postgres-backed, never in-memory**, so behavior is identical for
  one instance, many instances, or serverless cold starts (no Redis dependency).
- **No Vercel-specific APIs in application code** — a containerized Node deployment (web + worker
  process) remains a documented fallback, reachable by changing deployment config only.
- Phase 10 covers production config, migration runbook, and Stripe webhook setup. **Deployment is
  never automatic unless explicitly requested.**

## 8. Local first-run contract (spec §40)

A new developer must be able to:

1. `pnpm install`
2. Copy `.env.example` → `.env`; set `DATABASE_URL` + `AUTH_SECRET`
3. Start Postgres (`docker compose up -d postgres`)
4. `pnpm db:migrate && pnpm db:seed`
5. `pnpm dev`
6. Register / log in
7. Explore a populated, demo-labeled dashboard

No paid API keys required at any step.
