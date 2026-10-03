# Database Strategy

> **Status: IMPLEMENTED (Phase 1).** Strategy realized with Prisma 7 + PostgreSQL 17.
> Deviations from the proposal are recorded in §7.

## 1. Engine & access

- **PostgreSQL 17** in Docker (`vantage-postgres`, healthy). No local `psql` client required.
- **Prisma 7.10.0** with `prisma.config.ts` (schema path, migrations path, seed command,
  `DATABASE_URL`). Driver adapter is mandatory in v7: runtime uses `@prisma/adapter-pg` + `pg`.
- Generated client output: `src/generated/` (gitignored, excluded from typecheck/lint).
- No raw string SQL (NFR-SEC-05).
- One database per environment (`vantage` dev, `vantage_test` for tests, created + migrated automatically by the Vitest global setup).
- Tests use a separate test database, created/migrated per test run.

## 2. Multi-tenancy strategy

- **Shared database, shared schema, discriminator column** (`organizationId`) on every tenant
  entity — simplest model that satisfies a lean MVP and scales to many small tenants.
- Every query passes through a **tenant-scoped Prisma extension** that injects
  `where: { organizationId }`; the org id comes **only** from the session (NFR-TENANT-01).
  The extension rewrites `findUnique*` to scoped `findFirst*`, verify-then-mutates singular
  `update`/`delete`, and rejects `upsert` loudly (Prisma forbids non-unique filters there).
- All tenant entities have an explicit FK `organizationId` (ownership relationship, spec §28) —
  including `WatchlistItem`, which carries it directly (denormalized from its parent) so the
  security boundary stays uniform with no join-dependent special cases.
- Candidate unique indexes are composite `(organizationId, naturalKey)`.
- TypeScript enforces `organizationId` on creates statically; the extension guarantees it on
  reads/deletes at runtime (defense in depth). Base-client imports are banned outside
  `src/server/db` (R2, ADR-013); identity models go through `src/server/db/identity.ts`.

## 3. Entity groups

### Identity & tenancy
- `User` — email (unique), password hash, name, timestamps
- `Organization` — name, slug (unique), timestamps
- `Membership` — user × organization, role (owner/member), joinedAt
- `Account`/`Session` — Auth.js adapter tables (credentials provider)

### Plans & billing
- Plans live in **central code config** (`src/lib/billing/plans.ts`), not a table (ADR-017)
- `Subscription` — org (unique) × planCode, stripeCustomerId/SubscriptionId (unique, nullable),
  status, currentPeriodStart/End, cancelAtPeriodEnd, canceledAt, trialEndsAt
- `UsageRecord` — org × action × period (`YYYY-MM`, new row per month = automatic reset), counter
- `StripeWebhookEvent` — Stripe event id (PK) + type; idempotency ledger (global, not tenant-scoped)

### Catalog (tenant-owned, sourced)
- `Store` — name, domain (unique per org), category, country, platform, description
- `Product` — storeId, name, category, description, price, currency, url, imageUrl, tags,
  firstSeen, lastSeen
- `Advertiser` — name, storeId (nullable), platform
- `Ad` — advertiserId, storeId, platform, title, primaryText, headline, cta, creativeUrl,
  destinationUrl, format, firstSeen, lastSeen, durationDays, status
- `LandingPage` — storeId, url, title, firstSeen, lastSeen
- `Review` — productId/storeId, author, rating, title, body, date, source
- `ReviewInsight` — review aggregation snapshot: themes, sentiment, counts

### Intelligence (tenant-owned, computed/AI)
- `Competitor` — org × store, alias, addedAt (tracked competitor)
- `Watchlist` + `WatchlistItem` — org-scoped lists of polymorphic refs (product/store/
  advertiser/competitor)
- `ChangeEvent` — watchlistItem/entity, type (new_product, removed_product, new_ad,
  ad_activity_change, price_change, landing_page_change, review_change), before/after snapshot,
  detectedAt
- `Alert` — changeEventId, severity, acknowledgedAt
- `Opportunity` — title, description, evidence JSON, supportingData, competitorsObserved,
  painPoints, differentiation, confidence, status
- `AiAnalysis` — kind (ad/competitor/product/store/opportunity), targetRef, promptHash (cache
  key), result JSON, evidence refs, provider, model, provenance, createdAt
- `AiConversation` + `AiMessage` — analyst chat history, tool calls, tool results
- `Report` — org, type, title, status, generatedAt, sections JSON, provenance summary

### Data ops
- `DataSource` — provider name, kind (demo/external/user/ai), provenance label, fetchedAt
- `SyncJob` — provider, scope, status, startedAt/finishedAt, counts
- `Job` — type, status (queued/running/done/failed), payload, result, attempts, timestamps

## 4. Conventions

- **Timestamps:** `createdAt`/`updatedAt` on every table (spec §27). No fabricated timestamps;
  `firstSeen`/`lastSeen` reflect ingested data and are labeled by provenance.
- **Indexes:** on all FKs, tenant discriminator columns, and frequently filtered fields
  (platform, status, category, firstSeen).
- **Uniqueness:** composite with `organizationId` for tenant-owned natural keys.
- **Deletion behavior:** cascade from Organization→tenant entities is avoided in favor of
  explicit soft-delete flags where audit matters (alerts, reports, change events); hard cascade
  only where safe (watchlist items).
- **Constraints:** `rating` CHECK (1–5), plan limit JSON validated server-side, non-null
  ownership columns.
- **Money:** decimal/currency pair, never float.
- **Provenance columns:** `provenance` enum
  (`demo|mock|estimated|calculated|external|ai|user`) on sourced/derived rows, per spec §26.

## 5. Migrations & seeding

- `prisma migrate dev` for local schema changes; `migrate deploy` for CI/production.
- **Demo seed** (`pnpm db:seed`) creates (or reuses) a demo user + org, wipes THAT org's tenant
  data, and rebuilds the fictional dataset via `buildDemoDataset()` — all rows
  `provenance = demo`. Idempotent (wipe + rebuild scoped to the demo org; never touches others).
- `buildDemoDataset()` is shared: the CLI seed and new-user signup call the same function, so
  every fresh org starts populated.
- The seed is the single source of the "new developer can explore the dashboard in minutes"
  experience (spec §40). Demo credentials are printed by the seed (local dev only).

## 6. Data integrity invariants

1. No row may exist without an owner: global entities (Plan) excepted, every table is either
   tenant-owned or explicitly system-owned.
2. AI-generated rows (`AiAnalysis`, parts of `Opportunity`) must carry `provenance = ai` and
   reference the evidence rows they were built from.
3. `UsageRecord` counters only increment server-side, post-authorization.
4. Demo rows are only ever created by the seeder/sync job, never by live providers.

## 7. Phase 1 implementation status

**Shipped (migrations `init`, `watchlist-item-org`):** User, Organization, Membership,
PasswordResetToken, RateLimit, Store, Product, Advertiser, Ad, LandingPage, Review, Competitor,
Watchlist, WatchlistItem (+`organizationId`), ChangeEvent. Enums: Role, Provenance, ItemType,
ChangeEventType.

**Phase 3 addition (migration `ad-duration-days`):** `Ad.durationDays Int @default(0)` —
whole days between firstSeen/lastSeen, computed by the seeder. Stored (not computed on read)
so duration is filterable/sortable in the DB without raw SQL; the seed recomputes it on every
rebuild, so the default only ever fills pre-existing rows transiently.

**Phase 4 additions (migration `ai-intelligence` + `ai-message-org`):** AiAnalysis (kind,
targetRef, promptHash cache key, result/evidence JSON, provider/model, provenance),
AiConversation + AiMessage (chat history with toolCalls/evidence JSON), Job (type, status,
payload, resultId, error, attempts). `AiMessage` carries direct `organizationId` (uniform
scoping, WatchlistItem precedent). Demo provider rows store `provenance = "demo"`; live rows
store `"ai"` — `ai` provenance means a real model ran. UsageRecord stays deferred to Phase 8
(usage derives from row counts until then).

**Phase 5 additions (migration `opportunities`):** Opportunity (title, description, evidence,
supportingData, competitors, painPoints, differentiation, confidence, status, provider/model,
provenance) + `OpportunityConfidence`/`OpportunityStatus` enums; `AiAnalysisKind.review_summary`
+ `JobType.review_summary`/`opportunity_analysis`. Deliberately NO `ReviewInsight` table —
theme/sentiment aggregation is cheap, live computation over observed rows (always fresh, no
refresh jobs); only expensive AI prose persists (AiAnalysis). Review counts as the demo seed's
8 rows (sufficient variety; empty themes are honest empty states).

**Phase 6 additions (migrations `monitoring-alerts`, `sync-state`, `itemtype-ad-review`):**
Alert (changeEventId unique, severity, acknowledgedAt) + `AlertSeverity` enum; SyncState
(organizationId PK, lastSyncAt — explicit detection baseline set at seed, advanced per sync);
`JobType.catalog_sync`; `ItemType` gains `ad` + `review` so sync-emitted refs are type-precise
(seed history keeps linked-entity refs — both resolve).

**Phase 7 additions (migration `reports`):** Report (type, title, status, params, sections +
evidence snapshots, provider/model, provenance, error, timestamps) + `ReportType`/`ReportStatus`
enums; `JobType.report_generation`. Reports are historical records (never cached/deduped);
CSV serializes the frozen snapshot, never live queries.

**Phase 8 additions (migration `billing-subscriptions`):** Subscription (per-org plan +
Stripe IDs + lifecycle dates) + `SubscriptionStatus` enum; UsageRecord (period-keyed
monthly counters) + `UsageAction` enum (`search`, `ai_analysis`, `competitor_analysis`,
`report_generation`); StripeWebhookEvent (global idempotency ledger). `Subscription` +
`UsageRecord` registered in `TENANT_MODELS`. Deliberately NO `Plan` table — plans are
central config (ADR-017).

**Deferred to their phases:** AiAnalysis/AiConversation/
AiMessage (Ph4) · Opportunity/ReviewInsight (Ph5) · Alert (Ph6) · Report (Ph7) · Job/DataSource/
SyncJob (Ph4/6) · example AI analyses in seed (Ph4, needs AiAnalysis).

**Deviations:** no Auth.js adapter tables (credentials + JWT need none); `WatchlistItem`
carries direct `organizationId` for uniform scoping; `RateLimit` added for ADR-011 (Postgres,
never in-memory); Prisma 7 conventions (`prisma.config.ts`, driver adapter, explicit `output`).
