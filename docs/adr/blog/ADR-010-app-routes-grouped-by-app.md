# ADR-010: App Page Routes Grouped by App

## Status

**Accepted** - 2026-11-24

## Background

Each iOS app the blog hosts has a landing, a support page and a privacy policy with its
Markdown twin. The route contract declared them as flat keys that repeated the app's name in
every entry: `wakaba`, `wakabaSupport`, `wakabaPrivacy`, `wakabaPrivacyMarkdown`, and the same
four for Encore. A third app would have added four more prefixed keys.

## Decision

An app's routes are one group in `routes/web.ts`, keyed by the app, with the page as the inner
key:

```ts
wakaba: {
	landing: get("/apps/wakaba"),
	support: form("/apps/wakaba/support"),
	privacy: get("/apps/wakaba/privacy"),
	privacyMarkdown: get("/apps/wakaba/privacy.md"),
},
```

Callers read `routes.wakaba.landing.href()`, `routes.wakaba.support.index.href()` and
`routes.wakaba.privacy.href()`. The sitemap lists the group the same way:
`wakaba: { landing: true, support: { index: true }, privacy: true, privacyMarkdown: false }`.

Encore, Wakaba and Malfoid Stickers follow this shape, and a new app's pages are added as a
new group.

## Consequences

- The app's name is written once, and its pages read as a set in the contract, the router
  and the sitemap.
- A new app adds one group rather than four prefixed keys.
- The landing needs a name of its own inside the group; it is `landing`.
