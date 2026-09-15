---
name: sdxc-i18n
description: "@sdxc/i18n is server-side language detection, a Remix middleware publishing a per-request i18next instance as `context.i18next`/`context.locale`, and `remix/ui` components for translations containing markup. Use when detecting a language from search params, a cookie, the session or `Accept-Language`, wiring `i18next()` into a `remix/router`, translating outside a request with `createTranslator`, or rendering markup in a translation via `Trans`/`IntlProvider`/`intl`."
---

# @sdxc/i18n

Three pieces over [i18next](https://www.i18next.com): a `LanguageDetector` that resolves a request to a supported language, a router middleware that initializes a dedicated i18next instance per request and publishes it as `context.i18next` alongside `context.locale`, and `remix/ui` bindings — `IntlProvider`, `intl`, `setIntl`, `Trans` — for rendering translations, including ones containing markup. `createTranslator` and `getClientLocales` cover the cases with no request context behind them. It assumes `i18next` and Remix v3; the root entry has no router dependency.

Full API, options and examples: [packages/i18n/README.md](packages/i18n/README.md)

## When to reach for it

- Deciding which language a request should be served in, honoring a `?lng=` link, a stored cookie, the session, and then `Accept-Language`.
- Getting a `t` into handlers without threading it: the middleware sets it on the request context.
- Translating from a job, a queue consumer, or anywhere `context.i18next` does not exist — and recording the language the copy was *actually* produced in.
- Rendering a sentence with a link or emphasis inside it, without splitting the translation into fragments.
- Formatting a date or number with `Intl` at the client's exact regional preference, even in an app that ships one translation language.
- Getting translations into an independently hydrated island, which sees no context published outside it.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/i18n": "workspace:*" } }
```

```ts
import i18next from "@sdxc/i18n/middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		i18next({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			i18next: {
				resources: {
					en: { translation: { greeting: "Hello" } },
					es: { translation: { greeting: "Hola" } },
				},
			},
		}),
	],
});

router.get("/", (context) => {
	return new Response(context.i18next.t("greeting"));
});
```

### Entry points

- `@sdxc/i18n` — `LanguageDetector`, `getClientLocales`, `createTranslator`, and i18next's `i18n`/`TFunction` types. No router dependency.
- `@sdxc/i18n/middleware` — the default-exported `i18next` middleware for `remix/router`. Importing it augments `RequestContext` with `locale: string` and `i18next: i18n`.
- `@sdxc/i18n/ui` — `IntlProvider`, `intl`, `setIntl` and `Trans` for `remix/ui`.

## Suggestions

- Order the i18next middleware after `remix/middleware/session` so the detector reads the language off the live request session: no `sessionCookie`/`sessionStorage` configuration and no second storage read. Ordered before it, the `session` method is skipped instead.
- Only the detected language's bundle and the fallback's are attached to the per-request instance, so `context.i18next.t(key, { lng })` for a third language finds no bundle. Build an instance of your own when a request genuinely needs one.
- Record `translation.locale` from `createTranslator`, not the language you asked for: they differ exactly when the app does not ship the requested one, which is the thing worth knowing.
- `getClientLocales` is the input for `Intl` formatters, not for choosing a translation bundle — it honors the client's exact regional preference (`en-GB` dates) independently of which languages you translate into.
- In `Trans`, pick a `components` key that is not a real HTML void element: `link`, `br`, `img` and `hr` parse as self-closing whatever the translation wrote, so a tag meant to wrap children needs a different name (`articleLink`, not `link`). The prop is `i18nKey` because `key` is `remix/ui`'s own reconciliation prop and never reaches the component.
- Call `setIntl` once from the client bootstrap so every island's `intl(handle)`/`Trans` finds an instance; an ancestor `IntlProvider` still wins for its subtree. It throws when called from server code, where a module-scoped instance would be shared across concurrent requests.
- A detection method missing its required option is skipped rather than treated as an error, so `detect` always resolves to a supported language. Set `findLocale` for a path-based locale like `/es/dashboard` — it prepends the `custom` method to the default order.
- Keep `supportedLanguages`/`fallbackLanguage` in sync with i18next's `supportedLngs`/`fallbackLng`; the middleware defaults the latter pair from the former.
