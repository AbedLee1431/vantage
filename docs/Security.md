# Security

> Threat model and controls. Every item maps to a requirement in `docs/Requirements.md`
> (NFR-SEC-xx, NFR-TENANT-xx) and is verified by the tests in `docs/Testing.md`.

## 1. Threats considered (STRATA-lite)

| Threat | Scenario | Primary control |
|--------|----------|-----------------|
| Credential compromise | Password leak / brute force | Argon2id hashing, lockout, reset tokens |
| Broken access control | Accessing another org's data | Server-side tenant scope from session |
| Injection | Malicious input in queries/URLs | ORM (no raw SQL), Zod validation, allow-listed filters |
| XSS | Stored/reflected script | React escaping, no `dangerouslyInnerHTML`, sanitize user HTML |
| CSRF | Forged state-changing requests | SameSite cookies + token/origin checks on mutations |
| Secret exposure | Keys in client bundle/logs | Server-only module guard; secrets in env only |
| Webhook forgery | Fake Stripe events | Signature verification (raw body) |
| Quota bypass | Over-use via direct API | Server-side usage enforcement before action |
| Prompt-injection leakage | AI exfiltrating data or faking records | Tool-layer-only data access; provenance tagging |
| DoS / abuse | Expensive AI/spam loops | Rate limits, request budgets, caching, timeouts |

## 2. Authentication & sessions

- **Email/password** via Auth.js credentials provider; passwords hashed with **Argon2id**
  (bcrypt acceptable fallback), never stored or logged in plaintext (FR-AUTH-05).
- Sessions are **server-verified**; protected routes require a valid session cookie.
- **Password reset** uses a single-use, time-limited signed token; in demo mode the link is
  written to the server console (no email provider configured).
- Login attempts are rate-limited per IP + email; repeated failures trigger temporary lockout.

## 3. Authorization & multi-tenancy

- Active organization is resolved **from the session + memberships only**; any client-supplied
  `organizationId` is ignored (FR-TEN-03).
- Every query is scoped through the tenant-scoped data-access layer; unscoped queries are a
  lint/review violation.
- Cross-tenant access returns **404** (not-found), never 403-with-details, to avoid leaking
  resource existence (FR-TEN-05).
- Authorization checks live in the **module/service layer**, not only in routes — the API and
  Server Actions share one code path so there is no bypass.

## 4. Input validation & safe rendering

- **Zod** schemas on every API boundary and Server Action; shared with the client for form
- errors. Unknown fields are rejected.
- Sort/filter field names are **allow-listed** per endpoint — no arbitrary column sorting.
- URL fields (product/ad/creative/destination URLs) are validated for scheme + host; only
  `http/https` allowed, and rendered as safe links with `rel="noopener noreferrer"`.
- No `dangerouslySetInnerHTML`; any future rich text is sanitized server-side.

## 5. Secrets management

- All keys (DB, AUTH_SECRET, Stripe, AI) live in **environment variables**, loaded server-side.
- `src/server/**` is guarded so it cannot be imported into client components.
- `.env` files are git-ignored; only `.env.example` (no values) is committed.
- AI keys are never proxied to the browser; the browser only ever calls our own API.

## 6. Webhook integrity (IMPLEMENTED Phase 8)

- Stripe webhooks verify the **raw request body signature** (`req.text()`, never
  `req.json()` first) against `STRIPE_WEBHOOK_SECRET` before any state change;
  missing/empty/invalid bodies and signatures return 400.
- A `StripeWebhookEvent` ledger (Stripe event id PK) makes processing idempotent:
  replays return 200 `{ outcome: "duplicate" }` without mutating state; unknown event
  types are acknowledged (`ignored`) so Stripe stops retrying.
- Webhooks carry no session: the org is resolved from event metadata, falling back to
  the Stripe-customer → subscription lookup. Tenant isolation holds because mutations
  target only the resolved org; cross-org reads return 404 and responses never embed
  another org's customer IDs.
- No client input influences plan, price, or entitlement state: checkout resolves the
  price server-side from `planCode`; entitlement changes happen only in webhook
  handlers, never from redirects or success pages.

## 7. Rate limiting, cost & abuse control

- Rate limits on auth, AI, and search endpoints. Phase 1 enforces DB-backed counters keyed by
  account identifier (email) on register/login/reset — simpler and testable than IP extraction,
  sufficient pre-abuse; IP-keyed buckets can layer on later. Postgres-backed (ADR-011), never
  in-memory, so limits hold for one instance, many instances, or serverless cold starts.
- **Usage quotas enforced server-side before** metered actions (FR-BILL-05); over-quota returns
  429 with an upgrade hint.
- AI calls carry **timeouts, retries with backoff, and request budgets**; identical analyses are
  served from the persisted cache (NFR-COST-01) so cost cannot scale with repeat clicks.

## 8. Transport & deployment

- HTTPS everywhere in production (HSTS); secure cookies (`secure`, `httpOnly`, `sameSite`).
- Security headers via Next config: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `X-Powered-By` header disabled.
- Production build is the deployed artifact; source maps are not public.
- Health check endpoint (`GET /api/health`) returns status without exposing internals.
- Environment validation (`src/lib/env.ts`) fails clearly on missing required config.

## 9. AI-specific controls (spec §22, §25)

- The model **cannot** create records; it only reads through tenant-scoped tools.
- Tool results are **evidence** — interpretation is labeled separately.
- **Citation validation (post-processing):** every "AI Interpretation"/"Assumption" block must
  reference a tool-result record id; uncited claims are dropped or flagged "unsupported by
  retrieved evidence" before the response is rendered or persisted.
- Demo AI output is labeled "Demo AI" and never attributed to an external provider.
- AI responses are persisted (prompt + tool calls + result) for auditability.

## 10. Security verification (see `docs/Testing.md`)

- Tenant isolation tests (cross-org access must fail).
- Auth tests (registration/login/reset/protected routes).
- Webhook signature tests (valid + invalid signatures).
- Rate-limit + quota tests.
- Input-validation fuzz on API boundaries.
