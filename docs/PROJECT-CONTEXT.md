# PROJECT-CONTEXT.md — Vantage at a Glance

> **Read this second**, immediately after `AGENTS.md`. It is deliberately concise — details
> live in the other `docs/` files.

## What the product is

**Vantage** (working name) is an **AI-powered e-commerce competitive intelligence SaaS**. It is
*not* an e-commerce storefront — there is no cart, checkout, orders, inventory, or shipping.
Stripe is used **only** to sell SaaS subscriptions.

It turns e-commerce market signals into understandable insights and actionable research:

```
Discover → Investigate → Analyze → Understand → Identify Opportunities → Monitor → Act
```

## Target users

- E-commerce **founders** looking for product/market gaps
- **Marketers** researching competitor ad angles and creatives
- **Agencies** serving multiple e-commerce brands
- **Product researchers** tracking categories and trends

## Core problem

E-commerce competitive data is scattered, overwhelming, and hard to interpret. Users can see
*what* is happening (a product, an ad, a store) but not *why it matters* or *what to do about
it*. Vantage converts observed data into structured, evidence-labeled intelligence.

## Core functionality (MVP)

Dashboard, Product Discovery, Store/Brand Discovery, Ad Intelligence, AI Ad Analysis, Customer
Review Intelligence, Market Gap Analysis, Trends, Watchlist/Monitoring, AI E-commerce Analyst,
Reports, Billing, Settings. Full breakdown: `docs/Features.md`.

## Major architectural decisions (detail in `docs/Decisions.md`)

| # | Decision |
|---|----------|
| ADR-001 | Fresh implementation — the referenced demo-store repo is **absent** from the working tree and is not cloned |
| ADR-002 | Next.js (App Router) + TypeScript as the single application |
| ADR-003 | PostgreSQL via Prisma ORM |
| ADR-004 | Auth.js (NextAuth) credentials provider + custom Organization/Membership |
| ADR-005 | AIProvider abstraction with OpenAI-compatible client + labeled Demo fallback |
| ADR-006 | Data-provider interfaces backed by clearly labeled Demo providers |
| ADR-007 | DB-backed job table + lightweight worker (no distributed queue) |
| ADR-008 | Stripe Checkout + Customer Portal + signature-verified webhooks |
| ADR-009 | Route Handlers + Zod + Server Actions (no tRPC/GraphQL) |
| ADR-010 | Tailwind CSS + Radix primitives; brand centralized in one config + tokens |
| ADR-011 | Deployment: Vercel primary, containerized Node fallback; Postgres-backed limits/cache |
| ADR-012 | Toolchain pins (TypeScript 6.0.3 / ESLint 9.39.5) — chosen for peer compatibility |
| ADR-013 | No `server-only` package; enforcement via bundler + R2 ban + identity module |
| ADR-014 | Job execution: lazy processing via trigger + poll (no worker process) |
| ADR-015 | Fail-closed tenant isolation (explicit model registry, no silent passthrough) |
| ADR-016 | Report export: browser print/PDF + server CSV (no document stack) |

## Technology decisions

- **Runtime:** Node.js (local 26.7.0; `.nvmrc` pins 22 LTS; `engines` requires `>=20.9.0`), **Package manager:** pnpm
- **Framework:** Next.js 16 (App Router, React Server Components)
- **Language:** TypeScript 6.0.3 (strict)
- **DB:** PostgreSQL 17 (Docker locally) — Prisma from Phase 1
- **Auth:** Auth.js v5, credentials provider, Argon2id hashing
- **UI:** Tailwind CSS, Radix UI primitives, lucide-react, Recharts
- **Validation:** Zod (shared client/server schemas)
- **Billing:** Stripe (test mode)
- **AI:** OpenAI-compatible HTTP client behind `AIProvider` interface
- **Jobs:** persistent `Job` rows + worker (ADR-007/011)
- **Quality:** Vitest 5, React Testing Library, ESLint 9, Prettier, `tsc --noEmit`

## Important constraints / non-negotiables

1. **Never fabricate data** — AI must not invent records, metrics, reviews, or API responses.
2. **Label provenance** — Demo / Mock / Estimated / Calculated / Externally sourced /
   AI-generated / User-provided.
3. **Separate evidence from interpretation** — Observed → Calculated → AI Interpretation →
   Assumption → Needs validation. Never claim something "will succeed."
4. **Tenant isolation enforced server-side** — org derived from session, never from client.
5. **Secrets never reach the client** and never enter source control.
6. **Provider integrity** — a provider is "live" only when it truly talks to the external
   service; otherwise it is an explicitly named Demo provider.
7. **Runs locally without paid APIs** — full demo dataset, labeled as demo.
8. **No unsupported claims** — no fake "real-time," no fabricated timestamps.

## Current implementation phase

```
GATES 1–4 (setup, docs, architecture, approval)  ✅
PHASE 0–8                                         ✅ verified
PHASE 9 → PHASE 10                                ⬜ awaiting approval to start Phase 9
```

**Project status:** Phase 8 Stripe billing is complete and verified — central plan config
(FREE/PRO), server-side Checkout + Customer Portal, idempotent verified webhooks with
lifecycle sync, centralized entitlements, monthly quotas enforced server-side, billing +
pricing pages, 167 passing tests, one dependency (`stripe`), one migration. Phase 9
(Polish) has not started.

## Where things live

- `AGENTS.md` — rules every agent/engineer must follow
- `docs/` — the knowledge base you are reading now
- `TrendTrack/` — a **pre-existing personal Obsidian vault, unrelated to the product**.
  Do not treat it as product documentation and do not use it for branding.
