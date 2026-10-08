# AGENTS.md — r3-books

Instructions for working in this app. The root `AGENTS.md` still applies; this file
covers what is specific to a four-page sales funnel that takes money.

## What this app is

A landing page, a sales page, a gated sample chapter, an upgrade form, a checkout
redirect, and a Polar webhook. Its job is to capture emails and take money. A broken
checkout link or a dropped webhook is lost revenue, not a cosmetic bug.

## Things that cannot change

These are referenced from outside this codebase. Renaming or reshaping any of them
breaks something you cannot see from here:

- **`POST /webhooks/polar`** is registered as the webhook endpoint in Polar's dashboard.
  A 404 or a failed signature check silently stops tagging paying customers.
- **`GET /api/checkout/:type`** for `essentials` and `complete` is linked from the
  pricing page and from the upgrade flow, and is shareable. It stays a GET that
  redirects to Polar. Those two names are the whole accepted set: anything else 404s
  before any billing call, so a crawler or a `HEAD` probe cannot leave a real checkout
  object behind at the provider.
- **The Polar product ids** in `app/lib/billing.ts` and **the discount ids** in
  `app/data/product.ts` identify live products and campaigns. Everything else names a
  package by its own slug — `essentials` and `complete` — which is what the webhook
  branches on and what a catalog read is addressed by.
- **`/`, `/release`, `/sample`, `/upgrade`, and `/og.jpg`** are published in newsletters
  and social posts already in the wild.
- **Buttondown subscriber metadata** — `purchase: "complete"` and
  `purchase: "individual"` — drives segmentation inside Buttondown. Keep the exact keys
  and values.

## Behavior that looks like a bug and is not

- **An address already on the list is a success**, both when subscribing and when
  unlocking the sample chapter. The newsletter answers it as `created: false`, in any
  status, so a reader who unsubscribed still unlocks the chapter and is not resubscribed.
- **A "did you mean" prompt is shown once per address.** The homepage and sample-chapter
  forms hold back a likely-mistyped provider and render the form with the address prefilled
  and echoed in a hidden `confirmed` field; resubmitting it unchanged subscribes it as typed.
  The prompt runs before the disposable check, since the blocklist carries typo domains such
  as `gmial.com`, and a kept address on a listed domain is still refused.
- **The sample chapter is not persisted.** Reloading `/sample` shows the form again, by
  design. Do not "fix" this with a session or a cookie — the app has no session
  middleware, and that is deliberate.
- **The webhook only tags customers who are already subscribers.** A purchase from a
  non-subscriber is logged and otherwise ignored.
- **`order.paid` is the only event handled.** Every other delivery is acknowledged with
  a 200, which is what keeps Polar delivering. An unproven signature answers 401, and a
  handler failure the platform can usefully retry answers 503; a paid order for a package
  this funnel does not sell is logged and acknowledged.
- **Prices arrive in cents.** They are divided by 100 and formatted with
  `Intl.NumberFormat`; drop either and prices render as `$4900`. A price the platform
  cannot answer for makes `/release` answer 503, since a page quoting `$0` sells the
  book for nothing.

## Conventions

- **Routing** is `remix/router`: `routes/web.ts` declares the route table, and one
  controller per endpoint lives in `app/http/controllers/`. Link and redirect through
  the typed `routes.x.href()` — never a hand-written path string.
- **Views** are `remix/component` components under `resources/`. Every component takes a
  `Handle` and returns a render function, and is used as JSX — never called as a plain
  function. No `key=` on `remix/component` or `@sdxc/ui` components.
- **Styling** is `@sdxc/u` mixins in a `mix` array, with anything bespoke written as an
  inline `css({...})` or `u.raw({...})` at the use site rather than as a module-level
  constant. Wrapper utilities (`u.dark()`, `u.focusVisible()`, `u.when()`) only accept
  `@sdxc/u` mixins, so reach for `u.raw()` inside them, not `css()`.
- **Validation** is `remix/data-schema` through `@sdxc/validate`. Never Zod.
- **Errors** are `@sdxc/result`: services return a `Result`, and controllers decide what a
  visitor sees. Never surface an upstream provider's error text to a visitor.
- **Billing** is `@sdxc/billing`: the Polar connection is built once in `app/lib/billing.ts`
  and published as `ctx.billing` by the middleware, and every call answers a `Result`
  rather than throwing. Address a package by its slug, never by a product id.
- **The newsletter** is `@sdxc/newsletter`: the Buttondown list is built once in
  `app/lib/newsletter.ts` and published as `ctx.newsletter` by the middleware. Controllers
  branch on `NewsletterError.code` (`suppressed`, `invalid_address`), never on a vendor's
  own error codes, and the Buttondown API version is pinned by the package.
- **Attribution** is `@sdxc/attribution`: its middleware keeps the visitor's first and last
  touch in the cookie `app/lib/cookies.ts` builds, signed with `COOKIE_SECRET`, and publishes
  them as `ctx.attribution`. Forms render no hidden campaign fields; the subscribe service
  receives the touch through `toCampaign`, and checkouts pass `toMetadata`.
- **Logging** is `@sdxc/logger`, one wide event per request: controllers write through
  `ctx.log`, services through `currentLog()?.`. Keep the existing field and note names
  (`subscribe.result`, `checkout.id`, `discount.id`, `order.tagged`, `checkout.started`,
  `order.paid`, …): dashboards read them. Never log the Buttondown API key or the webhook
  secret.

## No client JavaScript

The app loads no first-party JavaScript. Forms are plain `<form method="post">` with
native `required` / `type="email"` validation and `:user-invalid` styling; errors are
server-rendered next to the field. There are no submit spinners or disabled-while-
submitting states, on purpose — the browser's own progress indication covers a document
navigation, and reintroducing them would mean shipping this site's only client bundle.

`bootstrap/browser.ts` stays wired into the Vite build so an island can be added later,
but nothing links it: the document layout writes the import map, the module preloads and
the entry script only for a page that passes `hydrates`, and no page does. An island goes
in `resources/components/`, the only directory the entry's `import.meta.glob` reads; a
layout or view in the client bundle compiles its stylesheets a second time, and every page
would link both copies.

## Assets

The document links its stylesheets and the client entry through `documentAssets()` in
`app/lib/assets.ts`, which reads the manifest `@pitlane/vite-plugin-remix` writes. A build
hashes every file, so a hand-written `/assets/...` URL or a `?url` stylesheet import names a
file the next build renames. A stylesheet joins by a side-effect `import "….css"` in
`resources/layouts/document.tsx`, in cascade order. The renderer looks the assets up per
render, since a Worker may not await at module scope; tests read the fixed manifest in
`app/lib/test/assets-manifest.ts`, aliased in the root Vitest config.

## Cross-origin protection

`cop()` runs globally with `/webhooks/polar` bypassed: that request is a cross-origin
POST authenticated by its Standard-Webhooks signature, not by an origin header. A `cop()`
rejection there reads as an ordinary 403 in the logs while silently dropping paid-order
events, which is why the bypass has its own regression test.

## Testing

Run tests from the repo root with `bun run test`, which runs them under Vitest. `vp test run
--project books` scopes a run to this app.

- **Router-level tests** go through `fetchApp()` in `app/lib/test/router.ts`, which
  builds the real router. Pass `billing` to bill the request against the in-memory
  platform from `app/lib/test/billing.ts`, and `newsletter` to subscribe it to a
  `MemoryNewsletter` (an empty one is the default), then assert on that list's state.
  Never mock outbound HTTP for the newsletter: with MSW's interceptors installed, the
  form-data middleware sees an empty body and every POST fails validation before
  reaching the code under test. The Buttondown wire format is tested in the package
  that owns the provider.
- Cloudflare `env` in tests comes from the repo-wide preload; a test needing specific
  values mocks `cloudflare:workers` itself.

## Gotchas

- **`bun cf:deploy` uploads the existing build.** It runs `cf deploy --prebuilt`, so run
  `bun run build` first or it ships whatever `.cloudflare/output` last held.
- **Bindings and secrets live in `cloudflare.config.ts`.** A secret declared there with
  `bindings.secret()` is what gives it a type on `env`; `.dev.vars` only supplies values.
- **`redirect()` defaults to 307**, which preserves the method. Every
  POST-redirect-GET here must pass `{ status: redirect.Status.SeeOther }`, or the browser
  re-POSTs to the destination.
- **oxlint's `jsx-key` warning on `remix/component` component arrays is a false positive.** Do
  not "fix" it by adding `key`.
- **`hello@sergiodxa.com` is the designated test address** for walking the funnel.
