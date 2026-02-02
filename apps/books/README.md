# Books App - React Router OAuth2 Handbook Website

This is a port of the React Router OAuth2 Handbook website to Cloudflare Workers.

## 🚀 Quick Start

### Development

Start the local development server:

```bash
bun run dev
```

The app will be available at http://localhost:3000

### Type Generation

Generate Cloudflare Workers types:

```bash
bun run cf:typegen
```

Generate React Router types:

```bash
bun run rr:typegen
```

### Type Checking

Run TypeScript type checking:

```bash
bun run typecheck
```

## 📦 Building

Create a production build:

```bash
bun run build
```

## 🚢 Deployment

### Preview Deployment

Deploy to preview environment:

```bash
bun run deploy:preview
```

### Production Deployment

Before deploying to production, set the required secrets:

```bash
echo "YOUR_BUTTONDOWN_API_KEY" | wrangler secret put BUTTONDOWN_API_KEY
echo "YOUR_LOGSNAG_API_KEY" | wrangler secret put LOGSNAG_API_KEY
echo "YOUR_POLAR_ACCESS_TOKEN" | wrangler secret put POLAR_ACCESS_TOKEN
echo "YOUR_POLAR_WEBHOOK_SECRET" | wrangler secret put POLAR_WEBHOOK_SECRET
```

Then deploy:

```bash
bun run deploy
```

The app will be deployed to https://books.sergiodxa.com

## 🔧 Configuration

### Environment Variables

Local development uses `.dev.vars` file (not committed to git). The following variables are configured:

- `BUTTONDOWN_API_KEY` - API key for Buttondown email service
- `BUTTONDOWN_API_VERSION` - Buttondown API version (set in wrangler.jsonc)
- `LOGSNAG_API_KEY` - API key for LogSnag analytics
- `LOGSNAG_PROJECT` - LogSnag project name (set in wrangler.jsonc)
- `POLAR_ACCESS_TOKEN` - Access token for Polar payments
- `POLAR_WEBHOOK_SECRET` - Webhook secret for Polar webhooks

### Wrangler Configuration

The `wrangler.jsonc` file contains the Cloudflare Workers configuration:

- **Entry Point**: `app/entry.worker.ts`
- **Assets**: Serves static files from `build/client`
- **Custom Domain**: `books.sergiodxa.com`
- **Node.js Compatibility**: Enabled via `nodejs_compat` flag

## 🏗️ Architecture

This app uses:

- **React Router v7** - Full-stack React framework with SSR
- **Cloudflare Workers** - Serverless edge runtime
- **Vite** - Build tool and dev server
- **Tailwind CSS v4** - Utility-first CSS framework
- **TypeScript** - Type safety
- **Bun** - Fast package manager and runtime

### Key Files

- `app/entry.worker.ts` - Cloudflare Workers entry point
- `app/entry.server.tsx` - Server-side rendering entry
- `app/entry.client.tsx` - Client-side hydration entry
- `wrangler.jsonc` - Cloudflare Workers configuration
- `vite.config.ts` - Vite configuration
- `react-router.config.ts` - React Router configuration

## 📝 Features

- 📧 Email subscription via Buttondown
- 💳 Payment processing via Polar
- 🔔 Webhook handling for payment events
- 📊 Analytics via LogSnag
- 📖 Markdown content rendering
- 🎨 Dark mode support
- 🚀 Server-side rendering
- ⚡ Edge deployment

## 🧪 Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run start` - Preview production build locally
- `bun run deploy` - Deploy to production
- `bun run deploy:preview` - Deploy to preview environment
- `bun run typecheck` - Run TypeScript type checking
- `bun run rr:typegen` - Generate React Router types
- `bun run rr:routes` - List all routes
- `bun run cf:typegen` - Generate Cloudflare types
- `bun run lint` - Lint code with oxlint
- `bun run format` - Format code with oxfmt

## 📚 Learn More

- [React Router Documentation](https://reactrouter.com)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Vite Documentation](https://vite.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com)
