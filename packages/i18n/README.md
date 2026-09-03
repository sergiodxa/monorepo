# @sdxc/i18n

Server-side internationalization for Remix fetch-router apps: language detection plus a middleware that publishes a per-request [i18next](https://www.i18next.com) instance on the request context.

## Overview

Every request needs an answer to "which language does this user want?" before any translated content can render. This package ports the server-side language detector from [remix-i18next](https://github.com/sergiodxa/remix-i18next) to the Remix v3 primitives: it probes search params, a cookie, the session, the `Accept-Language` header, and optional custom logic in a configurable order, validates every candidate against the languages the app actually supports, and always falls back to a guaranteed language.

Translation itself is delegated to i18next. The middleware in `@sdxc/i18n/middleware` creates and initializes a dedicated i18next instance per request — registered plugins (such as a backend that loads translation files) run before handlers do — and exposes it as `context.i18next` alongside `context.locale`. A per-request instance means concurrent requests in different languages never share mutable language state, which matters in a Workers runtime where one isolate serves many requests.

Because the language is resolved before the instance is built, that instance is only ever given the bundles the request can resolve through: the detected language's and the fallback language's. An app that supports six languages therefore attaches two bundles per request instead of six, without giving up the per-request instance that keeps the languages isolated.

The root entry (`@sdxc/i18n`) has no router dependency, so the detector and locale helpers can also be used outside middleware (e.g. in background jobs or non-router handlers). Code that runs with no request at all — a scheduled job, a queue consumer, a test, a client bootstrap — has no `context.i18next` to translate through either, so the root entry also ships `createTranslator`: the same idea as the middleware (resolve a language, then build an instance for it) without a `Request` to resolve it from, and caching one instance per language because the bundles are static.

Rendering translations through `remix/ui` is a separate concern from detecting and loading them, so it lives at its own entry point, `@sdxc/i18n/ui`: an `IntlProvider` that publishes a live i18next instance through context, and a `Trans` component for translations containing markup.

## Usage

### Middleware

```typescript
import i18next from "@sdxc/i18n/middleware";
import { createRouter } from "remix/router";

let router = createRouter({
	middleware: [
		i18next({
			detection: {
				supportedLanguages: ["en", "es"],
				fallbackLanguage: "en",
			},
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
	// context.locale is the detected language, e.g. "es"
	// context.i18next is this request's initialized i18next instance
	return new Response(context.i18next.t("greeting"));
});
```

### Standalone detection

```typescript
import { LanguageDetector } from "@sdxc/i18n";

let detector = new LanguageDetector({
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
});

let locale = await detector.detect(request); // always a supported language
```

### Translating without a request

```typescript
import { createTranslator } from "@sdxc/i18n";

let translate = createTranslator({
	resources: { en: { translation: en }, es: { translation: es } },
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
});

// In a job, a consumer, or anywhere `context.i18next` does not exist:
let { locale, t } = await translate(recipient.language);
// locale is the language the copy was actually produced in — "en" when
// recipient.language is one this app does not ship.
await send({ subject: t("digest.subject"), locale });
```

### `remix/ui`

Wrap a server-rendered page in `IntlProvider` with the per-request instance the middleware already initialized, and read it back anywhere below through `intl`:

```tsx
import { IntlProvider, intl } from "@sdxc/i18n/ui";
import type { Handle } from "remix/ui";

router.get("/", (context) => {
	return context.render(
		<IntlProvider i18n={context.i18next}>
			<Page />
		</IntlProvider>,
	);
});

function Greeting(handle: Handle) {
	let i18n = intl(handle);
	return () => <p>{i18n.t("greeting")}</p>;
}
```

A translation containing markup renders through `Trans` instead of `t()`, splicing a `RemixElement` in for each `<tagName>` marker and keeping that tag's own text as the element's children. `Trans` reads its `i18n` from the nearest ancestor `IntlProvider` when the prop isn't given:

```tsx
import { Trans } from "@sdxc/i18n/ui";

// en.json: { "feed.article": "Read <articleLink>{{title}}</articleLink>" }
function ArticleTeaser(handle: Handle<{ title: string; href: string }>) {
	return () => (
		<Trans
			i18nKey="feed.article"
			values={{ title: handle.props.title }}
			components={{ articleLink: <a href={handle.props.href} /> }}
		/>
	);
}
```

A `remix/ui` tree with no ancestor `IntlProvider` needs its own client-side instance. That's true for a client-only single-page app with no server round trip, and it's also true for each independently hydrated island in an otherwise server-rendered page — a `clientEntry` island mounts its own runtime tree, with no access to context published outside of it.

Wrapping every island in its own `IntlProvider` would work, but it's repetitive. Client-side, one instance per page load is enough, since there's exactly one user rather than many concurrent requests sharing a Workers isolate. Register one instance with `setIntl` instead, once, before mounting or hydrating anything — every island's `intl(handle)`/`Trans` then picks it up, with no `IntlProvider` needed:

```tsx
// bootstrap/browser.ts, before run() mounts anything
import { createTranslator } from "@sdxc/i18n";
import { setIntl } from "@sdxc/i18n/ui";
import { run } from "remix/ui";

let { i18n } = await createTranslator({
	resources: { en: { translation: en }, es: { translation: es } },
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
})(document.documentElement.lang);

setIntl(i18n);

run({ loadModule, resolveFrame });
```

Now an island just calls `intl(handle)` directly, with no `IntlProvider` of its own:

```tsx
// resources/islands/comment-form.tsx
import { intl } from "@sdxc/i18n/ui";
import { clientEntry, type Handle } from "remix/ui";

export let CommentForm = clientEntry(
	"/assets/comment-form.js#CommentForm",
	function CommentForm(handle: Handle<{ postId: string }>) {
		let i18n = intl(handle);
		return () => <Form label={i18n.t("comment.label")} postId={handle.props.postId} />;
	},
);
```

A page rendered entirely client-side (no server round trip, so no `run()`/`clientEntry` islands at all) follows the same idea — call `setIntl` once before `.mount()` instead of before `run()`.

`IntlProvider` still has a role client-side: wrap one specific subtree in it to override the `setIntl` default with a different instance (a namespace-scoped one, say) — an ancestor `IntlProvider` always wins over the `setIntl` default when both exist.

## API

### `i18next(options: I18nextMiddlewareOptions): Middleware`

Default export of `@sdxc/i18n/middleware`. Creates a middleware that detects the request language, initializes a dedicated i18next instance for the request over that language's bundle and the fallback's, and sets both on the request context as `context.locale` and `context.i18next`. Initialization awaits the instance's initial namespace load, so translations loaded by a backend plugin are ready by the time handlers run.

**Parameters:**

- `options.detection`: Language detection configuration; see [`LanguageDetectorOptions`](#languagedetectoroptions)
- `options.i18next`: i18next [init options](https://www.i18next.com/overview/configuration-options) for the per-request instance. `supportedLngs` and `fallbackLng` default to the detection configuration; `lng` is always overridden with the detected language; `resources` is narrowed to the detected language's bundle plus the fallback language's (and their primary subtags, so an `en-US` request still resolves through an `en` bundle), so the other languages' bundles are never attached
- `options.plugins`: i18next plugins (backends, post-processors) registered on the per-request instance before it initializes

**Returns:**

- A `Middleware` for `remix/router` that populates `context.locale` and `context.i18next`

**Example:**

```typescript
import i18next from "@sdxc/i18n/middleware";

let middleware = i18next({
	detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
});
```

Importing the module augments `RequestContext` from `remix/router` with:

- `locale`: `string` - Language detected for the current request
- `i18next`: `i18n` - Per-request i18next instance initialized with that language

### `LanguageDetector`

Detects the user's preferred language fully server-side from a `Request`. Every candidate is validated against the supported languages — first with an exact subtag match, then loosely by primary language code (so `es-AR` can match a supported `es`) — and the fallback language is returned when nothing matches.

#### `new LanguageDetector(options: LanguageDetectorOptions)`

Creates a detector. Methods missing their required option (e.g. `cookie` detection without a `cookie`) are skipped rather than treated as errors.

#### `detector.detect(request: Request, session?: Session): Promise<string>`

Probes each configured method in order and returns the first supported match, or the fallback language.

**Parameters:**

- `request`: The incoming request
- `session`: A live `Session` for the request; when provided, the `session` method reads it directly instead of loading from storage

**Returns:**

- The detected language, always one of `supportedLanguages` or the `fallbackLanguage`

### `getClientLocales(requestOrHeaders: Request | Headers): string | undefined`

Gets the client's best-quality locale from the `Accept-Language` header, filtered to tags the JavaScript `Intl` APIs can represent. Unlike the detector this is not constrained to the app's supported languages, which makes it the right input for `Intl` formatters.

**Parameters:**

- `requestOrHeaders`: The incoming Request, or its Headers

**Returns:**

- The best client locale (e.g. `"en-US"`), or `undefined` when the header is missing or unusable

**Example:**

```typescript
import { getClientLocales } from "@sdxc/i18n";

let date = new Date().toLocaleDateString(getClientLocales(request));
```

### `createTranslator(options: TranslatorOptions): Translator`

Creates a translator over a fixed set of bundles, for code with no request behind it. The returned `Translator` takes a language and resolves a `Translation`: the language it actually bound to, a `t` already fixed to it, and the instance behind that `t`.

A language outside `supportedLanguages` resolves to `fallbackLanguage` before anything is built, so `translation.locale` is the language the copy was really produced in and can be recorded or reported as such — never the one that was asked for.

Instances are cached by resolved language, so repeated work in the same language (one event fanning out into many messages) initializes i18next once, not once per message. The cache belongs to the translator the factory returned, so two translators configured with different bundles never hand each other's instances out. Unlike the middleware's per-request instance, every supported language's bundle is attached, so `translation.i18n.getFixedT(other)` still resolves another language.

**Parameters:**

- `options.resources`: i18next [resources](https://www.i18next.com/overview/configuration-options), every language's bundle
- `options.supportedLanguages`: Languages the caller ships; anything else resolves to the fallback
- `options.fallbackLanguage`: Language used when none is asked for, when the asked-for one is unsupported, and for a key missing from another language's bundle
- `options.i18next`: Further i18next init options for every instance built. `lng`, `supportedLngs`, `fallbackLng`, and `resources` are always taken from the options above, so the two layers cannot disagree

**Returns:**

- A `Translator`: `(language?: string) => Promise<Translation>`

**Example:**

```typescript
let translate = createTranslator({
	resources,
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
});
let { locale, t } = await translate("es");
```

### `IntlProvider`

`remix/ui` context provider, from `@sdxc/i18n/ui`. Publishes an i18next instance to every descendant through context and renders `children` unchanged.

Client-side, it also re-renders its whole subtree on its own whenever the instance's language changes or a namespace finishes loading, so every descendant's `i18n.t()`/`Trans` call reflects it without subscribing to anything itself. Server-side, it subscribes to nothing at all — the request's language is meant to stay fixed for the whole render, and the subscription is wired through `handle.queueTask`, which the server renderer never runs.

**Props:**

- `i18n`: The instance to publish — the request's `context.i18next` server-side, or one created directly with i18next's own `createInstance()` client-side
- `children`: `RemixNode`

**Example:**

```tsx
<IntlProvider i18n={ctx.i18next}>
	<App />
</IntlProvider>
```

### `setIntl(i18n: i18n): void`

From `@sdxc/i18n/ui`. Registers a module-scoped default instance for `intl` to fall back to when there's no ancestor `IntlProvider` — every independently hydrated island's own case. Call this once, before mounting or hydrating anything, from the client bootstrap.

Browser-only — **throws** when called from server code, since a module-scoped instance would be shared by every concurrent request in a Workers isolate, exactly what `@sdxc/i18n/middleware`'s per-request instance exists to avoid.

**Example:**

```typescript
setIntl(i18n);
run({ loadModule, resolveFrame });
```

### `intl(handle: Handle<unknown, any>): i18n`

A `handle.context.get(IntlProvider)` wrapper, from `@sdxc/i18n/ui`, so call sites don't need to import `IntlProvider` just to look it up. Falls back to the `setIntl` default when there's no ancestor `IntlProvider`, and throws when neither exists.

**Example:**

```typescript
let i18n = intl(handle);
let message = i18n.t("greeting");
```

### `Trans`

`remix/ui` component, from `@sdxc/i18n/ui`, for a translation containing markup. Splices the `RemixElement` from `components` whose key matches each `<tagName>...</tagName>` marker in the translation in, keeping that tag's own text/nesting as the spliced element's children. Plain `{{variable}}` interpolation happens through `i18n.t()` itself, same as calling it directly.

**Props:**

- `i18n`: Instance to translate through. Optional — defaults to the nearest ancestor `IntlProvider`'s instance (via `intl`); pass it explicitly to translate through a different instance
- `i18nKey`: Translation key to look up. Named `i18nKey`, not `key` — `key` is `remix/ui`'s own reconciliation prop and never reaches the component
- `values`: Interpolation values, forwarded to `i18n.t()` alongside `i18nKey`
- `components`: Elements spliced in for each tag, keyed by tag name

**Example:**

```tsx
// en.json: { "feed.article": "Read <articleLink>{{title}}</articleLink>" }
<Trans
	i18nKey="feed.article"
	values={{ title: article.title }}
	components={{ articleLink: <a href={article.href} /> }}
/>
```

### Types

#### `LanguageDetectorOptions`

```typescript
interface LanguageDetectorOptions {
	supportedLanguages: string[];
	fallbackLanguage: string;
	cookie?: Cookie;
	sessionCookie?: Cookie;
	sessionStorage?: SessionStorage;
	sessionKey?: string; // default "lng"
	searchParamKey?: string; // default "lng"
	order?: DetectionMethod[];
	findLocale?(request: Request): Promise<string | string[] | null>;
}
```

- `supportedLanguages`: Languages the app supports; keep in sync with i18next's `supportedLngs`
- `fallbackLanguage`: Returned when no method produces a supported match; keep in sync with `fallbackLng`
- `cookie`: `Cookie` (from `remix/cookie`) storing the preferred language as its plain value
- `sessionCookie` + `sessionStorage`: Pair used to load the session outside middleware; unnecessary when a live `Session` is passed to `detect`
- `sessionKey` / `searchParamKey`: Where the language is stored in the session / query string
- `order`: Which methods run and in what order; defaults to `searchParams`, `cookie`, `session`, `header`, with `custom` prepended when `findLocale` is set
- `findLocale`: Custom lookup for the `custom` method (URL pathname, database, etc.)

#### `DetectionMethod`

```typescript
type DetectionMethod = "searchParams" | "cookie" | "session" | "header" | "custom";
```

#### `I18nextMiddlewareOptions`

```typescript
interface I18nextMiddlewareOptions {
	detection: LanguageDetectorOptions;
	i18next?: Omit<InitOptions, "detection">;
	plugins?: NewableModule<Module>[] | Module[];
}
```

#### `TranslatorOptions`

```typescript
interface TranslatorOptions {
	resources: Resource;
	supportedLanguages: readonly string[];
	fallbackLanguage: string;
	i18next?: Omit<InitOptions, "fallbackLng" | "lng" | "resources" | "supportedLngs">;
}
```

#### `Translation` and `Translator`

```typescript
interface Translation {
	locale: string; // the language the copy is actually produced in
	t: TFunction; // already fixed to locale
	i18n: i18n; // the instance t is fixed from
}

interface Translator {
	(language?: string): Promise<Translation>;
}
```

#### `TFunction` and `i18n`

i18next's own types, re-exported from the root entry. Type a translator or an instance (`ctx.i18next`, an `IntlProvider` prop, a function taking a `t`) through these, so translation stays this package's contract and consuming apps never depend on i18next directly.

```typescript
import type { TFunction } from "@sdxc/i18n";

export function greet(t: TFunction): string {
	return t("greeting");
}
```

## Pattern: Loading translations with a backend plugin

Register an i18next backend as a plugin and the middleware awaits the initial namespace load for the detected language, so `t` is ready in handlers. Any [i18next backend](https://www.i18next.com/overview/plugins-and-utils#backends) works.

```typescript
import type { BackendModule } from "i18next";
import i18next from "@sdxc/i18n/middleware";

import en from "~/locales/en";
import es from "~/locales/es";

let bundles: Record<string, object> = { en, es };

let backend: BackendModule = {
	type: "backend",
	init() {},
	read(language, _namespace, callback) {
		callback(null, bundles[language] ?? null);
	},
};

let middleware = i18next({
	detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
	plugins: [backend],
});
```

## Pattern: Reusing the session from the session middleware

When `remix/middleware/session` runs earlier in the chain, the detector reads the language from the live request session — no second storage read, and no `sessionCookie`/`sessionStorage` configuration needed.

```typescript
import i18next from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/router";
import { session } from "remix/middleware/session";

let sessionCookie = createCookie("__session", { secrets: ["s3cr3t"] });

let router = createRouter({
	middleware: [
		session(sessionCookie, sessionStorage),
		// After the session middleware, so detection sees context's Session
		i18next({ detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" } }),
	],
});
```

## Pattern: Letting the user pick a language

Store the choice in a dedicated cookie and give that cookie to the detector; the query string can override it for one-off links.

```typescript
import i18next from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";

let localeCookie = createCookie("lng", { maxAge: 60 * 60 * 24 * 365 });

let middleware = i18next({
	detection: {
		supportedLanguages: ["en", "es"],
		fallbackLanguage: "en",
		cookie: localeCookie,
	},
});

// In the action handling the language switcher form:
router.post("/language", async (context) => {
	let language = (await context.request.formData()).get("lng");
	if (typeof language !== "string") return new Response(null, { status: 400 });
	return new Response(null, {
		status: 302,
		headers: {
			Location: "/",
			"Set-Cookie": await localeCookie.serialize(language),
		},
	});
});
```

## Pattern: Locale from the URL pathname

Use `findLocale` for path-based locales like `/es/dashboard`; it runs before every other method by default.

```typescript
import { LanguageDetector } from "@sdxc/i18n";

let detector = new LanguageDetector({
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
	async findLocale(request) {
		return new URL(request.url).pathname.split("/").at(1) ?? null;
	},
});
```

## Related Packages

- [`@sdxc/http`](../http/README.md) - `Accept` header content negotiation, the sibling concern to `Accept-Language` detection

## Tips

1. **Order the middleware after the session middleware** - The detector only reuses the live session when it is already on the context; otherwise the `session` method needs its own `sessionCookie`/`sessionStorage` pair.
2. **Let the middleware derive `supportedLngs` and `fallbackLng`** - They default to the detection configuration, so only set them in the `i18next` options when they intentionally differ.
3. **Detection never throws** - Methods missing their configuration are skipped and unsupported values are ignored, so `context.locale` is always safe to use as a supported language.
4. **Use `getClientLocales` for formatting, the detector for content** - Formatting should honor the client's exact regional preference (`en-GB` dates) even when the app only ships `en` translations.
5. **Only the detected language and the fallback are attached** - `context.i18next.t(key, { lng })` for any other supported language finds no bundle, because the request's instance is built over those two only. Translate through an instance of your own when a request genuinely needs a third language.
6. **The instance is per-request** - Do not cache `context.i18next` in module scope; sharing one instance across requests leaks one user's language into another's response. `createTranslator`'s cache is the deliberate exception: its instances are bound to a language chosen by the caller, never to a request, so nothing about one user is in them.
7. **Record `translation.locale`, not the language you asked for** - They differ exactly when the request was for a language the app does not ship, which is the case worth knowing about after the fact.
8. **`Trans` takes `i18nKey`, not `key`** - `key` is `remix/ui`'s own reconciliation prop and is stripped before a component ever sees its props.
9. **Pick a `components` key that isn't a real HTML void element** - `link`, `br`, `img`, `hr`, and the rest of that list are parsed as self-closing regardless of how the translation wrote them, since the underlying parser checks tag names against the real HTML void-element list, not against `components`. A tag meant to wrap children needs a different name (`articleLink`, not `link`).
10. **Register one instance with `setIntl`, not one `IntlProvider` per island** - every independently hydrated island has no ancestor context to read, but client-side there's exactly one user per page, so a single module-scoped default is safe. Reach for `IntlProvider` client-side only to override that default for one specific subtree.
11. **`IntlProvider` re-renders on `changeLanguage()`/a namespace loading, client-side only** - it subscribes through `handle.queueTask`, which the server renderer never runs, so nothing subscribes to anything server-side. Don't call `i18n.changeLanguage()` mid-request on the server either way — a request's language is resolved once, before rendering starts, and rendering streams, so anything already sent would keep the old language while anything rendered after the call wouldn't.
