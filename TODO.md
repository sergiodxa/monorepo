# SaaS platform — follow-ups

All actionable follow-ups are done (analytics-query SQL guard, duplicate `Database`
import cleanup — see git history). Two remaining items were assessed and
**intentionally left unchanged**:

- **Route-param typing** — the codebase has 32 `ctx.params.x!` + 32
  `as RequestContext<{…}>` casts. These are inherent to the global `getContext()`
  pattern (the context is type-erased per route), so there is no clean *automatic*
  fix; the `!` / cast is the idiomatic, safe workaround. Rewriting 64 sites to an
  equivalent form isn't worth it.
- **`jsx-key` warnings** in `apps/r3-uptime` + `templates/app` — adding a `key`
  prop **breaks typecheck** (remix/ui components type their props as
  `Record<string, never>`, so `key` is rejected — TS2322). The warning is an
  oxlint React-rule vs remix/ui-runtime mismatch, not a real defect, and both
  files are in out-of-scope apps (r3-uptime is already independently
  typecheck-broken). Resolving it is an oxlint rule-config decision, not a code
  change.
