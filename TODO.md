# TODO — SaaS platform follow-up work

Scope: `apps/auth-saas`, `apps/blog-saas`, `packages/blog-engine`, `packages/oidc-provider`.

## Done (committed on `main`, green: typecheck 0 ×4, tests 22 + 254 + 38)

- All findings in `saas-code-review.md` (security fixes across the four).
- Leveraged Remix built-ins: `remix/cop-middleware` (`cop()`) for CSRF; `remix/session-middleware` + `createCookieSessionStorage` for the blog-saas dashboard session; `createAction`/`createController` instead of the local `action`/`form` helpers (deleted).
- `@pkg/service-container` DI (ADR-008) in all four: `Database` (+ app services) registered in a `ServiceContainer`, `container.scope(() => router.fetch())` at the entrypoint, controllers use `inject([Database, …] as const, async (db, …) => { let ctx = getContext(); … })`, jobs/middleware use `getServiceContainer().get(Database)`.

`main` is ahead of `origin` and **unpushed** — push only when asked.

## Remaining work

### 1. remix/ui JSX for auth-saas (drop `remix/html-template`)
auth-saas still renders HTML via `remix/html-template` `` html`…` `` strings. Convert its views to `remix/ui` JSX + `css()` mixins, matching blog-engine/blog-saas.
- **Files** (14): `apps/auth-saas/resources/layouts/document.ts` (the layout) and every `apps/auth-saas/app/http/controllers/**` that imports `remix/html-template` (dashboard + tenants/{billing,branding,hostname,clients,resources,users,…}, `dashboard/index.ts`, `app/http/controllers/index.ts` landing page, `onboarding/callback.ts` `renderError`). `app/lib/user-agent.ts` uses `html` only to build safe snippets — leave or adapt.
- **Prereq**: auth-saas has **no render middleware**. Add one mirroring `apps/blog-saas/app/http/middleware/render.ts` (`renderWith` + `renderToString`), install it in `apps/auth-saas/bootstrap/app.ts` globals, then controllers `return ctx.render(<Component/>)` instead of `html(...)`.
- **Styles**: auth-saas uses Tailwind-CDN class strings today; introduce `apps/auth-saas/app/views/styles.ts` with `css()` mixins (reference `apps/blog-saas/app/views/styles.ts` and `packages/blog-engine/src/shared/components/styles.ts`). Reuse the `selectControl`/`mixFor` cast for `<select>` (workers-types `Element` shadow — see blog-engine styles).
- **oidc-provider**: already JSX (see `packages/oidc-provider/src/shared/home.tsx`); only `src/shared/lib/user-agent.ts` uses `html-template` (a util, not a view) — no view work needed.

### 2. Vite client-side JS for both apps
Add client bundling so `remix/ui` interactivity hydrates. Reference: `apps/r3-blog/vite.config.ts` (a `client` environment whose rollup input is `bootstrap/browser.ts`) + `apps/r3-blog/bootstrap/browser.ts` (`run()` from `remix/ui`, `import.meta.glob` of `routes`/`resources`, `resolveFrame`).
- **blog-saas**: only `apps/blog-saas/vite.config.ts` (no client env). Add the `client` environment + create `apps/blog-saas/bootstrap/browser.ts`.
- **auth-saas**: has `apps/auth-saas/vite.config.client.ts` already — review it, and create `apps/auth-saas/bootstrap/browser.ts` if missing (there is none today).
- Load the emitted client asset via a `<script type="module">` in each app's document layout.

### 3. Extract shared `@pkg/*` packages for duplicated helpers
Document each per `docs/guides/package-documentation.md` (README) and give every symbol JSDoc (see #6).
- **CF-for-SaaS custom hostname client**: near-identical in `apps/auth-saas/app/services/hostname.ts` and `apps/blog-saas/app/services/hostname.ts`.
- **Polar client**: `apps/auth-saas/app/services/polar.ts` and `apps/blog-saas/app/services/polar.ts` overlap (checkout/portal/ingest + `validateEvent` verification).
- **OIDC RP client** (discover/PKCE/exchange/verify): `apps/blog-saas/app/lib/oidc.ts` vs `packages/blog-engine/src/auth/oidc.ts` (the latter uses `remix/auth`) vs the auth-saas onboarding flow — reconcile toward `remix/auth` if possible.
- Minor: `trailing-slash` middleware (auth-saas + blog-engine), the `container.ts` setup shape.

### 4. Business-logic tests (engines)
Run with `bun test`. Reference existing: `packages/blog-engine/src/post-types/models/article.test.ts`, `packages/oidc-provider/src/**/*.test.ts`.
- **blog-engine** (has 5 test files): add roles/permissions resolution, theme derivation, SQL session-storage expiry (`src/database/session-storage.ts`), open-redirect `safeNext` (`src/auth/controllers/auth.tsx`).
- **oidc-provider** (15 files): add `allowed_resources` enforcement + refresh-token gating (`src/oauth/controllers/token.ts`), signing-key/tenant-meta per-`Database` cache isolation (`src/signing-keys/models/signing-key.ts`, `src/management/models/tenant-meta.ts`).

### 5. Business-logic tests (apps)
- **auth-saas** (only `app/lib/crypto-utils.test.ts`): add tenant role authz (`app/http/middleware/require-tenant-role.ts`), hostname KV lifecycle (`app/models/hostname.ts`), Polar `validateEvent` handling (`app/http/controllers/api/webhooks/polar.ts`), issuer-on-activation (`app/http/controllers/dashboard/tenants/hostname.ts`).
- **blog-saas** (**no tests yet**): add Polar webhook verification/status/product (`app/services/polar.ts`, `app/http/controllers/api/webhooks/polar.ts`), billing entitlement (`app/services/blog-provisioner.ts`), region validation + OIDC id-token claim validation (`app/lib/oidc.ts`).

### 6. JSDoc pass (all four + new packages)
- **Module header on every file** (match `apps/pkmn/src/game/data/nature.ts`): 2–3 line what/why, then `@author [Sergio Xalambrí](https://sergiodxa.com)` and `@copyright Sergio Xalambrí 2026`.
- **Every function/class/method/constant**: ~3-line what/does/why, `@param`/`@returns` always, `@throws` for thrown errors, `@example` for exported (public) API.

## Loose ends / polish
- **Params typing**: DI controllers use `ctx.params.x!` and `getContext() as RequestContext<{…}>` casts because `getContext()` gives `Record<string,string>` params under `noUncheckedIndexedAccess`. Optional cleanup: augment each app's `RouterTypes.context` so params are typed without casts/`!`.
- **Minor**: some blog-engine controllers import `Database` twice (`import type { Database }` + `import { Database as DatabaseKey }`); collapse to a single `import { Database }` (usable as both type and value).
- **Full-repo `bun lint`** has pre-existing `jsx-key` warnings in `apps/r3-uptime` and `templates/app` (out of this scope; untouched).

## Process note (important)
Do **not** run parallel subagents on the shared git working tree — one agent's `git stash`/sub-agent nearly wiped a session's uncommitted work. Use `isolation: "worktree"` agents (they branch from committed `HEAD`) or strictly sequential agents with git forbidden. Commit green checkpoints early.
