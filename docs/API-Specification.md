# API Specification

> **Status: PROPOSED.** Implemented from Phase 1 onward. Contracts here are the baseline; changes
> must update this document (spec §7).
>
> **Phase 2 note:** discovery pages use tested module queries + Server Actions (no programmatic
> consumer exists yet). The REST `/api/*` discovery routes below are deferred until one does —
> they will be thin wrappers over the same queries (ADR-009 style unchanged).

## 1. Style and transport

- **REST-ish Route Handlers** in Next.js (`src/app/api/**`) + **Server Actions** for form-style
  mutations. No tRPC/GraphQL for the MVP (ADR-009) — fewer moving parts, mainstream skills.
- **JSON in/out**; `Zod` validates every request body and query string at the boundary.
- All mutations are **idempotent where practical** and return the canonical resource.
- Errors use a single envelope:
  ```json
  { "error": { "code": "not_found", "message": "Resource not found", "details": { … } } }
  ```
  with conventional HTTP status codes (400 validation, 401 unauthenticated, 403 unauthorized,
  404 not-found, 409 conflict, 429 rate-limited/over-quota, 5xx server).

## 2. Cross-cutting behavior

| Concern | Rule |
|---------|------|
| Authentication | Session cookie required for everything except `/auth/*` and public site |
| Authorization | Tenant scope resolved from session; client `orgId` ignored (FR-TEN-03) |
| Validation | Zod schema per endpoint; server is the single source of truth |
| Rate limiting | IP + user-keyed limiter on auth + AI endpoints |
| Long work | Returns `202 { jobId }`; client polls `GET /jobs/:id` (spec §37) |
| Provenance | Every relevant response object includes `provenance` + `dataSource` (spec §26) |
| Usage metering | Metered actions increment usage **after** authorization, before success |
| Pagination | Cursor-based (`cursor`, `limit`, default 20, max 100) |
| Sorting/filtering | Explicit allow-lists of fields per endpoint (no arbitrary sorting) |

## 3. Endpoint surface (baseline)

### Auth & account
```
POST   /api/auth/register          email, password, name       → session
POST   /api/auth/login             email, password             → session
POST   /api/auth/logout                                        → 204
POST   /api/auth/password/reset    email                       → 202 (token emailed/console-logged)
POST   /api/auth/password/confirm  token, new password         → 204
GET    /api/me                                                  → user + active org
PATCH  /api/me                                                 → update profile
```

### Discovery
```
GET    /api/products               ?q&category&store&minPrice&maxPrice&sort&cursor
GET    /api/products/:id
GET    /api/stores                 ?q&category&country&platform&sort&cursor
GET    /api/stores/:id
GET    /api/stores/:id/products
GET    /api/stores/:id/ads
GET    /api/ads                    ?platform&advertiser&category&format&duration&q&from&to
GET    /api/ads/:id
GET    /api/advertisers
GET    /api/trends                 ?category&signal&from&to
GET    /api/search                 ?q&type=products|stores|advertisers|competitors
```

### Watchlist & monitoring
```
GET    /api/watchlists
POST   /api/watchlists
POST   /api/watchlists/:id/items   { type, refId }
DELETE /api/watchlists/:id/items/:itemId
GET    /api/watchlists/:id/changes ?from&to&type
GET    /api/alerts                 ?acknowledged
POST   /api/alerts/:id/acknowledge
```

### Research
```
POST   /api/competitors            { storeId | domain }        → competitor
GET    /api/competitors
POST   /api/analyses/competitor    { competitorId }           → 202 { jobId }
GET    /api/opportunities          ?status&confidence&cursor
POST   /api/review-insights        { productId? | storeId? }  → 202 { jobId }
GET    /api/customer-intelligence  ?storeId|productId
```

### AI
```
POST   /api/ai/ads/:id/analyze     { force?: boolean }        → 202 { jobId } (cached by promptHash)
POST   /api/ai/analyst             { message, conversationId? } → stream / { messageId }
GET    /api/ai/conversations
GET    /api/ai/conversations/:id
```

### Reports
```
POST   /api/reports                { type, storeId?|productId?|advertiserId?|platform? } → 202 { jobId, reportId }
GET    /api/reports/:id/csv?section=<section>                  → text/csv (snapshot-frozen)
```
List/view are server-rendered pages (`/reports`, `/reports/:id`); history filtering and
detail need no REST. PDF is browser print (ADR-016) — no `/:id/pdf` endpoint.

### Billing (IMPLEMENTED Phase 8)
```
GET    /api/plans                                              → plan config (no price IDs leak)
GET    /api/billing/subscription                               → current sub + entitlements + usage
POST   /api/billing/checkout          { planCode }             → { checkoutUrl } (503 when unconfigured, 409 when already PRO)
POST   /api/billing/portal                                    → { portalUrl } (404 with no customer)
POST   /api/webhooks/stripe           (raw body + signature)   → 200 { received, outcome } (400 on bad signature)
```
Metered actions (AI/competitor/report analyses) check quotas before enqueueing and
return `429 { error: { code: "over_quota" } }` with an upgrade hint when exhausted.
Pages: `/pricing` (public), `/billing` (plan, renewal, usage meters, portal actions).

### Jobs
```
GET    /api/jobs/:id                                           → status + result (org-scoped)
```

## 4. Server Actions (form mutations)

Used for low-latency UI mutations without a round-trip API: save/unsave products & stores,
watchlist toggles, alert acknowledgment, settings updates. Same validation + authorization rules
as Route Handlers; they are **not** a bypass for limits.

## 5. Streaming & AI responses

- The AI Analyst streams tokens via a standard streaming response; **tool calls and tool results
  are persisted** on the message row so every answer is auditable.
- The tool layer is the model's **only** data source; no record synthesis (FR-AI-02).

## 6. Versioning & compatibility

- No version prefix for the MVP (single deployment). Breaking changes are coordinated deploys;
  any future public API would be versioned from day one.
