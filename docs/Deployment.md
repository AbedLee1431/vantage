# Deployment Guide

> Production deployment guide for Vantage. This document explains how to build, configure,
> migrate, start, health-check, and operate the application in a production-like environment.

## Prerequisites

- Node.js 22+ (LTS)
- pnpm 9+
- PostgreSQL 15+
- Docker (optional, for containerized deployment)
- Stripe account (optional, for billing)
- OpenAI-compatible API key (optional, for live AI)

## 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Auth.js session signing secret (`openssl rand -base64 32`) |
| `APP_URL` | Canonical app URL (e.g., `https://yourdomain.com`) |

### Optional — AI Provider

| Variable | Purpose |
|----------|---------|
| `AI_PROVIDER` | `demo` (default) or `openai-compatible` |
| `AI_MODEL` | Model ID (required for live AI) |
| `AI_API_KEY` | Provider API key (server-side only) |
| `AI_BASE_URL` | Custom endpoint (default: OpenAI) |
| `AI_TIMEOUT_MS` | Request timeout (default: 30000) |
| `AI_MAX_TOKENS` | Token budget per call (default: 2000) |

### Optional — Stripe Billing

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key (test or live) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRICE_PRO` | Price ID for Pro plan |

### Optional — Background Jobs

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Bearer secret for `POST /api/jobs/process` |

## 2. Database Setup

### Create Database

```bash
createdb vantage
```

### Run Migrations

```bash
pnpm db:deploy
```

### Seed Demo Data (Optional)

```bash
pnpm db:seed
```

## 3. Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

## 4. Start

```bash
pnpm start
```

The application starts on `http://localhost:3000` by default. Set `PORT` to change.

## 5. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response: `{"status":"ok","timestamp":"..."}`

## 6. Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables
4. Deploy

Vercel automatically:
- Runs `pnpm build`
- Serves the production build
- Provides HTTPS

### Cron Jobs (Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/jobs/process",
      "schedule": "* * * * *"
    }
  ]
}
```

Set `CRON_SECRET` in Vercel environment variables.

## 7. Docker Deployment

### Build Image

```bash
docker build -t vantage .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e AUTH_SECRET=... \
  -e APP_URL=https://yourdomain.com \
  vantage
```

### Docker Compose (with PostgreSQL)

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://vantage:vantage@db:5432/vantage
      - AUTH_SECRET=${AUTH_SECRET}
      - APP_URL=${APP_URL}
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:17
    environment:
      POSTGRES_USER: vantage
      POSTGRES_PASSWORD: vantage
      POSTGRES_DB: vantage
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U vantage -d vantage"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_data:
```

## 8. Stripe Test-Mode Configuration

1. Get test-mode keys from Stripe Dashboard
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_PRO`
3. Set `STRIPE_WEBHOOK_SECRET` (from `stripe listen` or Dashboard)
4. Configure webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`

### Stripe CLI (Local Testing)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 9. AI Provider Configuration

### Demo AI (Default)

No configuration needed. AI features run in clearly labeled Demo mode.

### OpenAI-Compatible

```bash
AI_PROVIDER=openai-compatible
AI_API_KEY=sk-...
AI_MODEL=gpt-4o
# Optional: AI_BASE_URL=https://api.openai.com/v1
```

## 10. CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR:

- Typecheck
- Lint
- Format check
- Tests (with PostgreSQL service)
- Build

## 11. Troubleshooting

### Database Connection Failed

- Verify `DATABASE_URL` format
- Ensure PostgreSQL is running and accessible
- Check firewall/security group settings

### Auth Errors

- Verify `AUTH_SECRET` is set and stable across restarts
- Ensure `APP_URL` matches the actual domain

### Stripe Webhooks Failing

- Verify `STRIPE_WEBHOOK_SECRET` matches
- Check endpoint URL is accessible
- Use `stripe listen` for local debugging

### AI Features Not Working

- Check `AI_PROVIDER` and `AI_API_KEY` configuration
- Verify `AI_BASE_URL` is reachable
- Check server logs for provider errors

## 12. Rollback Considerations

- Database migrations are additive (no destructive changes in MVP)
- To rollback: redeploy previous version + run `pnpm db:deploy` (migrations are reversible)
- Stripe subscriptions are managed in Stripe Dashboard
- No data loss on redeploy (data persists in PostgreSQL)

## 13. Backup/Recovery

### Database Backups

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Recovery

```bash
psql $DATABASE_URL < backup_20240101.sql
```

### Stripe Data

Stripe is the source of truth for subscription/billing data. Local `Subscription` and
`UsageRecord` tables are caches that can be rebuilt from Stripe webhooks.

## 14. Production Checklist

- [ ] `AUTH_SECRET` set to strong random value
- [ ] `APP_URL` set to production domain
- [ ] `DATABASE_URL` points to production PostgreSQL
- [ ] `NODE_ENV=production`
- [ ] Stripe keys configured (if using billing)
- [ ] AI provider configured (if using live AI)
- [ ] `CRON_SECRET` set (if using cron jobs)
- [ ] Health check endpoint accessible
- [ ] HTTPS enabled
- [ ] Security headers verified
- [ ] Database backups configured
- [ ] Error monitoring configured (optional)
