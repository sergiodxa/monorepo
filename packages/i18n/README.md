# @pkg/i18n

Server-side internationalization for Remix fetch-router apps: language detection plus a middleware that publishes a per-request [i18next](https://www.i18next.com) instance on the request context.

## Overview

Every request needs an answer to "which language does this user want?" before any translated content can render. This package ports the server-side language detector from [remix-i18next](https://github.com/sergiodxa/remix-i18next) to the Remix v3 primitives: it probes search params, a cookie, the session, the `Accept-Language` header, and optional custom logic in a configurable order, validates every candidate against the languages the app actually supports, and always falls back to a guaranteed language.

Translation itself is delegated to i18next. The middleware in `@pkg/i18n/middleware` creates and initializes a dedicated i18next instance per request — registered plugins (such as a backend that loads translation files) run before handlers do — and exposes it as `context.i18next` alongside `context.locale`. A per-request instance means concurrent requests in different languages never share mutable language state, which matters in a Workers runtime where one isolate serves many requests.

The root entry (`@pkg/i18n`) has no router dependency, so the detector and locale helpers can also be used outside middleware (e.g. in background jobs or non-router handlers).

## Usage

### Middleware

```typescript
import i18next from "@pkg/i18n/middleware";
import { createRouter } from "remix/fetch-router";

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
import { LanguageDetector } from "@pkg/i18n";

let detector = new LanguageDetector({
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
});

let locale = await detector.detect(request); // always a supported language
```

## API

### `i18next(options: I18nextMiddlewareOptions): Middleware`

Default export of `@pkg/i18n/middleware`. Creates a middleware that detects the request language, initializes a dedicated i18next instance for the request, and sets both on the request context as `context.locale` and `context.i18next`. Initialization awaits the instance's initial namespace load, so translations loaded by a backend plugin are ready by the time handlers run.

**Parameters:**

- `options.detection`: Language detection configuration; see [`LanguageDetectorOptions`](#languagedetectoroptions)
- `options.i18next`: i18next [init options](https://www.i18next.com/overview/configuration-options) for the per-request instance. `supportedLngs` and `fallbackLng` default to the detection configuration; `lng` is always overridden with the detected language
- `options.plugins`: i18next plugins (backends, post-processors) registered on the per-request instance before it initializes

**Returns:**

- A `Middleware` for `remix/fetch-router` that populates `context.locale` and `context.i18next`

**Example:**

```typescript
import i18next from "@pkg/i18n/middleware";

let middleware = i18next({
	detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
});
```

Importing the module augments `RequestContext` from `remix/fetch-router` with:

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
import { getClientLocales } from "@pkg/i18n";

let date = new Date().toLocaleDateString(getClientLocales(request));
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

## Pattern: Loading translations with a backend plugin

Register an i18next backend as a plugin and the middleware awaits the initial namespace load for the detected language, so `t` is ready in handlers. Any [i18next backend](https://www.i18next.com/overview/plugins-and-utils#backends) works.

```typescript
import type { BackendModule } from "i18next";
import i18next from "@pkg/i18n/middleware";

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

When `remix/session-middleware` runs earlier in the chain, the detector reads the language from the live request session — no second storage read, and no `sessionCookie`/`sessionStorage` configuration needed.

```typescript
import i18next from "@pkg/i18n/middleware";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/fetch-router";
import { session } from "remix/session-middleware";

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
import i18next from "@pkg/i18n/middleware";
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
import { LanguageDetector } from "@pkg/i18n";

let detector = new LanguageDetector({
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
	async findLocale(request) {
		return new URL(request.url).pathname.split("/").at(1) ?? null;
	},
});
```

## Related Packages

- [`@pkg/http`](../http/README.md) - `Accept` header content negotiation, the sibling concern to `Accept-Language` detection

## Tips

1. **Order the middleware after the session middleware** - The detector only reuses the live session when it is already on the context; otherwise the `session` method needs its own `sessionCookie`/`sessionStorage` pair.
2. **Let the middleware derive `supportedLngs` and `fallbackLng`** - They default to the detection configuration, so only set them in the `i18next` options when they intentionally differ.
3. **Detection never throws** - Methods missing their configuration are skipped and unsupported values are ignored, so `context.locale` is always safe to use as a supported language.
4. **Use `getClientLocales` for formatting, the detector for content** - Formatting should honor the client's exact regional preference (`en-GB` dates) even when the app only ships `en` translations.
5. **The instance is per-request** - Do not cache `context.i18next` in module scope; sharing one instance across requests leaks one user's language into another's response.
