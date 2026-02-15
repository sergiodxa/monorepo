# Uptime Application Documentation

Technical documentation for the Uptime monitoring application.

## Architecture Decision Records (ADRs)

- [ADR-001: Analytics Engine Migration](./ADR-001-analytics-engine-migration.md) - Migration plan for moving monitor results to Cloudflare Analytics Engine

## Application Overview

Uptime is a monitoring application built on Cloudflare Workers that supports:

- **HTTP Monitoring** - Endpoint availability with response time tracking
- **DNS Monitoring** - DNS record verification and change detection
- **TCP Monitoring** - Port connectivity checks
- **Cron Job Monitoring** - Heartbeat monitoring for scheduled tasks
- **SSL Monitoring** - Certificate expiry tracking (being separated from HTTP monitors)
- **Status Pages** - Public status pages for services
- **Alerting** - Email, Slack, Discord, and webhook notifications

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Framework:** React Router v7 (framework mode)
- **Database:** Cloudflare D1 (SQLite)
- **ORM:** Drizzle ORM
- **Analytics:** Cloudflare Analytics Engine (for time-series data)
- **Queue:** Cloudflare Queues
- **Cache:** Cloudflare KV
- **Workflows:** Cloudflare Workflows (for HTTP ping orchestration)
- **Durable Objects:** GeoFetch DO (for regional ping distribution)

## Key Directories

```
apps/uptime/
├── app/
│   ├── components/     # Shared React components
│   ├── do/             # Durable Objects (GeoFetch)
│   ├── jobs/           # Queue job handlers
│   ├── middleware/     # React Router middleware
│   ├── models/         # Data models
│   ├── routes/         # React Router routes
│   ├── services/       # Business logic services
│   ├── workflows/      # Cloudflare Workflows
│   └── entry.worker.ts # Worker entry point
├── db/
│   ├── schema.ts       # Drizzle schema definitions
│   ├── migrations/     # SQL migrations
│   └── index.ts        # Database connection
└── wrangler.jsonc      # Cloudflare configuration
```

## Related Skills

When working on this application, load these skills as needed:

- `cloudflare` - General Cloudflare Workers patterns
- `durable-objects` - For GeoFetch DO modifications
- `frontend-react-router-best-practices` - For route/loader/action patterns
- `logging-best-practices` - For logging patterns

## External Documentation

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [React Router](https://reactrouter.com/)
