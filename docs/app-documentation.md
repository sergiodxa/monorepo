# App Documentation Guidelines

This document describes how to write README files for apps in this monorepo.

## Structure

Every app README should follow this structure:

1. **Title** - App name as heading
2. **Description** - One-line description of what the app does
3. **Production URL** - Link to the deployed app
4. **Development** - How to run locally
5. **Cloudflare Services** - Services used with bindings and purposes
6. **Features** - Key capabilities
7. **Integrations** - External services (if applicable)
8. **Routes** - Main routes/endpoints
9. **Database** - Migration commands (if applicable)
10. **Scripts** - Available npm scripts
11. **Deployment** - How to deploy
12. **Documentation** - Link to docs folder (if applicable)
13. **Environment Variables** - Reference to `.env.example`

## Section Guidelines

### Title and Description

Use the app name as an H1 heading, followed by a one-line description and the production URL.

```markdown
# App Name

One-line description of what this app does.

Production URL: https://app.sergiodxa.com
```

### Development

Provide numbered steps to get the app running locally. Always include:

1. Copy `.env.example` to `.dev.vars`
2. Run the dev command with the local URL

```markdown
## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3000
```

### Cloudflare Services

Use a table with Service, Binding, and Purpose columns. List all Cloudflare services the app uses:

- D1 Database
- KV Namespace
- R2 Bucket
- Queues
- Durable Objects
- Workflows
- Analytics Engine
- Cron Triggers (use a separate table if multiple schedules)

```markdown
## Cloudflare Services

| Service     | Binding | Purpose                    |
| ----------- | ------- | -------------------------- |
| D1 Database | `DB`    | Stores users and content   |
| KV          | `CACHE` | Response caching           |
| R2          | `FILES` | User-uploaded file storage |

Observability is enabled.
```

For apps with multiple cron schedules, add a subsection:

```markdown
### Cron Triggers

| Schedule    | Purpose              |
| ----------- | -------------------- |
| `* * * * *` | Process pending jobs |
| `0 0 * * *` | Daily cleanup        |
```

### Features

Bullet list of key capabilities. Focus on what makes the app unique, not generic framework features.

```markdown
## Features

- OAuth 2.0 Authorization Server (RFC 6749)
- Multi-provider authentication (GitHub, Google, email/password)
- PKCE support for enhanced security
```

### Integrations

List external services the app integrates with. Only include if the app has integrations beyond Cloudflare services.

```markdown
## Integrations

- **Polar.sh** - Subscription and billing management
- **Resend** - Transactional emails for alerts
- **Auth SDK** - OAuth 2.0 integration with auth.sergiodxa.com
```

### Routes

Use a table with Route and Description columns. Group routes by category if there are many.

```markdown
## Routes

| Route    | Description                      |
| -------- | -------------------------------- |
| `/`      | Homepage                         |
| `/app/*` | Main application (authenticated) |
| `/api/*` | REST API                         |
```

For apps with many routes, use subsections:

```markdown
## Routes

### Public

| Route      | Description  |
| ---------- | ------------ |
| `/`        | Homepage     |
| `/pricing` | Pricing page |

### Authentication

| Route          | Description    |
| -------------- | -------------- |
| `/auth/login`  | Login page     |
| `/auth/logout` | Logout handler |
```

### Database

Only include if the app uses a database. Show migration commands in a code block.

```markdown
## Database

Migrations are located in `db/migrations/`.

\`\`\`bash
bun run db:local:migrate # Apply migrations locally
bun run db:remote:migrate # Apply migrations to production
bun run orm:generate # Generate Drizzle migrations
\`\`\`
```

### Scripts

Use a table with Script and Description columns. List the script name without `bun run` prefix.

```markdown
## Scripts

| Script      | Description              |
| ----------- | ------------------------ |
| `dev`       | Start development server |
| `build`     | Build for production     |
| `cf:deploy` | Deploy to Cloudflare     |
```

### Deployment

Keep it simple - just the deploy command.

```markdown
## Deployment

\`\`\`bash
bun run cf:deploy
\`\`\`
```

### Documentation

Only include if the app has a `docs/` folder with additional documentation.

```markdown
## Documentation

Detailed documentation is available in the `docs/` folder:

- `docs/overview.md` - Getting started guide
- `docs/api/` - API reference
- `docs/concepts/` - Core concepts explained
```

### Environment Variables

Always reference `.env.example` instead of listing variables. This avoids duplication.

```markdown
## Environment Variables

See `.env.example` for required environment variables.
```

## Template

```markdown
# App Name

One-line description of what this app does.

Production URL: https://app.sergiodxa.com

## Development

1. Copy `.env.example` to `.dev.vars` for local development
2. Run `bun run dev` to start the development server at http://localhost:3000

## Cloudflare Services

| Service     | Binding | Purpose              |
| ----------- | ------- | -------------------- |
| D1 Database | `DB`    | Primary data storage |
| KV          | `KV`    | Caching              |

Observability is enabled.

## Features

- Feature one
- Feature two
- Feature three

## Integrations

- **Service Name** - What it's used for

## Routes

| Route  | Description |
| ------ | ----------- |
| `/`    | Homepage    |
| `/app` | Main app    |

## Database

Migrations are located in `db/migrations/`.

\`\`\`bash
bun run db:local:migrate # Apply migrations locally
bun run db:remote:migrate # Apply migrations to production
bun run orm:generate # Generate Drizzle migrations
\`\`\`

## Scripts

| Script      | Description              |
| ----------- | ------------------------ |
| `dev`       | Start development server |
| `build`     | Build for production     |
| `cf:deploy` | Deploy to Cloudflare     |

## Deployment

\`\`\`bash
bun run cf:deploy
\`\`\`

## Environment Variables

See `.env.example` for required environment variables.
```

## Writing Style

- Do not use emojis
- Use tables for structured data (services, routes, scripts)
- Keep descriptions concise
- Reference `.env.example` instead of listing environment variables
- Link to `docs/` folder for detailed documentation instead of duplicating content
- Use consistent table formatting with aligned columns
