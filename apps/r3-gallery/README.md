# R3 Gallery

Client-only photo gallery SPA built with Vite, Remix UI, and `remix/spa`.

Production URL: https://r3-gallery.sergiodxa-cloudflare.workers.dev/

## Development

1. Copy `.env.example` to `.env.local` for local development if local variables are ever needed.
2. Run `bun run dev` to start the development server at http://localhost:3000.

## Cloudflare Services

| Service | Binding | Purpose                                |
| ------- | ------- | -------------------------------------- |
| None    | N/A     | This is a static client-only Vite SPA. |

## Features

- Lists albums from JSONPlaceholder.
- Jumps to an album from a form post that redirects, or from the mod+k search palette.
- Shows album photos at `/album/:id`.
- Likes album photos through the route table and persists likes in `localStorage`.
- Opens a photo over the album grid in a named `Frame`, so the address bar shows `/photo/:id` while the grid stays mounted.
- Renders only the photo page when visiting `/photo/:id` directly.

## Integrations

- **JSONPlaceholder** - Demo albums and photos API.

## Routes

| Route                                       | Description                                                    |
| ------------------------------------------- | -------------------------------------------------------------- |
| `/`                                         | Album list.                                                    |
| `POST /album`                               | Form action that redirects to the submitted album.             |
| `/album/:id`                                | Album photo grid.                                              |
| `POST /album/:albumId/photos/:photoId/like` | Toggles a persisted photo like and answers with its new state. |
| `/photo/:id`                                | Standalone photo page for direct visits and reloads.           |

## Scripts

| Script       | Description                           |
| ------------ | ------------------------------------- |
| `dev`        | Start the Vite development server.    |
| `build`      | Build the static SPA for production.  |
| `start`      | Preview the production build locally. |
| `cf:deploy`  | Build and deploy to Cloudflare.       |
| `cf:typegen` | Generate Cloudflare binding types.    |
| `typecheck`  | Type-check the app.                   |

## Deployment

This app builds to static assets and can be deployed with Cloudflare Workers static assets.

```bash
bun run cf:deploy
```

## Environment Variables

No environment variables are required. See `.env.example`, which is intentionally empty.
