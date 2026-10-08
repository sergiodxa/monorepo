# demo Agents Guidelines

A public job board built for a conference talk. Every file is read off a projector, so the
shortest correct version of a thing wins over the clever one.

## Rules

- MUST keep a module short enough to project: a file that no longer fits on a slide is a
  file to split, not to shrink by removing its comments
- MUST prefer the obvious implementation, so a reader following along in a room has the
  whole mechanism in front of them
- MUST reach for an in-memory adapter wherever a contract has one — mail, cache, and the
  job queue — because the app runs from a laptop with no network behind it
- MUST keep every interaction on HTML the browser already implements: `<dialog>` with
  `commandfor` and `command`, plain forms, and links that go somewhere on their own
- MUST keep the client bundle to the one island that defers a position's detail. An island
  imports `remix/component` and its own types and nothing else, since whatever it imports ships;
  `@sdxc/ui`, `@sdxc/markdown` and `@sdxc/i18n` stay on the server, and a page carrying no
  island links no script
- MUST build every view out of `@sdxc/ui` components, styling through their own
  `variant`/`color`/`size` props and reaching for `@sdxc/u` mixins only for layout no
  component owns
- MUST put every user-facing string in `app/locales/`, both languages, and read it through
  `ctx.intl.t`
- MUST keep the D1 binding and `database/migrations/` real, so `bun run db:local:migrate`
  is what creates the board's table

## Reference Files

| Concern                      | File                       |
| ---------------------------- | -------------------------- |
| Router assembly              | `bootstrap/app.tsx`        |
| MCP server                   | `bootstrap/mcp.ts`         |
| Job dispatcher and its queue | `app/jobs/dispatcher.ts`   |
| Data access                  | `app/data/posting.ts`      |
| In-memory adapters           | `app/lib/`                 |
| Palette the theme derives    | `resources/css/colors.css` |
| Built asset URLs (manifest)  | `app/lib/assets.ts`        |
| Router-level tests           | `app/lib/test/router.ts`   |
