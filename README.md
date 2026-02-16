# Monorepo

Personal projects ecosystem with applications and shared packages.

## Structure

```
apps/              # Applications
packages/          # Shared packages
docs/              # Documentation and ADRs
.agents/skills/    # AI agent skills
```

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: React Router v7
- **Package manager**: Bun
- **Database**: Cloudflare D1 + Drizzle ORM
- **Styling**: Tailwind CSS v4

## Getting Started

Prerequisites: [Bun](https://bun.sh)

```bash
bun install              # Install dependencies
cd apps/<name>           # Navigate to an app
bun run dev              # Start development server
```

## Commands

Run from the repository root:

| Command          | Description              |
| ---------------- | ------------------------ |
| `bun format`     | Check formatting         |
| `bun format:fix` | Fix formatting           |
| `bun lint`       | Check linting            |
| `bun lint:fix`   | Fix linting issues       |
| `bun typecheck`  | TypeScript type checking |
| `bun test`       | Run all tests            |

## Workspace Imports

- `@pkg/*` - Package imports (e.g., `import { success } from "@pkg/result"`)
- `~/` - App-relative imports (e.g., `import { Button } from "~/components/button"`)

## Documentation

- `docs/` - Technical documentation and Architecture Decision Records (ADRs)
- `docs/<app>/` - App-specific ADRs (e.g., `docs/uptime/ADR-001-analytics-engine-migration.md`)
- `docs/package-documentation.md` - Guidelines for writing package READMEs
- Apps may also have user-facing documentation in `apps/<name>/docs/`

## Apps

| App                   | Description                           | URL                          |
| --------------------- | ------------------------------------- | ---------------------------- |
| [auth](apps/auth)     | OAuth 2.0 / OIDC authorization server | https://auth.sergiodxa.com   |
| [blog](apps/blog)     | Personal blog and CMS                 | https://sergiodxa.com        |
| [books](apps/books)   | Book landing page                     | https://books.sergiodxa.com  |
| [uptime](apps/uptime) | Infrastructure monitoring service     | https://uptime.sergiodxa.com |

## Packages

| Package                                 | Description                                 |
| --------------------------------------- | ------------------------------------------- |
| [auth-sdk](packages/auth-sdk)           | OAuth 2.0 client SDK for auth.sergiodxa.com |
| [cn](packages/cn)                       | Class name utility                          |
| [db-helpers](packages/db-helpers)       | Database helper utilities for Drizzle       |
| [get-client-ip](packages/get-client-ip) | Extract client IP from requests             |
| [jobs](packages/jobs)                   | Job queue utilities                         |
| [location](packages/location)           | Geolocation utilities                       |
| [logger](packages/logger)               | Request-scoped logging                      |
| [markdown](packages/markdown)           | Markdown processing utilities               |
| [response](packages/response)           | HTTP response utilities                     |
| [result](packages/result)               | Result type for error handling              |
| [types](packages/types)                 | Shared TypeScript types                     |
| [ui](packages/ui)                       | Shared UI components                        |
| [validate](packages/validate)           | Input validation with Zod                   |
