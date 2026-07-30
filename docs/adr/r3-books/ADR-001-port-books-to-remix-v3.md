# ADR-001: Port apps/books to Remix v3 (apps/r3-books)

## Status

**Proposed** - 2026-07-30

## How To Use This Document

This ADR is the implementation spec for porting the books app to Remix v3. It was written after a full read of the app so an implementation session can start coding without re-deriving anything.

Instructions for the implementer:

1. Read this whole document once before writing any code.
2. Work phase by phase, in order, following the Implementation Plan. Tick the Current Progress checkboxes as you go, and commit the updated ADR with the code.
3. Terminology:
   - **OLD APP** = `apps/books` (React Router v8, deployed as the Cloudflare Worker named `books` serving `books.sergiodxa.com`). It keeps serving production until Phase 4.
   - **NEW APP** = `apps/r3-books` (Remix v3, Cloudflare Worker named `r3-books`). All new code goes here.
4. **Never import from the OLD APP.** Copy files over and adapt them (Decision §0.1).
5. This app is a sales funnel: its job is to capture emails and take money. The Frozen Contracts section lists what cannot change — a broken checkout link or webhook is lost revenue, not a cosmetic bug.
6. This is the smallest of the three ports (29 source files, no database, no queue, no cron, no auth). It is a good first port to run end to end if `apps/r3-auth` ([r3-auth ADR-001](../r3-auth/ADR-001-port-auth-to-remix-v3.md)) has not started yet.

## Background

`apps/books` is the landing page and sales funnel for the _React Router OAuth2 Handbook_: a homepage with email capture, a release/pricing page driven by live Polar prices, a gated Markdoc sample chapter, an upgrade path for existing readers, and a Polar webhook that tags paying customers in Buttondown.

It and `apps/auth` are the only React (React Router v8) apps left in the monorepo after `apps/blog` and `apps/uptime` were replaced by their Remix v3 ports in commit `38d79a03`. Every convention the rest of the monorepo now follows — `remix/fetch-router` controllers, `remix/ui` views with `css()` mixins, `remix/data-schema` validation, `@pkg/service-container` services — is skipped here, and this one worker is why React, React DOM, Tailwind, Zod, `remix-utils`, Markdoc, and Prism stay installed.

Unlike the auth port, there is almost no risk surface: no database, no sessions, no tokens, no schema to freeze. The whole app is four pages, three JSON/redirect endpoints, and two HTTP integrations. The work is mostly translating Tailwind markup into `remix/ui` and swapping four libraries for packages the monorepo already owns.

## Context

### Current State: the OLD APP (apps/books)

| Aspect       | Current implementation                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | React Router v8 (`flatRoutes()` over `app/routes/`), React 19                                                                                                             |
| Worker entry | `app/entry.worker.ts` — `fetch` only; builds the React Router handler lazily, seeds a `Logger` into router context, logs and flushes per request                          |
| Storage      | **None.** No D1, KV, R2, queue, cron, or Durable Object bindings                                                                                                          |
| Styling      | Tailwind CSS v4 + `@tailwindcss/typography`, dark mode via `dark:` variants, `data-status` attribute selectors for form states, two `@custom-variant` rules for `:user-*` |
| Content      | Markdoc (`@markdoc/markdoc`) transforming `app/data/sample.md` at request time, rendered through `Markdoc.renderers.react` with a Prism-highlighting `Fence` component    |
| Validation   | Zod v4 through `@pkg/validate` (two near-identical schemas: `app/schemas/subscribe.ts`, `app/routes/upgrade/schemas.server.ts`)                                           |
| Email list   | Buttondown, via a `@edgefirst-dev/api-client` subclass (`app/services/buttondown.ts`) constructed with `globalThis.fetch.bind(globalThis)`                                |
| Payments     | Polar, via `@polar-sh/sdk` directly (`app/services/polar.ts`) — products, checkouts, discounts, customers, orders, and webhook validation                                 |
| Third-party  | ParityDeals PPP banner script (release page, conditional), Cloudflare Insights beacon (every page)                                                                        |
| Logging      | `@pkg/logger`'s request logger, reached through `remix-utils`' context-storage middleware                                                                                 |
| Tests        | **None**                                                                                                                                                                  |

### Cloudflare Resources and Bindings

Source of truth: `apps/books/wrangler.jsonc`. There is nothing to share or migrate:

| Setting       | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| name          | `books`                                                                                 |
| routes        | `books.sergiodxa.com` (custom domain — stays on the OLD APP until Phase 4)              |
| assets        | `./build/client`                                                                        |
| placement     | `{ mode: "smart" }`                                                                     |
| observability | enabled, with traces at a 10% head sampling rate                                        |
| vars          | `BUTTONDOWN_API_VERSION: "2024-07-01"` (declared and typed, **never read** — defect #1) |
| bindings      | none                                                                                    |
| dev port      | 3000                                                                                    |

Secrets (`.dev.vars` locally, `wrangler secret put` in production):

| Name                   | Used for                                     |
| ---------------------- | -------------------------------------------- |
| `BUTTONDOWN_API_KEY`   | Buttondown subscriber API                    |
| `POLAR_ACCESS_TOKEN`   | Polar products, checkouts, discounts, orders |
| `POLAR_WEBHOOK_SECRET` | Verifying Polar webhook signatures           |

### Frozen Contracts

Small app, but four of its URLs and identifiers are referenced from outside the codebase:

| Contract                                                                                           | Why it cannot change                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POST https://books.sergiodxa.com/webhooks/polar`                                                  | Registered as the webhook endpoint in the Polar dashboard; a 404 or signature-verification change silently stops tagging paying customers |
| `GET /api/checkout/:type` for `essentials` and `complete`                                          | Linked from the pricing page and from the upgrade flow's redirects, and shareable/bookmarkable; must stay a GET that 302s to Polar        |
| Polar product ids `ae57a87c-…` (Essentials) and `297b3608-…` (Complete), and the four discount ids | They identify live products and campaigns in Polar; the webhook branches on them                                                          |
| `/`, `/release`, `/sample`, `/upgrade`, `https://books.sergiodxa.com/og.jpg`                       | Published in newsletters, social posts, and OG cards already in the wild                                                                  |

Buttondown subscriber metadata is also a contract of sorts: paying customers are tagged `purchase: "complete"` or `purchase: "individual"`, and those tags drive segmentation in Buttondown. Keep the exact keys and values.

### URL Surface (parity required)

| URL                   | Methods | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | GET     | Homepage: title, pitch, and the early-access subscribe form (posts to `/api/subscribe`, carrying `utm_source`/`utm_campaign`/`utm_medium`/`utm_referral` from the query as hidden fields)                                                                                                                                                                                                                                    |
| `/release`            | GET     | The real sales page. Loader fetches both Polar products and the applicable discount in parallel, derives prices (Polar cents ÷ 100) and the discount amount/end date, and sets `ppp` (true unless the active discount is `EARLY`). Renders hero, description blocks, sample-chapter form, testimonial, pricing (two packages + an upgrade call-out), author bio, FAQ, footer; loads the ParityDeals banner script when `ppp` |
| `/sample`             | GET     | Renders the sample-chapter email form                                                                                                                                                                                                                                                                                                                                                                                        |
| `/sample`             | POST    | Validates the email, subscribes the visitor, then renders the transformed sample chapter. An already-subscribed email still gets the chapter. Content is deliberately not persisted across reloads                                                                                                                                                                                                                           |
| `/upgrade`            | GET     | Renders the upgrade email form                                                                                                                                                                                                                                                                                                                                                                                               |
| `/upgrade`            | POST    | Looks the customer up in Polar; no customer or no Essentials order → redirect to the complete checkout with `?email=`; otherwise create a checkout for Complete with the hardcoded upgrade discount and redirect to it                                                                                                                                                                                                       |
| `/api/subscribe`      | POST    | Validates the form, resolves the client IP, subscribes through Buttondown; maps `subscriber_blocked` / `email_invalid` to specific 400 messages, `email_already_exists` to a redirect to `/release`; success redirects to `/release`                                                                                                                                                                                         |
| `/api/checkout/:type` | GET     | `essentials` → checkout with `allowDiscountCodes: true`; anything else → Complete checkout with the applicable discount applied and discount codes disallowed. Both pass `?email=` through as `customerEmail`. Redirects (document) to the Polar checkout URL                                                                                                                                                                |
| `/webhooks/polar`     | POST    | Verifies the signature with `POLAR_WEBHOOK_SECRET`; on `order.paid`, if the customer is already a Buttondown subscriber, tags them `purchase: complete` or `purchase: individual` by product id; 200 on success, 400 with a message on failure                                                                                                                                                                               |
| `/healthcheck`        | GET     | Plain-text `OK`                                                                                                                                                                                                                                                                                                                                                                                                              |
| unmatched             | GET     | Root `ErrorBoundary` 404 page                                                                                                                                                                                                                                                                                                                                                                                                |

### Verified Defects and Gaps

| #   | Defect                                                                                                                                                                                          | Location                                                           | Severity |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| 1   | `BUTTONDOWN_API_VERSION` is declared in `wrangler.jsonc`, typed in `worker-configuration.d.ts`, and never read — the client hardcodes `/v1/...` paths and sends no version header               | `wrangler.jsonc`, `app/services/buttondown.ts`                     | Low      |
| 2   | Both service singletons `throw` at module load when their env var is missing, so a missing secret fails as an unhandled module-init error on every route that imports them                      | `app/services/{buttondown,polar}.ts`                               | Medium   |
| 3   | The upgrade discount id `e0fa5513-…` is hardcoded inline in the route, while every other Polar id lives in `app/data/product.ts`                                                                | `app/routes/upgrade/route.tsx`                                     | Low      |
| 4   | Two byte-identical Zod schemas (`subscribeSchema`, `upgradeSchema`) differing only in name                                                                                                      | `app/schemas/subscribe.ts`, `app/routes/upgrade/schemas.server.ts` | Low      |
| 5   | `@pkg/cn` and `date-fns` are dependencies but imported nowhere (the only `date-fns` use — a "days left" countdown — is commented out in the pricing section)                                    | `package.json`, `app/routes/release.tsx`                           | Low      |
| 6   | The homepage's success state is unreachable: the `fetcher.data?.ok === true` branch that would set `status === "success"` is commented out, so the green check and success styling never render | `app/routes/_index.tsx`                                            | Low      |
| 7   | `Fence` renders Prism output through `dangerouslySetInnerHTML`; the input is a repo-owned file, so it is safe today, but nothing enforces that                                                  | `app/components/fence.tsx`                                         | Low      |
| 8   | No tests at all, including for the discount-selection rules and the webhook tagging logic — the two pieces of real business logic in the app                                                    | —                                                                  | Medium   |
| 9   | Buttondown errors surface upstream API error text directly to visitors in the generic fallback path (`badRequest({ error: error.message })`)                                                    | `app/routes/api.subscribe.ts`                                      | Low      |

## Decision

Port the OLD APP page-for-page into a new `apps/r3-books` on Remix v3, keeping every URL, the Polar and Buttondown contracts, and the visual design; then move the custom domain and retire the OLD APP. Four libraries are replaced by monorepo packages along the way, and the app ends up shipping **zero first-party JavaScript**.

### 0. Ground Rules

1. **Standard adaptations when porting a file:**
   - Replace Zod schemas with `remix/data-schema` schemas validated through `@pkg/validate`.
   - Replace `react-router` imports (`href`, `redirect`, `redirectDocument`, `Form`, `Link`, `useFetcher`, `useNavigation`, `useSearchParams`) with fetch-router and `remix/ui` equivalents: `routes.<name>.href(...)`, `ctx.redirect(...)`, plain `<form>`/`<a>`, and server-side reads of `ctx.url.searchParams`.
   - Replace React JSX and Tailwind classes with `remix/ui` JSX, `@pkg/r3-ui` components, `@pkg/u` mixins, and inline `css()`.
   - Delete comments naming another app or package as the source of a pattern.
   - Keep the module JSDoc header, rewritten for the new module.
2. **Error handling:** `@pkg/result` — the app already returns `Result` from its use cases; keep that and keep mapping errors to user-facing copy in controllers, not in services.
3. **Logging:** `@pkg/logger`. Keep the existing event names (`user_subscribed`, `order_paid`, `checkout_started`, `discount_applied`, …) so log-based dashboards keep working. Never log the Buttondown API key or the webhook secret.
4. **Every file** starts with the module JSDoc header (what/why in ~3 lines, then `@author`/`@copyright`), and every exported symbol — plus controller callbacks — gets JSDoc.
5. **TypeScript style:** `const` only at module level (`ALL_UPPER_SNAKE_CASE` for constants); `let` inside functions; `interface` over `type`; `namespace` for types only; never `as any`.
6. **Environment:** `import { env } from "cloudflare:workers"`.
7. **Never add an injectable `fetch` parameter.** Call the global `fetch` directly (this is what removes the OLD APP's `globalThis.fetch.bind(globalThis)` workaround — §6).
8. **Commands:** Bun and `bunx` only; tests from the repo root; `bun format:fix` at the root before every commit; Conventional Commits directly on `main`.

### 1. Where Files Go

Scaffold by copying `templates/app` to `apps/r3-books`, then **delete the template's database pieces** — this app has no storage:

| Kind of code          | Location in NEW APP                       | OLD APP source                                                                   |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| Route map             | `routes/web.ts`                           | `app/routes.ts` + the `app/routes/` filenames                                    |
| Composition root      | `bootstrap/app.tsx`                       | `app/root.tsx`'s middleware array                                                |
| Worker entry          | `bootstrap/worker.ts`                     | `app/entry.worker.ts`                                                            |
| Controllers           | `app/http/controllers/*.tsx`              | `app/routes/**` loaders/actions                                                  |
| Middleware            | `app/http/middleware/*.ts`                | `app/middleware/*.ts`                                                            |
| Validators            | `app/http/validators/subscribe.ts`        | `app/schemas/subscribe.ts` + `upgrade/schemas.server.ts` (merged — defect #4)    |
| Use cases             | `app/services/{subscribe,discount}.ts`    | `app/use-case/*.ts`                                                              |
| Buttondown client     | `app/services/buttondown.ts`              | same (rewritten on global `fetch`)                                               |
| Polar access          | `@pkg/polar` + `app/lib/container.ts`     | `app/services/polar.ts`                                                          |
| Product/discount ids  | `app/data/product.ts`                     | same (+ the upgrade discount — defect #3)                                        |
| FAQ + marketing copy  | `resources/content/*.ts`                  | `app/data/frequent-questions.ts`, copy inline in routes                          |
| Sample chapter        | `resources/content/sample.md`             | `app/data/sample.md`                                                             |
| Layouts               | `resources/layouts/document.tsx`          | `app/root.tsx`'s `Layout`                                                        |
| Views (pages)         | `resources/views/*.tsx`                   | OLD APP route components                                                         |
| Shared components     | `resources/components/subscribe-form.tsx` | `app/components/sample-chapter-form.tsx` + the homepage's inline `SubscribeForm` |
| Global stylesheets    | `resources/css/*.css`                     | `app/app.css`                                                                    |
| Images                | `public/`                                 | `app/assets/*.png`, `public/*`                                                   |
| SEO                   | `app/lib/seo.ts` over `@pkg/seo`          | the meta tags inline in `app/root.tsx`                                           |
| Container             | `app/lib/container.ts`                    | n/a (new; §2)                                                                    |
| Context augmentations | `config/router-context.d.ts`              | n/a (new; §2)                                                                    |

### 2. Composition Root and Services

`bootstrap/worker.ts` has a single `fetch` handler: open a `@pkg/service-container` scope, build the router, forward the request. No `scheduled`, no `queue`, no database.

Global middleware in `createRouter({ middleware: [...] })`:

1. `asyncContext()`
2. Request logger (`ctx.logger`), replacing the `remix-utils` context-storage + `logger()` accessor pair
3. `formData()` — every form in this app is a plain POST
4. `cop()` from `remix/cop-middleware`, **bypassing `/webhooks/polar`** (a cross-origin POST from Polar, authenticated by signature, not by origin) — verify this before Phase 4, because a `cop()` rejection here looks exactly like a healthy 403 in logs while silently dropping paid-order events
5. `renderWith(createHtmlRenderer)`

No session middleware: the app has no session, and `/sample`'s deliberate non-persistence depends on that staying true.

**Services in the container** (`app/lib/container.ts`): `Buttondown` and `PolarClient`. Registering them there fixes defect #2 — they are constructed inside a request scope, so a missing secret becomes a handled failure on the routes that need it instead of a module-load throw, and `/healthcheck` keeps answering regardless. Validate both env vars in the container factory and return a `Result`-shaped failure the controller can map to a 500 with a logged event.

### 3. Routing and Controllers

`routes/web.ts`:

```ts
import { form, get, post, route } from "remix/fetch-router/routes";

export default route({
	home: get("/"),
	release: get("/release"),
	healthcheck: get("/healthcheck"),
	/** GET renders the email form; POST unlocks and renders the sample chapter. */
	sample: form("/sample"),
	/** GET renders the email form; POST resolves the customer and redirects to checkout. */
	upgrade: form("/upgrade"),
	api: {
		subscribe: post("/api/subscribe"),
		/** GET, not POST: this URL is linked from the pricing page and is shareable. */
		checkout: get("/api/checkout/:type"),
	},
	webhooks: {
		polar: post("/webhooks/polar"),
	},
});
```

One controller file per endpoint under `app/http/controllers/`, each `createAction(routes.x, handler)`. The 404 page is the router's `defaultHandler`, not a route.

`:type` is validated against the two known values with `remix/data-schema`; anything else must behave as it does today (fall through to the Complete checkout) or 404 — pick the current behavior, which is "fall through", and say so in a comment.

`/api/subscribe` keeps returning a redirect on success and a 400 with a message on failure. Since the browser now posts the form directly rather than through a fetcher, a failure must **re-render the homepage with the error inline** rather than returning a bare JSON 400 — a real behavior change forced by dropping client JS, and the reason `SubscribeForm` takes an optional `error` prop (§4).

### 4. Views and UI

#### 4.1 Rendering model

Server-rendered `remix/ui` JSX via `ctx.render(...)`. Components take a `Handle` and return a render function; always use the Handle pattern and JSX. No `key=` on `remix/ui` or `@pkg/r3-ui` components (keys on plain HTML elements are fine).

Build with `@pkg/r3-ui` components and `@pkg/u` mixins; write anything bespoke as inline `css({...})` at the use site, not as module-level mixin constants.

#### 4.2 Design to preserve

The OLD APP's look is deliberately plain and typographic: serif display headings (`font-serif`, light weight, `text-balance`), `max-w-5xl` sections separated by `<hr>`, `stone`-scale neutrals, square-ish inputs with a 2px border, and a black-on-white / white-on-black dark mode driven purely by `prefers-color-scheme`. Translate class-by-class with the OLD APP open side by side, and keep the section ids (`#hero`, `#description`, `#sample`, `#pricing`, `#author`, `#faq`) — the hero's "⬇️ View the packages" link and external links point at them.

`prose` / `prose-stone` / `lg:prose-xl` / `dark:prose-invert` (from `@tailwindcss/typography`) style the rendered sample chapter. There is no Tailwind in the NEW APP, so the chapter's typography comes from `@pkg/markdown-remix`'s own renderer plus a stylesheet in `resources/css/` for the prose rhythm.

#### 4.3 Global stylesheets (the one place CSS is not a mixin)

Two rule sets cannot be expressed as `css()` mixins because they target elements this app does not render:

- `.parity-banner*` overrides, which style DOM injected by the ParityDeals script.
- `input:-webkit-autofill` overrides and `html { scroll-behavior: smooth }`.

Put them in `resources/css/` files imported with `?url` and linked from the document layout, alongside `@pkg/r3-ui`'s reset and theme stylesheets. The two `@custom-variant` declarations for `:user-invalid` / `:user-valid` become plain CSS pseudo-class selectors — and they are worth keeping and actually using, since native constraint validation is exactly the platform feature that replaces the JS validation states.

#### 4.4 Dropping the client JavaScript

The OLD APP's only interactivity is form-submission feedback: a spinner, a disabled/readonly state, and an inline error, driven by `useFetcher`/`useNavigation` writing a `data-status` attribute that Tailwind's `group-data-[status=…]` selectors style. Two of the three forms already set `reloadDocument`, so they are full-document POSTs today.

In the NEW APP all three forms are plain `<form method="post">`:

- **Errors** are server-rendered next to the field (the same copy, same styling).
- **Validation** uses native `required` + `type="email"` plus the `:user-invalid` styling from §4.3, which is strictly better than the current setup: it gives feedback before submitting.
- **Submit spinners and disabled-while-submitting states are dropped**, matching how the previous two ports handled loading UI (browsers show their own progress indication for a document navigation). This is a small, deliberate fidelity loss; do not reintroduce it with an island.
- Defect #6's dead success state disappears with the mechanism that never reached it: `/api/subscribe` redirects to `/release` on success, which is the real success signal.

The result: **no client entry is loaded**. Keep the template's `bootstrap/browser.ts` so an island can be added later, but do not reference it from the document layout. The only scripts on the page stay the two third-party ones — the Cloudflare Insights beacon (keep the token verbatim) and the conditional ParityDeals banner.

### 5. The Sample Chapter

`resources/content/sample.md` is plain Markdown: six fenced code blocks (three `txt`, two `ts`, one `js`), all language-tagged, and no Markdoc tags anywhere. So drop `@markdoc/markdoc`, `prismjs`, `@types/prismjs`, `prism-theme-github`, and `app/components/fence.tsx`, and parse/render with the monorepo's own pair:

- `@pkg/markdown-server`'s `Markdown` class parses the file (loaded through `import.meta.glob(..., { query: "?raw" })` or a direct `?raw` import).
- `@pkg/markdown-remix`'s `renderToRemix` renders the tree with the `remix/ui` runtime and owns the code-fence UI.
- A syntax-highlighting stylesheet lives in `resources/css/prism.css`, linked from the document layout.

This also retires defect #7's `dangerouslySetInnerHTML`, since the fence UI is the package's problem now.

Parse the chapter once at module scope if the package allows it — the file never changes at runtime, and the OLD APP re-transforms it on every submission.

### 6. External Service Clients

**Buttondown** — rewrite `app/services/buttondown.ts` as a small class calling the global `fetch` directly, dropping `@edgefirst-dev/api-client` and with it the `globalThis.fetch.bind(globalThis)` workaround (the "Illegal invocation" error the OLD APP's `AGENTS.md` documents is a symptom of passing an unbound `fetch` as an option, which rule §0.7 forbids anyway). Keep the three methods (`isSubscribed`, `subscribe`, `addMetadata`), the `Token <key>` auth header, the `ButtondownError` class with its `code`, and the 403 → throw behavior. Validate error bodies with `remix/data-schema` instead of Zod. Either send `BUTTONDOWN_API_VERSION` as the version header the API expects or delete the var (defect #1) — decide by checking Buttondown's current API docs, and record the choice here.

**Polar** — go through `@pkg/polar`'s `PolarClient` instead of `@polar-sh/sdk`. The client already covers `findCustomerByEmail` and `verifyWebhook`, but this app needs four things it does not have yet:

| Need                                                                       | Status in `@pkg/polar`                                                                                                           |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Read a product's price (`products.get`)                                    | Missing — add `getProduct(productId)`                                                                                            |
| List discounts to pick the applicable one (`discounts.list`)               | Missing — add `listDiscounts(limit)`                                                                                             |
| Find a customer's orders for a product (`orders.list`)                     | Missing — add `listOrders({ customerId, productId })`                                                                            |
| Create a checkout with `customerEmail`, `discountId`, `allowDiscountCodes` | `createCheckoutSession(productId, customerId, successUrl, metadata)` does not accept these — add an options-object overload      |
| The parsed `order.paid` event, not just a valid/invalid boolean            | `verifyWebhook` returns `boolean` — add a `parseWebhook(request, rawBody, secret)` returning a `Result` with the validated event |

Extend `@pkg/polar` with those (app-agnostic, documented per `docs/guides/package-documentation.md`, with tests) rather than importing `@polar-sh/sdk` in the app. If any of them turn out to need Polar types that would leak app specifics into the package, keep that one call on the SDK directly inside `app/services/` and note it here — but try the package first, since two other apps already depend on it and will want the same methods.

The discount-selection rules in `find-applicable-discount.ts` (id allow-list, `startsAt`/`endsAt` window, `maxRedemptions` vs `redemptionsCount`, non-empty `products` scoped only to Complete) are real business logic: port them unchanged into `app/services/discount.ts` and **unit-test them** (defect #8).

### 7. Validation

One merged validator (defect #4) in `app/http/validators/subscribe.ts`: `email` (with the message "Invalid email address"), plus optional `source`, `campaign`, `medium`, `referral`, built with `remix/data-schema/form-data`'s `f.object` and parsed from `ctx.formData` through `@pkg/validate`. The upgrade form reuses it — it collects the same fields.

Also validate: the `:type` route param, `?email=` on the checkout endpoint, the Buttondown error body, and the Polar product/price shapes the release loader reads (the OLD APP already validates those with Zod inline — port that intent, since Polar is an external API).

Remove `zod` from the app's dependencies once nothing imports it.

### 8. SEO and Head Metadata

The OLD APP hardcodes title, description, OG tags, Twitter card, theme-color, and favicon in `app/root.tsx`'s `Layout`, identically for every page. In the NEW APP, `resources/layouts/document.tsx` takes per-page `title`/`description`/`meta`, and `app/lib/seo.ts` builds canonical URLs and JSON-LD through **`@pkg/seo`** — this app makes that package its first consumer, and a sales page is exactly where a `Book` / `Product` + `Offer` schema and a correct canonical URL earn their keep.

Keep verbatim: the OG image URL (`https://books.sergiodxa.com/og.jpg`), the light/dark `theme-color` pair, and the favicon path.

### 9. Assets

Move `app/assets/alem.png` and `app/assets/avatar.png` into `public/` and reference them by path instead of importing them through Vite; `public/favicon.ico` and `public/og.jpg` stay as they are.

### 10. Package Reuse

Use: `@pkg/r3-ui`, `@pkg/u`, `@pkg/markdown-server`, `@pkg/markdown-remix`, `@pkg/seo`, `@pkg/polar`, `@pkg/service-container`, `@pkg/validate`, `@pkg/result`, `@pkg/logger`, `@pkg/http`, `@pkg/response`, `@pkg/get-client-ip`, `@pkg/location`.

Drop: `react`, `react-dom`, `react-router`, `@react-router/*`, `@markdoc/markdoc`, `prismjs`, `@types/prismjs`, `prism-theme-github`, `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography`, `@edgefirst-dev/api-client`, `@polar-sh/sdk` (reached through `@pkg/polar`), `remix-utils`, `isbot`, `zod`, `vite-tsconfig-paths`, and the two unused ones (`@pkg/cn`, `date-fns` — defect #5).

`i18n` is out of scope: the app is English-only with no locale files, and adding translations is a product decision, not a port step.

### 11. Wrangler Config

`apps/r3-books/wrangler.jsonc`:

1. `name: "r3-books"`, `main: "./bootstrap/worker.ts"`, current compatibility date, `nodejs_compat`, `workers_dev: true`, `dev: { port: 3003 }` (3000 is the OLD APP and several others, 3001/3002 are the auth pair, 3004/3005 the SaaS apps).
2. `assets.directory` pointing at the Vite client output.
3. Keep `placement: { mode: "smart" }` and the observability block **including `traces.head_sampling_rate: 0.1`**.
4. No bindings at all. Keep or drop the `BUTTONDOWN_API_VERSION` var per defect #1's decision.
5. **No `routes` entry until Phase 4.**
6. Secrets via `.dev.vars` locally and `bunx wrangler secret put` in production.
7. After every change: `bun cf:typegen`, `bun run build`, `bunx wrangler deploy --dry-run`.

Also update `.oxfmtrc.json` (add `apps/r3-books`; it needs no Tailwind override, and the `apps/books` override with its `cn` function list goes away at cutover) and `.claude/launch.json` (add an `r3-books` entry on port 3003).

### 12. Testing

The OLD APP has no tests, so everything here is new coverage (defect #8). Runner is `bun:test`, run from the repo root.

- **Unit:** the discount-selection rules (every rejection branch: not in the allow-list, not started, ended, redemptions exhausted, no products, wrong product), the subscribe use case's short-circuits (missing email, already subscribed), and the Buttondown error mapping.
- **HTTP (MSW):** mock Buttondown and Polar with `setupServer` from `msw/node`. Never stub `globalThis.fetch`.
- **Router-level** via `router.fetch(new Request(...))`: subscribe success → redirect to `/release`; `email_already_exists` → redirect to `/release`; `subscriber_blocked` and `email_invalid` → the homepage re-rendered with the right copy; `/sample` POST renders the chapter (including for an already-subscribed email); `/upgrade` POST for a customer with an Essentials order, for a customer without one, and for an unknown email; `/api/checkout/essentials` and `/api/checkout/complete` redirect to the Polar URL; `/webhooks/polar` accepts a validly signed `order.paid` and tags the right tier, rejects a bad signature, and does not tag a non-subscriber; `/healthcheck` returns `OK`.
- **`cop()` regression test:** a cross-origin POST to `/webhooks/polar` must pass the middleware chain (§2.4).
- Cloudflare `env` in tests: `mock.module("cloudflare:workers", ...)`.

### 13. Documentation

- `apps/r3-books/README.md` per `docs/guides/app-documentation.md`.
- `apps/r3-books/AGENTS.md`: rewrite rather than port. The OLD APP's `AGENTS.md` is a long onboarding document whose troubleshooting sections (the `fetch` binding workaround, Markdoc rendering, React Router route conventions) describe machinery this port deletes. Keep what stays true — the funnel's behavior, the sample-gating intent, webhook signature verification, the testing checklist — and express the rest as the Remix v3 conventions the NEW APP actually follows.

### 14. Defect Decisions

| #   | Decision                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Decide in Phase 2**: send the version header Buttondown documents, or delete the var. Do not carry a declared-but-unread var forward                                     |
| 2   | **Fixed by §2** — both clients move into the container and construct inside a request scope                                                                                |
| 3   | **Fix in Phase 2** — move the upgrade discount id into `app/data/product.ts` as `Discounts.UPGRADE`                                                                        |
| 4   | **Fix in Phase 1** — one shared validator                                                                                                                                  |
| 5   | **Fixed by not carrying them over.** If the "days left" countdown is wanted, rebuild it with `@pkg/dates`; otherwise delete the commented-out block rather than porting it |
| 6   | **Resolved by §4.4** — the success state's mechanism is gone; success is the redirect to `/release`                                                                        |
| 7   | **Fixed by §5** — `@pkg/markdown-remix` owns fence rendering                                                                                                               |
| 8   | **Fixed across all phases** — see §12                                                                                                                                      |
| 9   | **Fix in Phase 2** — log the upstream message and show a generic "something went wrong, please try again" instead of surfacing raw provider text                           |

## Consequences

### Positive

- **The monorepo's React footprint shrinks to one app** (`apps/auth`), and after that port, to zero.
- **Zero first-party JavaScript.** The app becomes pure server-rendered HTML with native form validation — appropriate for a page whose job is to load fast and convert.
- **Eight dependencies removed** (Markdoc, Prism ×3, Tailwind ×3, the API-client wrapper) and two unused ones cleaned up, in exchange for packages the monorepo already maintains.
- **First real tests** for the discount rules and the webhook tagging — the two places where a silent bug costs money.
- **`@pkg/polar` gets the product, discount, order, checkout-options, and parsed-webhook methods** it was always going to need, benefiting the two other apps that use it.
- **`@pkg/seo` gets its first consumer**, on the page where canonical URLs and structured data matter most.
- **Nothing to migrate**: no database, no sessions, no queue. Cutover is a domain move.

### Negative

- **Submit-state feedback is lost** (spinner, disabled button, readonly input). Native validation partly compensates, but a slow Buttondown call now shows only the browser's own progress bar.
- **Manual Tailwind → `css()` translation** across four pages, a form component, and the prose typography; visual regressions are likely without side-by-side comparison.
- **Extending `@pkg/polar` is prerequisite work** inside another workspace, with its own tests and docs — the one part of this port that is not confined to the new app.
- **A `cop()` misconfiguration silently breaks the Polar webhook.** It fails closed and looks like a normal rejection in logs; the §12 regression test exists because of this.
- **The sample chapter's prose styling has no Tailwind Typography equivalent** to copy from, so its rhythm has to be rebuilt by hand.

### Neutral

- The OLD APP keeps serving production until Phase 4. Both workers can run at once — they share no state, only external services, and Polar's webhook keeps pointing at the OLD APP until the domain moves.
- The `/api/checkout/:type` endpoint stays a GET with a side effect. That is the existing, publicly linked contract; this port is not the place to change it.
- The app stays English-only.

## Implementation Plan

Definition of done for **every** phase: `bun typecheck`, `bun lint`, and `bun run test` pass from the repo root; `bun format:fix` has been run; `bun run build` and `bunx wrangler deploy --dry-run` succeed; committed to `main` with Conventional Commits; Current Progress updated with what was and was not verified.

### Phase 0: Scaffold and `@pkg/polar` extension

**Priority:** High. **Effort:** ~half a day.

1. Copy `templates/app` to `apps/r3-books`; set the package name, `tsconfig.json` (paths, `jsxImportSource: "remix/ui"`), and `vite.config.ts` (Cloudflare plugin, port 3003).
2. Delete the template's database adapter, database middleware, and `database/` directory; `bootstrap/worker.ts` builds the router with no storage.
3. Fill `wrangler.jsonc` per §11 (no bindings, no route); `bun cf:typegen`.
4. Extend `@pkg/polar` per §6 (`getProduct`, `listDiscounts`, `listOrders`, checkout options, `parseWebhook`) with tests and README updates.
5. Create `app/lib/container.ts` (Buttondown + PolarClient) and `config/router-context.d.ts`.

### Phase 1: Shell, home, and subscribe

**Priority:** High. **Effort:** 1–2 days.

1. `bootstrap/app.tsx` with the middleware chain (§2), including the `cop()` bypass for `/webhooks/polar`.
2. `resources/layouts/document.tsx` (head tags, stylesheets, third-party beacon) and `app/lib/seo.ts` over `@pkg/seo`.
3. `resources/css/` stylesheets: r3-ui reset/theme links, the autofill and `scroll-behavior` rules, the ParityDeals overrides, the prose rhythm, the code-fence theme.
4. The shared `SubscribeForm` component (used by home, release, and sample) with native validation and a server-rendered error slot.
5. `GET /`, `POST /api/subscribe`, `GET /healthcheck`, the 404 default handler, and the merged validator.
6. Tests: subscribe happy path, each Buttondown error branch, homepage re-render with an error.

### Phase 2: Checkout, upgrade, and the webhook

**Priority:** High. **Effort:** 1–2 days.

1. `app/services/discount.ts` with the ported selection rules, unit-tested.
2. `GET /api/checkout/:type` for both products, `?email=` pass-through, and the discount application.
3. `GET`/`POST /upgrade`, including both fallback redirects and the upgrade discount moved into `app/data/product.ts`.
4. `POST /webhooks/polar` on `@pkg/polar`'s `parseWebhook`, with the Buttondown tagging preserved exactly.
5. Defect fixes #1, #3, #9.
6. Tests per §12, including the `cop()` bypass regression test and a bad-signature rejection.

### Phase 3: Release page and sample chapter

**Priority:** High. **Effort:** 2 days.

1. `GET /release`: the loader's parallel product + discount fetch and price derivation, then every section (hero, description, sample form, testimonial, pricing with both packages and the upgrade call-out, author, FAQ, footer) translated to `remix/ui`, with the section ids preserved and the ParityDeals script rendered when `ppp`.
2. `GET`/`POST /sample`: the form, then the chapter rendered through `@pkg/markdown-server` + `@pkg/markdown-remix`, including the already-subscribed path.
3. Move the images into `public/` and move the FAQ and marketing copy into `resources/content/`.
4. Visual comparison against the live OLD APP at desktop and mobile widths, in both color schemes.

### Phase 4: Verification and cutover

**Priority:** High (gating). **Effort:** half a day + soak.

1. Deploy the NEW APP without the custom domain; walk the whole funnel on its `workers.dev` URL: subscribe with a fresh address and with `hello@sergiodxa.com`, read the sample chapter, open both checkout links (without completing a purchase), and run the upgrade form for a known Essentials customer.
2. Send a signed test `order.paid` event to the NEW APP's `/webhooks/polar` (Polar's dashboard can replay one) and confirm the Buttondown tag lands.
3. Move `books.sergiodxa.com` to the NEW APP; re-verify the funnel on the real domain and confirm the Polar webhook — still registered at that domain — reaches the new worker.
4. Soak for a week (rollback = move the domain back). Then rename `apps/r3-books` → `apps/books`, delete the OLD APP worker, drop the `apps/books` override from `.oxfmtrc.json`, update the root `README.md`, and mark this ADR **Implemented**.

## Alternatives Considered

### 1. Retire the app instead of porting it

The book is shipped; the funnel could become a static page or move to a hosted platform.

**Rejected because**: it is live, taking money, and its Polar/Buttondown wiring (discount windows, upgrade path, purchase tagging) is not something a static page or a generic platform reproduces. Porting is a few days; rebuilding the funnel elsewhere is more.

### 2. Keep Markdoc and Prism

**Rejected because**: the sample chapter uses no Markdoc tags — it is plain Markdown with fences — and the monorepo already owns a Markdown parser plus a `remix/ui` renderer with fence UI. Keeping them would mean maintaining a second Markdown stack for one file.

### 3. Keep an island for the submit spinner

**Rejected because**: it would be the app's only client-side JavaScript, requiring the client entry, its bundle, and its hydration path, for a progress indicator browsers already provide. The previous two ports dropped their loading UI for the same reason.

### 4. Import `@polar-sh/sdk` directly in the NEW APP

**Rejected because**: `@pkg/polar` exists precisely to be the one typed surface over Polar, and the five missing pieces are all generic. Reaching around it would leave three apps calling Polar three ways.

### 5. Incremental migration inside `apps/books`

**Rejected because**: the two stacks share nothing at the view layer and their Vite configurations conflict. Given the app's size, a side-by-side worker is also cheaper to verify and trivially reversible.

### 6. Port `apps/auth` first and books later

**Rejected as an ordering constraint** (though either order works): books is small, has no frozen data contracts, and exercises the same `templates/app` scaffold, `@pkg/r3-ui` translation, and container patterns the auth port needs — at a fraction of the risk. Running it first de-risks the bigger port. The two share no code, so they can also proceed in parallel.

## References

- OLD APP key files: `apps/books/wrangler.jsonc`, `app/entry.worker.ts`, `app/routes.ts`, `app/root.tsx`, `app/routes/`, `app/services/{buttondown,polar}.ts`, `app/use-case/`, `app/data/`, `app/components/`, `app/app.css`, `AGENTS.md`
- Scaffold: `templates/app/`
- Packages this port leans on: `packages/{r3-ui,u,markdown-server,markdown-remix,seo,polar,service-container,validate,logger,http,response,get-client-ip,location}`
- Remix v3 vendor docs: `docs/vendor/@remix-run/{fetch-router,ui,data-schema,form-data-middleware,cop-middleware,render-middleware,response,routes}/`
- Related ADRs: [r3-auth ADR-001](../r3-auth/ADR-001-port-auth-to-remix-v3.md), [r3-uptime ADR-001](../r3-uptime/ADR-001-port-uptime-to-remix-v3.md), [ADR-008 service container](../ADR-008-service-container-for-remix-v3.md), [ADR-013 Remix UI for application interfaces](../ADR-013-remix-ui-for-application-interfaces.md), [ADR-014 r3-ui component library](../ADR-014-r3-ui-component-library-on-remix-ui.md), [ADR-025 SEO metadata and structured data package](../ADR-025-seo-metadata-and-structured-data-package.md), [books ADR-001 package consistency](../books/ADR-001-package-consistency.md)
- Repo rules: root `AGENTS.md`, `docs/guides/{app-documentation,package-documentation,adr-writing}.md`

## Current Progress

- [x] Phase 0: Scaffold and `@pkg/polar` extension
- [x] Phase 1: Shell, home, and subscribe
- [x] Phase 2: Checkout, upgrade, and the webhook
- [ ] Phase 3: Release page and sample chapter
- [ ] Phase 4: Verification and cutover

### Phase 0 — done

Verified: `bun typecheck` (every workspace), `bun lint`, `bun run test`, `bun format:fix`,
`bun run build`, `bunx wrangler deploy --dry-run`. Not verified: nothing deployed, no
browser check (Phase 1 has the first page to look at).

- `apps/r3-books` scaffolded from `templates/app` with the database pieces dropped:
  `package.json`, `tsconfig.json`, `vite.config.ts` (port 3003), `wrangler.jsonc` (no
  bindings, no `routes`, `placement: smart`, traces at 10%), `.env.example`,
  `bootstrap/browser.ts`, `config/router-context.d.ts`.
- `app/lib/container.ts` registers `Buttondown` and `PolarClient` as **`scoped`**, not
  singletons — §2 asked for construction inside a request scope, and `scoped` is what
  actually delivers that. Both factories validate their secret and throw with the
  variable's name, so a missing secret fails inside the request that needed it rather
  than at module load (defect #2), and `/healthcheck` answers regardless. §2's
  "return a `Result`-shaped failure from the container factory" is not expressible
  through `container.get`, so the throw is the mechanism.
- `@pkg/polar` extended with `getProduct`, `listDiscounts`, `listOrders`, `parseWebhook`
  (returning a `Result` with the validated event), and the checkout-options form — with
  tests (50 pass) and README updates.
  - **Deviation from §6**: the options form ships as a sibling method
    `createCheckout(options)` returning `{ url, id }`, not as an overload of
    `createCheckoutSession`. An overload set is an intersection of signatures, so adding
    one breaks `apps/uptime`'s existing test double, which assigns a 3-arg function to
    `createCheckoutSession`. A union-typed first parameter fails the same way. The
    positional signature and every existing caller are untouched.

### Phase 1 — done

Verified: `bun typecheck`, `bun lint`, `bun run test` (21 tests in this app), `bun format:fix`,
`bun run build`, `bunx wrangler deploy --dry-run`. Not verified: nothing deployed, and no
side-by-side visual comparison against the OLD APP yet — the homepage was translated
class-by-class from the source but not yet compared in a browser, which Phase 3 gates on.

- `bootstrap/app.tsx` with the middleware chain of §2 — `asyncContext()`, request logger,
  `formData()`, `cop({ insecureBypassPatterns: ["/webhooks/polar"] })`,
  `renderWith(createHtmlRenderer)` — and no session middleware. `methodOverride()` was
  dropped from the chain: every form here is a plain POST, so it has nothing to do.
  The renderer installs no frame resolver, since the app renders no frames.
- `resources/layouts/document.tsx`, `app/lib/seo.ts` over `@pkg/seo` (its first
  consumer), and `resources/css/colors.css` carrying the site's exact palette scales and
  font stacks across as `--ui-color-*` tokens.
  - **§4.3 revised**: only _one_ global rule set actually needs a stylesheet — the
    ParityDeals banner overrides, which style DOM the app does not render (added in
    Phase 3 with the release page). `@pkg/u` has `autofill()` and `scrollBehavior()`
    mixins, and `:user-invalid`/`:user-valid` are expressible with `u.when()`, so all
    three are inline at their use site instead.
  - `@pkg/seo` has no `book`/`product` schema builder yet, so §8's `Book`/`Product` +
    `Offer` schema is deferred to Phase 3, where the release page needs it. The homepage
    ships `website` + `organization`.
- `resources/components/subscribe-form.tsx`: a plain `<form method="post">` with native
  validation, `:user-invalid`/`:user-valid` borders, a server-rendered error slot, and no
  spinner or disabled state (§4.4).
- `GET /`, `POST /api/subscribe`, `GET /healthcheck`, the 404 default handler, and the
  merged validator (defect #4).
  - **Two corrections to §3/§7 found while implementing.** `remix/data-schema`'s checks
    take no per-check `message` option — messages are customized through an `errorMap` at
    parse time, which `@pkg/validate` does not pass through — so the visitor-facing
    "Invalid email address" copy lives in the validator module as a constant the
    controller shows for any issue. And `@pkg/http`'s `redirect()` defaults to **307**,
    which preserves the method; every POST-redirect-GET here passes
    `{ status: redirect.Status.SeeOther }` (303) or the browser re-POSTs to `/release`.
- Tests: the subscribe happy path, the already-subscribed short-circuit, each Buttondown
  error branch, the homepage re-render with an inline error, the homepage's canonical URL
  and UTM pass-through, "no first-party JavaScript", `/healthcheck`, and the 404.
  - **§12 revised on how the seams are mocked.** MSW cannot be used for router-level
    tests: with its interceptors installed the router's form-data middleware sees an
    empty body, so every POST fails validation before reaching the code under test.
    Router-level tests replace clients through the container (`app/lib/test/router.ts`,
    `app/lib/test/buttondown.ts`); MSW covers the clients themselves
    (`app/services/buttondown.test.ts`), which is where request shape belongs. Neither
    path stubs `globalThis.fetch`.
- `.claude/launch.json` gained an `r3-books` entry on port 3003. `.oxfmtrc.json` needs no
  change: the new app has no Tailwind stylesheet to point an override at.
- Defect #9 fixed early (it belongs to this endpoint): a Buttondown failure with no
  special-cased code now logs the upstream message and shows a generic
  "Something went wrong, please try again."

### Phase 2 — done

Verified: `bun format:fix`, `bun lint`, `bun run typecheck` (every workspace), `bun run test`
(7633 repo-wide; 58 in this app, up from 21), `bun run build`, `bunx wrangler deploy --dry-run`
(which now reports the one `vars` entry). Not verified: nothing is deployed, so no live Polar
or Buttondown call has been made; no browser check of `/upgrade`; and **no real
Standard-Webhooks signature has ever been verified end to end** — see the last bullet.

- `app/data/product.ts` carries the `Product` and `Discounts` ids across verbatim, with the
  upgrade discount moved in as `Discounts.UPGRADE` (defect #3). `Discounts` documents why
  that one id is different in kind: it is handed out, never auto-applied, which is what the
  selection rules encode by excluding it from the allow-list.
- `app/services/discount.ts` ports `findApplicableDiscount` rule-for-rule and takes the
  `PolarClient` as a parameter. The log event names (`discount_list_fetched`,
  `discount_applied`, `discount_not_applicable`, `discount_fetch_error`) are unchanged.
  Thirteen unit tests cover the happy path, an open-ended campaign, and every rejection
  branch — not in the allow-list, the upgrade discount specifically, not started, ended,
  redemptions exhausted, no products, a non-Complete product, a campaign covering Complete
  _and_ Essentials, first-match ordering, an empty list, and a Polar failure (defect #8).
- `GET /api/checkout/:type`, `GET`/`POST /upgrade`, and `POST /webhooks/polar`, all mapped
  in `bootstrap/app.tsx`. `resources/views/upgrade.tsx` reuses `subscribe-form.tsx` and
  keeps the OLD APP's heading, paragraph, and "Get Upgrade Link" label.
- Defect #9's rule holds in the new controllers: no upstream text reaches a visitor. The
  upgrade page's only visitor-facing failure is the validator's own copy; a Polar error
  becomes an unhandled 500 rather than a page quoting Polar. The webhook does return the
  provider-facing reason in its 400 body, which is correct — its caller is Polar, not a
  reader, and Polar needs to know why to retry.

**Defect #1 — decided: send the header, and declare the var.** Buttondown's versioning is
explicit and header-based. Its docs state that "If a request includes a `header` with the key
`X-API-Version`, Buttondown will use that value as the API version"; without one it falls back
to "a _pinned_ version associated with the newsletter", and with no pin at all "Buttondown will
use the latest version of the API" ([Versioning](https://docs.buttondown.com/api-versioning),
[api-changelog](https://docs.buttondown.com/api-changelog), whose entries are flagged as
introducing breaking changes and new API versions). The current version is `2026-04-01`, two
years past the `2024-07-01` this client's request and error shapes were written against. So the
unread var was not merely dead — leaving it unsent means a Buttondown release can change the
response shapes `app/services/buttondown.ts` parses with no change here, and the first symptom
would be subscribe failing. `Buttondown` now takes an optional `apiVersion` and sets
`x-api-version` when given one; `BUTTONDOWN_API_VERSION: "2024-07-01"` is declared in
`wrangler.jsonc` `vars` (a public value, not a secret) and in `.env.example`, and the container
passes it through. Two client tests assert the header is sent when configured and absent when
not.

**Where the spec turned out to be wrong or impossible.**

- **§3's one-controller-per-endpoint shape does not fit `form()`.** `form("/upgrade")` builds a
  _route map_ with `index` (GET) and `action` (POST), not a single route, so
  `routes.upgrade.index.href()` is the page URL and `app/http/controllers/upgrade.tsx` exports
  two named actions instead of a default. `bootstrap/app.tsx` maps each leaf — passing the
  group to `router.map` throws. `/sample` will need the same shape in Phase 3.
- **`@pkg/response`'s `ok`/`badRequest` cannot be returned from a fetch-router action.** They
  return a `DataWithResponseInit`, which is a React Router construct, not a `Response`; the
  OLD APP's webhook could return them and this one cannot. The webhook uses `json()` from
  `@pkg/http/response` with `Ok`/`BadRequest` from `@pkg/http/status-code`. Anything else in
  this app still reaching for `@pkg/response` will hit the same wall.
- **The checkout's external redirect is a 303, not the OLD APP's 302.** `redirect.Status` only
  models 303/307/308, so 302 is not expressible without hand-building a `Response`. For a GET
  redirect to an absolute Polar URL the two are interchangeable — both send the browser on with
  a GET — and 303 was preferred over reconstructing the response by hand.
- **§7's "validate the `:type` param" cannot be enforcing.** An unknown type has to fall
  through to the Complete checkout (a stale or mistyped published link should still sell), so
  the schema is parsed with `s.parseSafe` and only a successful parse of `essentials` takes the
  Essentials branch. A malformed `?email=` is likewise dropped rather than rejected: Polar
  would refuse the checkout outright, and losing a pre-filled field beats losing the sale.
- **§12's Polar seam needed a fake plus fixture builders, and the fixtures cannot be literal.**
  `app/lib/test/polar.ts` holds `FakePolarClient` (modeled on `FakeButtondown`) and
  `makeDiscount` / `makeOrder` / `makeCustomer` / `makeOrderPaidEvent` / `makeEvent`. Polar's
  response models carry dozens of currency, timestamp, and organization fields no branch here
  reads, so each builder declares only the fields under test and widens to the SDK type. This
  is the one deliberate type escape in the phase, and it is confined to test fixtures.
- **Nothing anywhere verifies a real webhook signature.** `FakePolarClient.parseWebhook`
  returns a scripted `Result`, and `packages/polar`'s own tests mock the SDK's `validateEvent`,
  so the "bad signature is rejected" test proves the controller's branch, not the cryptography.
  Building a genuinely signed request would mean constructing a payload that satisfies the
  SDK's full `order.paid` validation. Phase 4's step 2 — replaying a signed event from Polar's
  dashboard — is therefore the _first_ real exercise of this boundary, not a confirmation of
  something already tested. Treat it as gating.
- **The webhook's product → tier branch is now a lookup table** (`TIERS`) rather than the OLD
  APP's `if`/`else if`. Behavior is identical, including the case the OLD APP left implicit: an
  order for an unrecognized product is accepted with a 200 and tags nobody, which has its own
  test so a future third product cannot silently start tagging as one of these two.
- **The `cop()` bypass regression test asserts both directions**, as asked: a cross-origin POST
  to `/webhooks/polar` returns 200 and tags the buyer, while the same cross-origin POST to
  `/api/subscribe` returns 403. The second half is what proves the bypass is narrow rather
  than a disabled protection.

## Notes

- **Polar prices are in cents.** The release loader divides by 100 and formats with `Intl.NumberFormat` (USD, no fraction digits). Keep both, or prices render as `$4900`.
- **`ppp` is true unless the active discount is `EARLY`.** That single boolean decides whether the ParityDeals script loads, so purchasing-power-parity pricing silently disappears if the flag's polarity flips.
- **The sample chapter is intentionally not persisted.** Reloading `/sample` shows the form again, by design. Do not "fix" this with a session or a cookie.
- **An already-subscribed email is a success path, not an error**, in both `/sample` (renders the chapter) and `/api/subscribe` (redirects to `/release`). Buttondown signals it as an `email_already_exists` error code, which is why both handlers special-case it.
- **The webhook only tags customers who are already Buttondown subscribers.** A purchase from a non-subscriber is logged and otherwise ignored. Preserve that.
- **`order.paid` is the only event handled**, and it requires both `product` and `customer.email`; either missing is a 400. Polar retries on non-2xx, so keep failures genuinely retryable and success genuinely 200.
- **oxlint's `jsx-key` warning on `remix/ui` component arrays is a known false positive** — do not "fix" it by adding `key` to components.
- **`wrangler deploy` does not build the Vite app.** Run `bun run build` first; a stale `.wrangler/deploy/config.json` pointing at a deleted output directory also fails.
- **`hello@sergiodxa.com` is the designated test email** for funnel walkthroughs (from the OLD APP's own testing checklist).
