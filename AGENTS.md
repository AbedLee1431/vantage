# AGENTS.md — Permanent Project Instructions

> **Project:** Vantage (working name) — AI-powered E-commerce Competitive Intelligence SaaS
> **Current status:** PHASE 8 COMPLETE — Stripe billing verified (checkout, portal, webhooks, entitlements, quotas).
> **Awaiting approval to begin Phase 9.** Do not start Phase 9 until the user explicitly approves.

Any agent, engineer, or automated tool working in this repository must read this file first
and follow these instructions. Where this file and a task prompt conflict, follow the most
recent explicit instruction from the user; otherwise follow this file.

---

## 1. What this project is

Vantage is a **B2B SaaS application** that turns e-commerce market data into understandable
insights and actionable research for founders, marketers, agencies, and product researchers.

Core loop: **Discover → Investigate → Analyze → Understand → Identify Opportunities → Monitor → Act**

The product helps users understand: which products are gaining attention, which stores are
growing or active, what competitors are doing, what ads they run and with which hooks/angles,
what customers like and dislike, where market gaps exist, and what actions are worth considering.

## 2. What this project is NOT

This is **not an e-commerce storefront.** The following are explicitly OUT of scope as core MVP
functionality and must not be built:

- Customer shopping cart / checkout / purchasing
- Customer orders, fulfillment, inventory, or shipping management

Stripe is used **only for SaaS subscriptions** (selling access to Vantage), never for selling
physical products.

The original starting repository referenced in the specification
(`chec/commercejs-nextjs-demo-store`, BSD-3-Clause, archived) is **not present in this working
tree and must not be cloned or copied from.** There is nothing to reuse; the application is a
fresh implementation. See `docs/Decisions.md` ADR-001.

## 3. Working name and branding

- The **working name is "Vantage"** — a temporary codename chosen to be easy to change.
- **Never use "TrendTrack" branding, logos, copy, screenshots, source code, or proprietary
  assets** (the repository folder name and the pre-existing Obsidian vault are unrelated to the
  product identity and must not influence branding).
- Keep branding **centralized** (a single brand configuration module + design tokens) so a
  rename touches as few files as possible. See `docs/UI-Design.md`.

## 4. Approval gates — mandatory discipline

Implementation is gated. Do not skip or silently pass a gate.

| Gate | Meaning | Status |
|------|---------|--------|
| 1 | Environment setup & inspection | ✅ Done |
| 2 | Product documentation | ✅ Done |
| 3 | Architecture review | ✅ Done (`docs/Architecture.md`) |
| 4 | **Explicit implementation approval by the user** | ✅ **Approved** |
| 5 | Phase completion verification (every phase) | ✅ Active — Phases 0–8 verified |

**GATE 4 is approved.** Implement one phase at a time, in order, and pass the GATE 5 checklist
before moving on. Do not start the next phase until the user explicitly approves. Within a phase,
do not ask permission for small steps — but **stop and explain** if a decision could cause
irreversible data loss, require a different stack, invalidate existing architecture, create
significant security risk, or significant vendor lock-in.

## 5. Non-negotiable rules

1. **Never fabricate data.** AI must never invent database records, metrics, reviews, or
   external API responses. Missing data is reported as missing. (Evidence Rule,
   `docs/Requirements.md` §AI-EVIDENCE.)
2. **Label provenance everywhere.** Every relevant record/field distinguishes: Demo, Mock,
   Estimated, Calculated, Externally sourced, AI-generated, or User-provided. Demo/estimated/
   inferred data must never be presented as verified real-world fact.
3. **Distinguish evidence from interpretation.** AI output separates: Observed (facts in the
   DB) → Calculated (app-computed metrics) → AI Interpretation → Assumption → Needs validation.
   Never present assumptions as fact. Never claim a product/ad "will succeed."
4. **Multi-tenant isolation is server-side.** Derive the active organization/workspace from the
   authenticated session and permitted membership. **Never trust an organization ID supplied by
   a client.** Every tenant-owned entity has an explicit ownership relationship.
5. **Secrets stay server-side.** Environment variables only; never hard-code API keys; never
   expose keys to browser clients; **never commit `.env` files with secrets.**
6. **Provider integrity.** A provider is "live" only when it actually communicates with the
   intended external service. Uncustomized providers must be explicitly named Mock/Demo
   providers, clearly labeled, with real interfaces kept separate. Never dress invented data up
   as external data. (`docs/Integrations.md`.)
7. **Must run without paid third-party APIs locally.** The app is fully usable with clearly
   labeled demo/mock data. AI features fall back to a clearly labeled Demo AI provider when no
   provider key is configured.
8. **No unsupported claims.** No "real-time" monitoring claims unless monitoring is actually
   real-time. No fabricated timestamps. Hedged, evidence-based language in all AI copy.
9. **Document decisions before introducing significant dependencies or changing major
   architecture.** Record in `docs/Decisions.md` using the ADR template (Problem / Options /
   Selected / Reason / Tradeoffs / Consequences).
10. **Sync docs with implementation.** When a feature, API, model, decision, security
    requirement, workflow, or integration changes, update the matching `docs/` file. Docs must
    never describe an obsolete version of the app.

## 6. Phase completion checklist (GATE 5)

At the end of **every** implementation phase, run all of the following and fix blockers before
proceeding:

1. Summarize what was implemented; list important files created/modified.
2. Run tests.
3. Run type checking.
4. Run lint.
5. Run production build when appropriate.
6. Verify acceptance criteria for the phase.
7. Update affected documentation.
8. State the next phase.

Do not silently proceed past a failed phase. Do not ask permission between every small step —
but **stop and explain** if a decision could cause irreversible data loss, require a different
stack, invalidate existing architecture, create significant security risk, or significant
vendor lock-in.

## 7. Documentation map

`docs/` is the project knowledge base; source code + tests are the current implementation.

- `PROJECT-CONTEXT.md` — concise high-level context (read this second, after this file)
- `Product-Vision.md` — vision, philosophy, principles
- `Requirements.md` — traceable functional & non-functional requirements
- `Features.md` — MVP modules and feature scope
- `User-Flows.md` — key user workflows
- `Architecture.md` — tech stack and system architecture
- `Database.md` — data model strategy
- `API-Specification.md` — API surface and contracts
- `UI-Design.md` — design system, states, navigation
- `Security.md` — threats and controls
- `Testing.md` — test strategy
- `Integrations.md` — external providers, env vars, live-vs-demo matrix
- `Roadmap.md` — phased implementation plan (Phases 0–10)
- `Decisions.md` — architecture decision records + ambiguities/contradictions

## 8. Environment facts (verified)

| Item | Value / Status |
|------|----------------|
| OS | macOS (darwin) |
| Node.js | v26.7.0 local (Next requires `>=20.9.0` ✔). `.nvmrc` pins **22** (LTS) for CI; `engines.node` is `>=20.9.0` |
| Package manager | pnpm 9.15.4 (pinned via `packageManager`); npm 11.19.0, bun 1.4.0 also installed |
| Toolchain | Next 16.3.7 · React 19.3 · TypeScript 6.0.3 · ESLint 9.39.5 · Vitest 5.0.2 · Prettier 3.9.9 (see ADR-012) · Prisma 7.10.0 · Auth.js v5 beta · Tailwind 4 (see `docs/Architecture.md`) |
| Docker | 29.7.2 — daemon running; Postgres container `vantage-postgres` up (healthy, `localhost:5432`) |
| Local Postgres client | Not installed (use the Docker container or Postgres.app) |
| Stripe CLI | Not installed (install before webhook testing in Phase 8) |
| AI / Stripe env vars | **None configured** — add via `.env` (never commit) |
| Git identity | **Not configured** — set `user.name`/`user.email` before first commit |
| Agent skills | `agent-reach`, `find-skills` auto-discovered; **graphify** CLI + OpenCode skill wired; **ponytail** plugin registered in `.opencode/` — see §11 |

## 9. Build philosophy (summary)

Inspect before modifying. Reuse only genuinely useful code (here: nothing to reuse). Prefer
simple, maintainable architecture. Don't over-engineer the MVP. Don't create abstractions
without demonstrated need. Don't optimize prematurely. Use background jobs for expensive
operations. Add loading/empty/success/partial-data/error/unavailable states everywhere. Keep
external data providers and AI providers replaceable. Avoid unnecessary dependencies and
infrastructure. Keep implementation understandable by another developer.

Full statement: `docs/Product-Vision.md` §build-philosophy.

## 10. Command reference

Toolchain commands are **live** as of Phase 0. Data commands arrive with Phase 1 (Prisma).

```bash
# Available now (Phase 0):
pnpm install          # install dependencies
pnpm dev              # start dev server (Turbopack)
pnpm build            # production build
pnpm start            # serve the production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest run
pnpm test:watch       # vitest watch mode
pnpm format           # prettier --write
pnpm format:check     # prettier --check

# Local database:
docker compose up -d postgres   # start Postgres (needs Docker Desktop running)
docker compose down             # stop Postgres (volume persists)

# Data (live as of Phase 1, Prisma):
pnpm db:generate      # regenerate Prisma Client
pnpm db:migrate       # prisma migrate dev (local)
pnpm db:deploy        # prisma migrate deploy (CI/prod)
pnpm db:seed          # seed demo dataset (idempotent, demo org only)
pnpm db:studio        # Prisma Studio (dev data browser)
```

Note: `next dev` appends a `<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
