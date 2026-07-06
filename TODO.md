# SaaS platform — remaining follow-ups

The main refactor / test / docs program is complete (see git history). What's left:

- **Collapse the double `Database` import** in blog-engine controllers (`import type { Database }` + `import { Database as DatabaseKey }` → a single `import { Database }`).
- **Route-param typing** (optional): augment each app's `RouterTypes.context` so `ctx.params.x` is typed without the `!` / cast.
- **Pre-existing `jsx-key` lint warnings** in `apps/r3-uptime` + `templates/app` (unrelated to this program).
