# Uptime App

Infrastructure monitoring service that tracks website availability, API health, DNS records, TCP ports, and scheduled tasks. Includes public status pages and multi-channel alerting.

Production URL: https://uptime.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3002

## Cloudflare Services

| Service          | Binding        | Purpose                                                                |
| ---------------- | -------------- | ---------------------------------------------------------------------- |
| D1 Database      | `DB`           | Stores monitors, alerts, incidents, status pages, teams, and user data |
| KV               | `KV`           | Caching and session storage                                            |
| Queues           | `QUEUE`        | Async processing of monitoring jobs                                    |
| Durable Objects  | `GeoFetchDO`   | Coordinates geo-distributed HTTP fetches from multiple locations       |
| Workflows        | `PING`         | Orchestrates multi-step monitoring workflows with retries and state    |
| Analytics Engine | `PING_RESULTS` | Time-series monitoring data for latency graphs and uptime calculations |

### Cron Triggers

| Schedule       | Purpose                             |
| -------------- | ----------------------------------- |
| `* * * * *`    | HTTP monitors and cron job monitors |
| `*/5 * * * *`  | TCP monitors                        |
| `*/10 * * * *` | Domain verification                 |
| `0 * * * *`    | DNS monitors                        |
| `0 0 * * *`    | Cleanup of old data                 |
| `0 1 * * *`    | Aggregate daily statistics          |
| `0 6 * * *`    | SSL certificate checks              |

Observability is enabled.

## Features

- HTTP Monitors - website/API availability, response times, content verification
- DNS Monitors - verify DNS records resolve correctly
- TCP Monitors - monitor server ports and services
- SSL Certificate Monitoring - track certificate expiration
- Cron Job Monitoring - track scheduled tasks, alert on missed runs
- Public/Private Status Pages - communicate service health
- Maintenance Windows - pause monitoring during planned downtime
- Team Management - multi-user with roles and permissions
- Multi-channel Alerts - email, webhooks, integrations

## Integrations

- **Polar.sh** - Subscription and billing management
- **Resend** - Transactional emails for alerts
- **Auth SDK** - OAuth 2.0 integration with auth.sergiodxa.com

## Routes

| Route               | Description                      |
| ------------------- | -------------------------------- |
| `/`                 | Landing page                     |
| `/app/*`            | Main application (authenticated) |
| `/status/:slug`     | Public status pages              |
| `/docs/*`           | Documentation                    |
| `/api/*`            | REST API                         |
| `/invite/:inviteId` | Team invite acceptance           |

## Database

Migrations are located in `db/migrations/`.

```bash
bun run db:local:migrate   # Apply migrations locally
bun run db:remote:migrate  # Apply migrations to production
bun run db:local:drop      # Drop local database
bun run orm:generate       # Generate Drizzle migrations
```

## Scripts

| Script              | Description                 |
| ------------------- | --------------------------- |
| `dev`               | Start development server    |
| `build`             | Build for production        |
| `start`             | Preview production build    |
| `cf:deploy`         | Deploy to Cloudflare        |
| `cf:typegen`        | Generate Cloudflare types   |
| `rr:routes`         | List React Router routes    |
| `rr:typegen`        | Generate React Router types |
| `typecheck`         | TypeScript type checking    |
| `db:local:drop`     | Drop local database         |
| `db:local:migrate`  | Apply local migrations      |
| `db:remote:migrate` | Apply remote migrations     |
| `orm:generate`      | Generate Drizzle migrations |

## Deployment

```bash
bun run cf:deploy
```

## Documentation

Architecture decisions for this app are available in `../../docs/adr/uptime/`.

## Environment Variables

See `.env.example` for required environment variables.
