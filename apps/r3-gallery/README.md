# R3 Gallery

Client-only photo gallery SPA built with Vite, Remix UI, and `@pkg/r3-ui-router`.

Production URL: Not deployed.

## Development

1. Copy `.env.example` to `.env.local` for local development if local variables are ever needed.
2. Run `bun run dev` to start the development server at http://localhost:3000.

## Cloudflare Services

| Service | Binding | Purpose                                |
| ------- | ------- | -------------------------------------- |
| None    | N/A     | This is a static client-only Vite SPA. |

## Features

- Lists albums from JSONPlaceholder.
- Shows album photos at `/album/:id`.
- Opens photos over the album grid with masked `/photo/:id` URLs.
- Renders only the photo page when visiting `/photo/:id` directly.

## Integrations

- **JSONPlaceholder** - Demo albums and photos API.

## Routes

| Route        | Description                                                       |
| ------------ | ----------------------------------------------------------------- |
| `/`          | Album list.                                                       |
| `/album/:id` | Album photo grid, optionally with a modal photo from `?photoId=`. |
| `/photo/:id` | Standalone photo page for direct visits and reloads.              |

## Scripts

| Script  | Description                           |
| ------- | ------------------------------------- |
| `dev`   | Start the Vite development server.    |
| `build` | Build the static SPA for production.  |
| `start` | Preview the production build locally. |

## Deployment

This app builds to static assets and can be deployed with any static hosting service.

```bash
bun run build
```

## Environment Variables

No environment variables are required. See `.env.example`, which is intentionally empty.
