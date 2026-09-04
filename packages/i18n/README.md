# @sdxc/i18n

Server-side language detection, a Remix middleware that publishes a per-request [i18next](https://www.i18next.com) instance, and `remix/ui` components that render translations containing markup.

The detector is the one from [remix-i18next](https://github.com/sergiodxa/remix-i18next), ported to the Remix v3 primitives.

## Installation

```bash
npm add @sdxc/i18n
```

Requires `i18next` and `remix` (v3) as companions; the `remix/ui` exports are only needed when rendering translations through `remix/ui`.

The package ships three entry points:

- `@sdxc/i18n` — `LanguageDetector`, `getClientLocales`, `createTranslator`, and i18next's `i18n`/`TFunction` types. No router dependency.
- `@sdxc/i18n/middleware` — the default-exported `i18next` middleware for `remix/router`.
- `@sdxc/i18n/ui` — `IntlProvider`, `intl`, `setIntl`, and `Trans` for `remix/ui`.

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
let { locale, t } = await translate(user.language);
// locale is the language the copy was actually produced in — "en" when
// user.language is one this app does not ship.
await send({ subject: t("digest.subject"), locale });
```

### Rendering with `remix/ui`

Wrap a server-rendered page in `IntlProvider` with the per-request instance, and read it back anywhere below through `intl`:

```tsx
import { intl, IntlProvider } from "@sdxc/i18n/ui";
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

A translation containing markup renders through `Trans`, which splices a `RemixElement` in for each `<tagName>` marker and keeps that tag's own text as the element's children:

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

Pick a `components` key that is not a real HTML void element: `link`, `br`, `img`, and `hr` parse as self-closing whatever the translation wrote, so a tag meant to wrap children needs a different name (`articleLink`, not `link`).

Each independently hydrated island mounts its own tree, with no access to context published outside of it. Register one instance with `setIntl` from the client bootstrap and every island's `intl(handle)`/`Trans` picks it up, with an ancestor `IntlProvider` still winning over it for a specific subtree:

```tsx
import { setIntl } from "@sdxc/i18n/ui";
import { run } from "remix/ui";

setIntl(i18n);
run({ loadModule, resolveFrame });
```

## API

### `i18next(options: I18nextMiddlewareOptions): Middleware`

Default export of `@sdxc/i18n/middleware`. Detects the request language, initializes a dedicated i18next instance for the request over that language's bundle and the fallback's, and sets both on the request context as `context.locale` and `context.i18next`. Initialization awaits the initial namespace load, so translations loaded by a backend plugin are ready by the time handlers run.

- `options.detection`: Language detection configuration; see [`LanguageDetectorOptions`](#languagedetectoroptions)
- `options.i18next`: i18next [init options](https://www.i18next.com/overview/configuration-options) for the per-request instance. `supportedLngs` and `fallbackLng` default to the detection configuration, `lng` is always the detected language, and `resources` narrows to the detected language's bundle plus the fallback's (and their primary subtags, so an `en-US` request still resolves through an `en` bundle)
- `options.plugins`: i18next plugins (backends, post-processors) registered on the per-request instance before it initializes

Importing the module augments `RequestContext` from `remix/router` with `locale: string` and `i18next: i18n`.

Pass any [i18next backend](https://www.i18next.com/overview/plugins-and-utils#backends) in `plugins` to load translations from wherever they live. Because only the detected language and the fallback are attached, `context.i18next.t(key, { lng })` for a third language finds no bundle; build an instance of your own when a request genuinely needs one.

### `LanguageDetector`

From `@sdxc/i18n`. Detects the user's preferred language server-side from a `Request`, validating every candidate against the supported languages: an exact subtag match first, then loosely by primary language code, so `es-AR` matches a supported `es`. The fallback language is returned when nothing matches.

#### `new LanguageDetector(options: LanguageDetectorOptions)`

Creates a detector. A method missing its required option — cookie detection without a `cookie`, say — is skipped rather than treated as an error, so detection always resolves to a supported language.

#### `detector.detect(request: Request, session?: Session): Promise<string>`

Probes each configured method in order and returns the first supported match, or the fallback language. Passing a live `Session` makes the `session` method read it directly instead of loading from storage.

### `getClientLocales(requestOrHeaders: Request | Headers): string | undefined`

From `@sdxc/i18n`. Returns the client's best-quality locale from the `Accept-Language` header, filtered to tags the JavaScript `Intl` APIs can represent, or `undefined` when the header is missing or unusable. This is the right input for `Intl` formatters: it honors the client's exact regional preference (`en-GB` dates) even for an app that only ships `en` translations.

```typescript
import { getClientLocales } from "@sdxc/i18n";

let date = new Date().toLocaleDateString(getClientLocales(request));
```

### `createTranslator(options: TranslatorOptions): Translator`

From `@sdxc/i18n`. Creates a translator over a fixed set of bundles, for code with no request behind it. The returned `Translator` takes a language and resolves a `Translation`: the language it bound to, a `t` already fixed to it, and the instance behind that `t`.

A language outside `supportedLanguages` resolves to `fallbackLanguage` before anything is built, so record `translation.locale` rather than the language you asked for: they differ exactly when the app does not ship the requested one. Instances are cached per resolved language and per translator, and every supported language's bundle is attached, so `translation.i18n.getFixedT(other)` still resolves another language.

- `options.resources`: i18next [resources](https://www.i18next.com/overview/configuration-options), every language's bundle
- `options.supportedLanguages`: Languages the caller ships; anything else resolves to the fallback
- `options.fallbackLanguage`: Language used when none is asked for, when the asked-for one is unsupported, and for a key missing from another language's bundle
- `options.i18next`: Further i18next init options for every instance built; `lng`, `supportedLngs`, `fallbackLng`, and `resources` always come from the options above

### `IntlProvider`

`remix/ui` context provider, from `@sdxc/i18n/ui`. Publishes the `i18n` prop to every descendant through context and renders `children` unchanged.

Client-side it re-renders its whole subtree whenever the instance's language changes or a namespace finishes loading, so every descendant's `i18n.t()`/`Trans` call reflects it. Server-side it subscribes to nothing: the subscription is wired through `handle.queueTask`, which the server renderer never runs, and a request's language stays fixed for the whole render.

### `setIntl(i18n: i18n): void`

From `@sdxc/i18n/ui`. Registers a module-scoped default instance for `intl` to fall back to when there is no ancestor `IntlProvider`. Call it once from the client bootstrap, before mounting or hydrating anything. Browser-only: it throws when called from server code, where a module-scoped instance would be shared by every concurrent request.

### `intl(handle: Handle<unknown, any>): i18n`

From `@sdxc/i18n/ui`. Reads the instance published by the nearest ancestor `IntlProvider`, falling back to the `setIntl` default, and throws when neither exists.

### `Trans`

`remix/ui` component, from `@sdxc/i18n/ui`, for a translation containing markup. Splices the `RemixElement` from `components` whose key matches each `<tagName>...</tagName>` marker into the output, keeping that tag's own text and nesting as the spliced element's children. Plain `{{variable}}` interpolation happens through `i18n.t()` itself.

- `i18n`: Instance to translate through. Defaults to the nearest ancestor `IntlProvider`'s instance (via `intl`); pass it explicitly to translate through a different one
- `i18nKey`: Translation key to look up. Named `i18nKey` because `key` is `remix/ui`'s own reconciliation prop and never reaches the component
- `values`: Interpolation values, forwarded to `i18n.t()` alongside `i18nKey`
- `components`: Elements spliced in for each tag, keyed by tag name

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

- `supportedLanguages` / `fallbackLanguage`: Keep these in sync with i18next's `supportedLngs` and `fallbackLng`
- `cookie`: `Cookie` (from `remix/cookie`) storing the preferred language as its plain value
- `sessionCookie` + `sessionStorage`: Pair used to load the session outside middleware; unnecessary when a live `Session` is passed to `detect`
- `order`: Which methods run and in what order; defaults to `searchParams`, `cookie`, `session`, `header`, with `custom` prepended when `findLocale` is set
- `findLocale`: Custom lookup for the `custom` method, such as a locale in the URL pathname; returning `null` defers to later methods

#### `DetectionMethod`

```typescript
type DetectionMethod = "searchParams" | "cookie" | "session" | "header" | "custom";
```

#### `I18nextMiddlewareOptions` and `TranslatorOptions`

The option objects taken by the middleware and by `createTranslator`, field by field above.

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

i18next's own types, re-exported from `@sdxc/i18n` so a function taking a `t` or holding an instance can be typed without importing i18next directly.

## Pattern: Loading translations with a backend plugin

Plugins are registered on the per-request instance before it initializes, and the middleware awaits the initial namespace load, so `t` is ready by the time handlers run. Any [i18next backend](https://www.i18next.com/overview/plugins-and-utils#backends) works.

```typescript
import type { BackendModule } from "i18next";

import i18next from "@sdxc/i18n/middleware";

import en from "./locales/en.js";
import es from "./locales/es.js";

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

Order the i18next middleware after `remix/middleware/session` so the detector reads the language from the live request session: it needs no `sessionCookie`/`sessionStorage` configuration and performs no second storage read. Ordered before the session middleware, the `session` detection method is skipped instead.

```typescript
import i18next from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

let sessionCookie = createCookie("__session", { secrets: ["s3cr3t"] });
let sessionStorage = createCookieSessionStorage();

let router = createRouter({
	middleware: [
		session(sessionCookie, sessionStorage),
		i18next({ detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" } }),
	],
});
```

## Pattern: Letting the user pick a language

Store the choice in a dedicated cookie and hand that cookie to the detector. The `searchParams` method still runs first, so a `?lng=` link overrides the stored choice for one request.

```typescript
import i18next from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/router";

let localeCookie = createCookie("lng", { maxAge: 60 * 60 * 24 * 365 });

let router = createRouter({
	middleware: [
		i18next({
			detection: {
				supportedLanguages: ["en", "es"],
				fallbackLanguage: "en",
				cookie: localeCookie,
			},
		}),
	],
});

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

`findLocale` covers path-based locales like `/es/dashboard`. Setting it prepends the `custom` method to the default order, so it runs before every other method; returning `null` defers to them.

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

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/i18n": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
