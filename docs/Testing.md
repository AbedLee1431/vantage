# Testing Strategy

> Tests gate every phase (GATE 5). Frameworks are chosen to match the stack (ADR-002) and to keep
> the feedback loop fast.

## 1. Levels of testing

| Level | Tool | Scope | Runs on |
|-------|------|-------|---------|
| Unit | Vitest | Pure functions, provider/AI abstractions, utilities | every phase |
| Integration | Vitest + test DB | module services, tenant scoping, jobs | from Phase 1 |
| Component | React Testing Library | design-system components + states | from Phase 1 |
| API | Vitest (route handler harness) | validation, auth, errors, quotas | with the first custom API routes (discovery REST deferred — pages use module queries) |
| E2E (light) | Playwright (added in Phase 9) | sign-up → dashboard → key flows | Phase 9 |

## 2. Test database

- A dedicated `vantage_test` Postgres database, migrated at test session start and truncated per
  test (transactional rollback where feasible).
- Tests seed minimal fictional fixtures via factories — **never the production demo dataset** —
  so tests stay deterministic and fast.

## 3. Required coverage by spec §41

### Authentication
- Registration creates user + default organization with membership
- Login succeeds/fails correctly; password never returned
- Protected routes reject unauthenticated requests
- Authorization: cross-org access returns not-found

### Database / tenancy
- Core relationships (store→products→ads→reviews) resolve
- Tenant isolation: two orgs cannot see each other's data (positive + negative cases)
- Ownership: no tenant row without `organizationId`

### Billing (IMPLEMENTED Phase 8 — `tests/billing.test.ts`, 23 tests)
- Plan catalog centralized; `/api/plans` leaks no price IDs or secrets
- Demo mode: unconfigured provider refuses (never fake charges); checkout → 503; portal → 404
- Checkout validation (unknown/free/unauth), server-side price selection, customer reuse
  (no duplicates), 409 when already PRO, client `organizationId` ignored
- Entitlements: FREE default; active/trialing → PRO; past_due → PRO + attention;
  canceled → effective FREE; cancel-at-period-end grace
- Usage quotas: monthly counters, over-quota → `OverQuotaError` → 429 + upgrade hint
  (route-level test on reports); tracked-competitor entitlement from live counts
- Webhooks: checkout/subscription/invoice events applied tenant-safely; replays are
  duplicates; unknown events ignored; route rejects missing/bad signatures and accepts
  a real HMAC-signed event (offline, no Stripe API calls); cross-tenant reads never leak

### Product/store search
- Filters, search terms, sorting behave as specified
- Permission: results never leak across orgs
- Empty queries return paginated defaults, not errors

### AI
- Provider abstraction resolves the configured provider (demo vs OpenAI-compatible)
- Unavailable provider → labeled Demo mode, no crash
- Failed AI request → error state, partial result preserved, retry path
- Cached analysis: identical request returns persisted result (no duplicate model call)
- Evidence grounding: tools are the only data source; fabricated records are impossible
  (tool return types are bounded by the DB schema)

### Reports
- Generation job produces all sections with provenance summary
- Authorization: report only readable by its org

### API
- Authentication on every protected route
- Validation: malformed/unknown fields rejected with 400
- Errors follow the standard envelope

## 4. Quality gates (GATE 5, every phase)

```
pnpm typecheck     # tsc --noEmit, strict
pnpm lint          # eslint (Next + import boundaries)
pnpm test          # vitest run
pnpm build         # production build (where appropriate)
```

A phase is not complete until all four pass. CI runs the same sequence on every pull request via
`.github/workflows/ci.yml` (added in Phase 0, once the hosting target was decided — ADR-011).

## 5. What we do NOT test (yet)

- No load/performance testing in the MVP
- No visual regression tooling (Playwright covers the top flows in Phase 9)
- No security scanning in CI initially; a manual security review happens in Phase 10

## 6. Test naming & structure conventions

- Files co-located: `*.test.ts` next to the unit, or in `tests/` mirroring `src/`.
- Names: `describe('<unit>')` → `it('should <behavior>')`.
- Each test asserts behavior, not implementation; no assertions on Prisma internals.
- Shared helpers in `tests/helpers/` (session stubs, org factories, demo provider fixtures).
