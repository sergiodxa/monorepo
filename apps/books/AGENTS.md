# React Router OAuth2 Handbook - Agent Instructions

This is a landing page and sales funnel for the "React Router OAuth2 Handbook" book, built with React Router v7 and deployed on Cloudflare Workers.

## Project Overview

- **Framework**: React Router v7 in framework mode
- **Runtime**: Cloudflare Workers
- **Styling**: Tailwind CSS v4
- **Content**: Markdoc for sample chapter rendering
- **Integrations**: Buttondown (email), Polar (payments)

## Architecture

### Entry Points

- `app/entry.worker.ts` - Cloudflare Workers entry point
- `app/entry.server.tsx` - Server-side rendering entry
- `app/entry.client.tsx` - Client-side hydration entry

### Key Routes

- `/` - Homepage with email capture form
- `/release` - Post-subscription page with pricing and product info
- `/sample` - Gated sample chapter (requires email)
- `/upgrade` - Upgrade path for existing customers
- `/api/subscribe` - Email subscription handler
- `/api/checkout/:type` - Polar checkout redirect (essentials/complete)
- `/webhooks/polar` - Polar webhook handler for payment events

### Services

All services use the `cloudflare:workers` module for environment variables:

1. **Buttondown** (`app/services/buttondown.ts`)
   - Email list management
   - **Important**: Uses `globalThis.fetch.bind(globalThis)` to avoid "Illegal invocation" errors
   - Handles subscriber status and metadata

2. **Polar** (`app/services/polar.ts`)
   - Payment processing
   - Checkout session creation
   - Customer management

### Configuration Files

- `wrangler.jsonc` - Cloudflare Workers configuration
  - **Line 18 (routes)**: Only needed for production deployment with custom domain
  - Can be removed for local development only
  - Environment variables are set in `.dev.vars` (gitignored)

- `vite.config.ts` - Vite configuration with Cloudflare plugin
- `react-router.config.ts` - React Router configuration
- `tsconfig.json` - TypeScript configuration

## Development

### Local Development

```bash
bun run dev  # Starts dev server on http://localhost:3000
```

The dev server:

- Runs Vite with Cloudflare Workers emulation
- Hot reloads on file changes
- Loads environment variables from `.dev.vars`

### Environment Variables

Required in `.dev.vars`:

```
BUTTONDOWN_API_KEY=your_key
BUTTONDOWN_API_VERSION=2024-07-01
POLAR_ACCESS_TOKEN=your_token
POLAR_WEBHOOK_SECRET=your_secret
```

## Important Implementation Details

### Fetch Binding Issue

When using `fetch` in Cloudflare Workers with third-party libraries:

- **Problem**: Passing `fetch` directly causes "Illegal invocation" errors
- **Solution**: Use `globalThis.fetch.bind(globalThis)`
- **Location**: `app/services/buttondown.ts` line 67

### Sample Chapter Gating

The `/sample` route implements a lead capture pattern:

- Direct navigation shows email form
- After email submission, shows sample content
- Content doesn't persist across reloads (intentional - requires re-entering email)
- Already-subscribed emails still get access immediately

### Webhook Security

Polar webhooks (`/webhooks/polar`) verify signatures using `POLAR_WEBHOOK_SECRET` to ensure requests are authentic.

## Common Tasks

### Adding a New Route

1. Create file in `app/routes/` (e.g., `new-page.tsx`)
2. Export default component and optional `loader`/`action` functions
3. Use React Router's type-safe route types from `./+types/new-page`

### Adding Environment Variables

1. Add to `.dev.vars` for local development
2. Add to `wrangler.jsonc` under `vars` for public variables
3. Add to Cloudflare dashboard for secrets (don't commit in `wrangler.jsonc`)
4. Access via `import { env } from "cloudflare:workers"`

### Updating Content

- Marketing copy: Edit components in `app/routes/`
- Sample chapter: Edit `app/data/sample.md` (Markdoc format)
- FAQ: Edit `app/data/frequent-questions.ts`
- Product info: Edit `app/data/product.ts`

## Deployment

### Preview Deployment

```bash
bun run deploy:preview
```

### Production Deployment

```bash
bun run deploy
```

**Note**: The `routes` configuration in `wrangler.jsonc` (line 18) maps the worker to `books.sergiodxa.com`. Remove or modify this if deploying to a different domain.

## Testing Checklist

When making changes, test:

1. ✅ Homepage email form submission
2. ✅ Redirection to `/release` after subscription
3. ✅ Polar checkout links (don't complete purchase)
4. ✅ `/sample` page access with email
5. ✅ Sample content rendering (Markdoc + Prism syntax highlighting)
6. ✅ All environment variables are properly bound

If needed, use `hello@sergiodxa.com` as a test email.

## Troubleshooting

### "Illegal invocation" errors

- Ensure `fetch` is bound correctly: `globalThis.fetch.bind(globalThis)`
- Check `@edgefirst-dev/api-client` usage in services

### Subscription not working

- Verify `BUTTONDOWN_API_KEY` is set in `.dev.vars`
- Check Buttondown service is properly initialized
- Look for errors in browser console and server logs

### Polar checkout not redirecting

- Verify `POLAR_ACCESS_TOKEN` is valid
- Check product IDs in `app/data/product.ts` match Polar dashboard
- Ensure Polar service is using correct API endpoints

### Sample chapter not rendering

- Check `app/data/sample.md` has valid Markdoc syntax
- Verify Prism CSS is loading (check browser network tab)
- Ensure action is returning transformed Markdoc AST

## File Structure

```
app/
├── assets/         # Images and static assets
├── components/     # Reusable React components
├── data/           # Static data and content
├── helpers/        # Utility functions
├── routes/         # Route handlers and pages
├── services/       # External service integrations
├── use-case/       # Business logic
├── app.css         # Global styles
├── entry.*.ts      # Entry points
└── root.tsx        # Root layout

public/             # Public static files
build/              # Build output (gitignored)
node_modules/       # Dependencies (gitignored)
```

## Performance Considerations

- Assets are served from Cloudflare's edge network
- Server-side rendering for initial page load
- Client-side hydration for interactivity
- Markdoc content is transformed at runtime (consider pre-rendering for production)
