# ADR-100: Migrate Apps from Wrangler to the cf CLI

## Status

**Accepted** - 2026-09-28

## Background

Cloudflare shipped `cf`, a CLI that covers the whole Cloudflare API and replaces Wrangler as the
tool for developing and deploying Workers. Wrangler moves to maintenance support. Every app in
`apps/` is configured with a `wrangler.jsonc` and deploys, migrates and generates types through
`bunx wrangler`, so each one has to move.

## Context

A `cf` project is configured in a typed `cloudflare.config.ts` (`defineConfig` from `cf/config`)
instead of `wrangler.jsonc`. `cf migrate` converts an existing config and lists the follow-up
work it cannot do. The pieces around the config each have their own constraint:

- **Vite plugin.** Only `@cloudflare/vite-plugin` 2.0 (beta) reads `cloudflare.config.ts`, and it
  reads nothing else: a 2.0 app has no `wrangler.jsonc` and a 1.x app has no
  `cloudflare.config.ts`. The build output moves to `.cloudflare/output`, which
  `cf deploy --prebuilt` uploads as-is.
- **Types.** `cf workers types` writes `.cloudflare/types/index.d.ts` from the config.
  Secrets declared with `bindings.secret()` are typed from the config, so the type of `env`
  stops depending on `.dev.vars` or `.env.example`. It needs no credentials, so CI runs it
  unchanged through each app's `cf:typegen` script.
- **Workers test pool.** `@cloudflare/vitest-pool-workers` (0.22.0, the latest) still reads its
  bindings from a Wrangler config file. The apps with `*.workers.test.ts` projects — blog,
  uptime, reader and auth-saas — cannot drop `wrangler.jsonc` until the pool reads the new
  format.
- **miniflare.** `cf` and the 2.0 plugin both require `miniflare@5.20260926.0-alpha`; the root
  `overrides` entry pins miniflare repo-wide, so it moves to that version for every workspace.
- **D1.** `cf d1 migrations apply` records migrations in the same table shape Wrangler does, so
  an already-migrated database carries over. It identifies the database by ID, and its local
  state lives under `~/.config/cloudflare/state`, so local databases start empty after the move.
- **`cf dev`** delegates to `npx vite`; the `dev` and `build` scripts call `vite` directly so
  every step stays inside Bun.

## Decision

Migrate one app at a time, starting with `apps/books`: it has no storage bindings and no
Workers-pool tests, so it exercises the config, plugin, typegen and deploy path alone.

A migrated app:

1. Replaces `wrangler.jsonc` with `cloudflare.config.ts`, declaring every secret with
   `bindings.secret()`.
2. Depends on exact pins of `cf` and `@cloudflare/vite-plugin` 2.0 beta in place of `wrangler`.
3. Runs `vite dev` / `vite build`, `cf deploy --prebuilt` as `cf:deploy`, and
   `cf workers types` as `cf:typegen`.
4. Includes `.cloudflare/types/index.d.ts` and `cloudflare.config.ts` in its tsconfig and
   ignores `/.cloudflare`.

The four apps with Workers-pool tests wait until the pool reads `cloudflare.config.ts`, rather
than declaring their bindings twice.

## Consequences

### Positive

- Worker config is typed and checked by `bun check` like any other module.
- `env` types come from the config alone, including secrets.
- One CLI covers deploy, secrets, D1 and the rest of the account.

### Negative

- Two config formats coexist while the Workers-pool apps wait.
- `cf` and the 2.0 plugin are betas, pinned exactly; upgrades are deliberate.

### Neutral

- The root `bunx wrangler` rule in `AGENTS.md` still applies to apps that have not moved.

## Current Progress

- [x] `apps/books`
- [ ] `apps/demo`, `apps/r3-auth`, `apps/r3-gallery`, `apps/sdxc`, `apps/blog-saas`
- [ ] `apps/blog`, `apps/uptime`, `apps/reader`, `apps/auth-saas` (blocked on the Workers pool)

## References

- [Cloudflare blog: the cf CLI](https://blog.cloudflare.com/cloudflare-cf-cli-launch/)
