# SaaS platform — follow-up status

**The broader program is COMPLETE** and landed on `main` (unpushed by design).
Full verification green: typecheck ×8, **644 tests**, lint clean, both apps build.

## Done
1. **remix/ui JSX** — auth-saas dashboard + landing + onboarding fully on remix/ui (no HTML-string rendering remains); oidc-provider already JSX. (`f28195f`, `9dda6ba`)
2. **Vite client-JS** — client build + hydration for both apps, mirroring `apps/r3-blog`. (`1c3fe95`, `380fe00`)
3. **Shared packages** — `@pkg/hostname`, `@pkg/polar`, `@pkg/oidc-client` extracted, documented, tested; old per-app service files deleted. (`e87797d`)
4. **Engine tests** — blog-engine 57, oidc-provider 273, incl. real `router.fetch()` DI integration tests. (`7156303`, `cc4b090`)
5. **App tests** — auth-saas 154, blog-saas 79 (established from zero). (`656407b`, `5eccf1e`)
6. **JSDoc** — module headers (`@author`/`@copyright`) + per-symbol JSDoc across all four codebases + packages. (`8e52e8d`, `13ab5e5`, `808ecc9`, `a6b5bce`, `4b92017`)

### Bonus bugs found via the new tests/docs and fixed
- **service-container**: a parent `instance()` was invisible inside a child `scope()`, so every oidc-provider/blog-engine request threw `ServiceNotFoundError` — uncaught because no test drove `router.fetch()`. Fixed + regression + integration tests. (`8f8cb73`, `cc4b090`)
- **auth-saas Polar webhook**: `subscription.updated` dropped `unpaid`/`incomplete`/`trialing` transitions; now routes through the canonical `mapPolarStatus`. (`8f05af6`)

## Remaining follow-ups (optional / minor)
- **Analytics SQL hardening** (spawned task): `app/services/analytics.ts` in both apps interpolates a date into the Analytics Engine SQL string. Internal-input-only (`yesterday()`), not exploitable today, but validate (`/^\d{4}-\d{2}-\d{2}$/`) or parameterize it.
- Optional polish: augment each app's `RouterTypes.context` so route params drop the `ctx.params.x!` / cast; collapse the double `Database` import in a few blog-engine controllers.
- Pre-existing `jsx-key` lint warnings in `apps/r3-uptime` + `templates/app` (untouched — out of scope).

## Process note
Parallel sub-agents ran on the SHARED tree (git forbidden, disjoint directories, committed green checkpoints between waves) — NOT `isolation: "worktree"`, which branches from the unpushed `origin/main` and is therefore stale here. See memory `worktree-isolation-stale-base-when-unpushed`.
