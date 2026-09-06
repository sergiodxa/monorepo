# reader

Follow any site that publishes RSS or Atom and read everything it writes in one place.

Production URL: https://reader.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3006

From the repo root: `bun check` (format, lint and type check in one pass) and `bun run test`.

## Cloudflare Services

| Service | Binding | Purpose                                           |
| ------- | ------- | ------------------------------------------------- |
| KV      | `KV`    | Session storage and the OIDC discovery/JWKS cache |

Observability is enabled. The KV namespace id in `wrangler.jsonc` is a placeholder:
create the namespace with `bunx wrangler kv namespace create` and paste its id into both
`id` and `preview_id` before the first deploy.

## Features

- Sign-in through the OpenID Connect provider at auth.sergiodxa.com
- A reading queue of the unread items across every followed feed
- Follow and unfollow RSS and Atom feeds
- Interface in English and Spanish, resolved per request

## Integrations

- **auth.sergiodxa.com** - OpenID Connect provider for sign-in and sign-out

## Routes

### Public

| Route     | Description                                               |
| --------- | --------------------------------------------------------- |
| `/`       | Landing page; a signed-in visitor is sent to `/reading`   |
| `/auth`   | `GET` completes the OIDC callback, `POST` starts the flow |
| `/logout` | `GET` confirms, `POST` ends the session                   |

### Signed in

| Route                 | Description                            |
| --------------------- | -------------------------------------- |
| `/reading`            | The unread queue across every feed     |
| `/feeds`              | `GET` lists feeds, `POST` follows one  |
| `/feeds/:feedId`      | `GET` shows a feed, `DELETE` unfollows |
| `/items/:itemId/read` | Marks an item read                     |
| `/settings`           | Reading preferences                    |

## Scripts

| Script       | Description                           |
| ------------ | ------------------------------------- |
| `dev`        | Start development server              |
| `build`      | Build for production                  |
| `start`      | Preview the production build          |
| `cf:deploy`  | Deploy to Cloudflare                  |
| `cf:typegen` | Generate the Cloudflare binding types |
| `typecheck`  | Type check with `tsc`                 |

## Deployment

```bash
bun run build
bun run cf:deploy
```

## Environment Variables

See `.env.example` for required environment variables.
