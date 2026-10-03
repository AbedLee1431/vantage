# Vantage — AI-powered E-commerce Competitive Intelligence SaaS

> **Working name.** "Vantage" is a temporary codename chosen to be easy to change. All brand
> strings and design tokens are centralized, so a rename touches two files.

**Understand what is happening in e-commerce before making your next move.**

Vantage turns e-commerce market signals (products, stores, ads, reviews, trends) into
understandable, evidence-labeled intelligence and actionable research for founders, marketers,
agencies, and product researchers.

```
Discover → Investigate → Analyze → Understand → Identify Opportunities → Monitor → Act
```

## Status

**Phase 7 complete — reports verified. Awaiting approval to begin Phase 8.**

Seven report types with frozen snapshots and AI summaries, web views with print styles,
per-section CSV export, history with delete, and 144 passing tests. Zero new dependencies,
one table added. Phase 8 (Stripe Billing) has not started — no billing code exists.

| Gate / Phase | Meaning | Status |
|--------------|---------|--------|
| Gates 1–3 | Setup, documentation, architecture | ✅ |
| Gate 4 | Implementation approval | ✅ Approved |
| Gate 5 | Per-phase completion verification | ✅ Active |
| **Phase 0** | Foundation audit & toolchain scaffold | ✅ **Verified** |
| **Phase 1** | Foundation (auth, tenancy, DB, seed, dashboard) | ✅ **Verified** |
| **Phase 2** | Discovery (products, stores, search, trends, watchlists) | ✅ **Verified** |
| **Phase 3** | Ad Intelligence (ads, creatives, advertisers) | ✅ **Verified** |
| **Phase 4** | AI Intelligence (analyst, analyses, jobs) | ✅ **Verified** |
| **Phase 5** | Customer Intelligence (reviews, opportunities) | ✅ **Verified** |
| **Phase 6** | Monitoring (dashboard, alerts, sync) | ✅ **Verified** |
| **Phase 7** | Reports (generation, views, CSV export) | ✅ **Verified** |
| Phase 8–10 | Billing → … → deployment readiness | ⬜ Awaiting approval |

## What this is — and is not

Vantage is a **B2B SaaS analytics product**, not a storefront. There is no cart, checkout,
customer orders, inventory, or shipping. Stripe is used **only for SaaS subscriptions**.

Non-negotiable product rules (full list in `AGENTS.md`):

- **Never fabricate data.** Missing data is reported as missing.
- **Label provenance** — Demo / Mock / Estimated / Calculated / External / AI-generated /
  User-provided.
- **Separate evidence from interpretation** — Observed → Calculated → AI Interpretation →
  Assumption → Needs validation. Never "this will succeed."
- **Tenant isolation is server-side**; client-supplied organization IDs are untrusted.
- **Runs locally without paid APIs** — fully usable on clearly labeled demo data.
- **A provider is "live" only when it actually talks to the external service.**

## Tech stack

Next.js 16 (App Router, RSC) · TypeScript 6.0.3 (strict) · PostgreSQL 17 + Prisma · Auth.js v5
(credentials, Argon2id) · Tailwind CSS + Radix UI · Zod · Stripe · OpenAI-compatible `AIProvider`
abstraction · DB-backed jobs · Vitest + ESLint + Prettier. Package manager: **pnpm**.

_Installed in Phase 0: Next.js, TypeScript, ESLint, Prettier, Vitest, CI workflow. Everything
else arrives with its own phase (see `docs/Roadmap.md`). Version pins explained in ADR-012._

## Project structure

```
AGENTS.md            # permanent rules for agents/engineers
docs/                # project knowledge base (read these)
TrendTrack/          # pre-existing personal Obsidian vault — NOT product docs
.env.example         # environment template

# Phase 0 scaffold
package.json         # scripts, engines, pinned dependency versions
tsconfig.json        # strict TS config (Next co-manages it)
next.config.ts       # Next.js config
eslint.config.mjs    # flat config: eslint-config-next + prettier
vitest.config.mts    # Vitest (node env; jsdom arrives with component tests)
docker-compose.yml   # local Postgres service
.github/workflows/ci.yml  # GATE 5 checks on every PR
src/app/             # App Router (Phase 0: placeholder page only)
tests/               # Phase 0 smoke test
```

Planned application layout is documented in `docs/Architecture.md` §8.

## Local setup

```bash
pnpm install                      # install dependencies
cp .env.example .env              # then set DATABASE_URL and AUTH_SECRET
docker compose up -d postgres     # needs Docker Desktop running
pnpm db:migrate                   # apply migrations (local)
pnpm db:seed                      # demo dataset (fictional brands, labeled demo)
pnpm dev                          # start dev server → http://localhost:3000
```

Then register, log in, and explore a populated, **demo-labeled** dashboard — or sign in
immediately with the seeded demo account (credentials printed by `pnpm db:seed`, local dev
only). No paid API keys are required at any step.

## Environment variables

See `.env.example` and `docs/Integrations.md` for the full live-vs-demo matrix.

- **Required:** `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`
- **Optional (AI):** `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_BASE_URL`
- **Optional (billing, Phase 8):** `STRIPE_*`

> Never commit `.env` files with secrets. AI/Stripe keys are server-side only.

## Quality gates (run at the end of every phase)

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest
pnpm build          # production build (where appropriate)
```

## Documentation map

Start with `AGENTS.md`, then `docs/PROJECT-CONTEXT.md`. The full map (vision, requirements,
features, flows, architecture, database, API, UI design, security, testing, integrations,
roadmap, decisions) is in `AGENTS.md` §7 and in `docs/`.

## Troubleshooting (planned)

| Symptom | Fix |
|---------|-----|
| `docker compose` fails | Start Docker Desktop first (daemon is not auto-started) |
| No `psql` locally | Use the Docker container or install Postgres.app |
| Auth errors on first run | Ensure `AUTH_SECRET` is set (`openssl rand -base64 32`) |
| AI outputs say "Demo AI" | No AI key configured — set `AI_PROVIDER`/`AI_API_KEY` for a live provider |
| Billing says "not configured" | Expected until Phase 8; Stripe keys are optional before then |
| Data looks fictional | Correct — all seeded data is demo data and labeled as such |

## Roadmap

Phases 0–10 (foundation → discovery → ad intelligence → AI → customer intelligence → monitoring →
reports → billing → polish → deployment readiness): see `docs/Roadmap.md`.

## License & provenance

Fresh implementation. The referenced `chec/commercejs-nextjs-demo-store` (BSD-3-Clause,
archived) is **not present and not used** — see `docs/Decisions.md` ADR-001.
