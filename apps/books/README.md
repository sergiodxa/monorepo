# Books App

Landing page and sales funnel for the "React Router OAuth2 Handbook" book.

Production URL: https://books.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3000

## Cloudflare Services

Smart Placement and Observability (with 10% trace sampling) are enabled. No storage bindings.

## Features

- Email subscription via Buttondown
- Payment processing via Polar
- Webhook handling for payment events
- Markdoc content rendering with Prism syntax highlighting
- Dark mode support

## Integrations

- **Buttondown** - Email list management and subscriptions
- **Polar** - Payment processing and checkout sessions

## Routes

| Route                 | Description                           |
| --------------------- | ------------------------------------- |
| `/`                   | Homepage with email capture form      |
| `/release`            | Post-subscription page with pricing   |
| `/sample`             | Gated sample chapter (requires email) |
| `/upgrade`            | Upgrade path for existing customers   |
| `/api/subscribe`      | Email subscription handler            |
| `/api/checkout/:type` | Polar checkout redirect               |
| `/webhooks/polar`     | Polar webhook handler                 |

## Scripts

| Script       | Description                 |
| ------------ | --------------------------- |
| `dev`        | Start development server    |
| `build`      | Build for production        |
| `start`      | Preview production build    |
| `cf:deploy`  | Deploy to Cloudflare        |
| `cf:typegen` | Generate Cloudflare types   |
| `rr:routes`  | List React Router routes    |
| `rr:typegen` | Generate React Router types |

## Deployment

```bash
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required environment variables.
