# @sdxc/i18n

Language detection, translators for [Unicode MessageFormat 2](https://messageformat.unicode.org) messages, a Remix middleware that publishes one per request, and `remix/ui` components that render messages containing markup.

The detector is the one from [remix-i18next](https://github.com/sergiodxa/remix-i18next), ported to the Remix v3 primitives. Messages format through [`@sdxc/messageformat`](https://www.npmjs.com/package/@sdxc/messageformat).

## Installation

```bash
npm add @sdxc/i18n
```

Requires `remix` (v3) as a companion; the `remix/ui` exports are only needed when rendering through `remix/ui`.

The package ships three entry points:

- `@sdxc/i18n` — `createI18n`, `createTranslator`, `LanguageDetector`, `getClientLocales`, and the `I18n`/`Translate`/`Messages` types. No router or logger dependency, so it runs in the browser.
- `@sdxc/i18n/middleware` — the default-exported `i18n` middleware for `remix/router`.
- `@sdxc/i18n/ui` — `IntlProvider`, `intl`, `setIntl`, and `Trans` for `remix/ui`. Browser-safe.

## Messages

Bundles are plain objects, one per language, nested by dotted key segment, with MessageFormat 2 strings as leaves:

```typescript
export default {
	greeting: "Hello {$name}",
	feeds: {
		unread:
			".input {$count :number}\n.match $count\none {{{$count} unread}}\n* {{{$count} unread}}",
		article: "Read {#articleLink}{$title}{/articleLink}",
	},
};
```

- Variables are `{$name}`. Values interpolate raw, with no escaping: JSX escapes text nodes.
- Plurals are one key with a `.match` on a `:number` input; the variant is picked by the language's CLDR plural category (`one`, `few`, `many`, `other`, …) or an exact number, and `*` catches the rest.
- Markup is `{#name}…{/name}` or standalone `{#name/}`, rendered by `Trans`. Any name works, `link` and `br` included.

## Usage

### Translating

```typescript
import { createI18n } from "@sdxc/i18n";

import en from "./locales/en.js";
import es from "./locales/es.js";

let intl = createI18n({ locale: "es-MX", fallbackLanguage: "en", resources: { en, es } });

intl.t("greeting", { name: "Ada" }); // "Hola Ada"
intl.t("feeds.unread", { count: 1200 }); // the English copy when neither es-MX nor es has the key
intl.t("feeds.missing"); // "feeds.missing"
```

### Per-request translation in a router

```typescript
import i18n from "@sdxc/i18n/middleware";
import { createRouter } from "remix/router";

import en from "./locales/en.js";
import es from "./locales/es.js";

let router = createRouter({
	middleware: [
		i18n({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			resources: { en, es },
		}),
	],
});

router.get("/", (context) => {
	// context.locale is the detected language, e.g. "es"
	return new Response(context.intl.t("greeting", { name: "Ada" }));
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
	resources: { en, es },
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
});

// In a job, a consumer, a browser bootstrap, or anywhere `context.intl` does not exist:
let { locale, t } = await translate(user.language);
```

### Rendering with `remix/ui`

```tsx
import { intl, IntlProvider } from "@sdxc/i18n/ui";

router.get("/", (context) =>
	context.render(
		<IntlProvider intl={context.intl}>
			<Greeting />
		</IntlProvider>,
	),
);

function Greeting(handle: Handle) {
	return () => <p>{intl(handle).t("greeting", { name: "Ada" })}</p>;
}
```

### Messages with markup

```tsx
import { Trans } from "@sdxc/i18n/ui";

// feeds.article: "Read {#articleLink}{$title}{/articleLink}"
<Trans
	i18nKey="feeds.article"
	values={{ title: item.title }}
	components={{ articleLink: <a href={item.link} /> }}
/>;
```

### Hydrated islands

```typescript
import { createTranslator } from "@sdxc/i18n";
import { setIntl } from "@sdxc/i18n/ui";

let { intl } = await createTranslator({ resources, supportedLanguages, fallbackLanguage })(
	document.documentElement.lang,
);
setIntl(intl);
```

## API

### `createI18n(options: I18nOptions<Resources, Fallback>): I18n<Resources[Fallback]>`

From `@sdxc/i18n`. Creates a translator fixed to `options.locale`. It is synchronous and does no work up front.

- `options.locale`: The language to translate into
- `options.fallbackLanguage`: The language whose bundle answers keys the locale lacks
- `options.resources`: Bundles keyed by language
- `options.onError`: `(error: Error, key: string) => void`, receiving syntax and formatting errors; without it errors are discarded

A key resolves through `[locale, primary(locale), fallbackLanguage, primary(fallbackLanguage)]`, deduplicated and limited to languages in `resources`, so an `en-US` request reads an `en-US` bundle first and then `en`. The first string leaf at the dotted key wins, and a key with no message anywhere returns the key itself.

Each message compiles on first use for the language it was found in, and is cached per `resources` object, language and key, so concurrent requests share compiled messages and two apps with different bundles never collide. Keep one `resources` object per app to benefit from the cache.

A placeholder that fails to format shows as its MessageFormat 2 fallback, such as `{$name}`; a message that fails to compile renders its key. Both reach `onError` and neither throws.

### `I18n<R>`

```typescript
interface I18n<R = Messages> {
	readonly locale: string;
	t: Translate<R>; // (key, values?) => string
	parts: TranslateParts<R>; // (key, values?) => MessagePart[]
	onError: I18nErrorHandler;
}
```

An `I18n` is immutable. `parts` returns `@sdxc/messageformat` parts, markup included, for a renderer of its own; a missing key yields a single text part holding the key. `onError` is where `Trans` reports markup it cannot match.

### `i18n(options: I18nMiddlewareOptions): Middleware`

Default export of `@sdxc/i18n/middleware`. Detects the request language and sets `context.locale` and `context.intl`, an `I18n` for that language. Message errors are logged as `i18n.error` warnings on the invocation's [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) log.

- `options.detection`: See `LanguageDetectorOptions`; `fallbackLanguage` also answers missing keys
- `options.resources`: Bundles keyed by language

Importing the module augments `RequestContext` from `remix/router` with `locale: string` and `intl: I18n`.

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

From `@sdxc/i18n`. Creates a translator over a fixed set of bundles, for code with no request behind it. The returned `Translator` takes a language and resolves a `Translation`: the language it bound to, its `t`, and the `I18n` behind it.

A language outside `supportedLanguages` resolves to `fallbackLanguage` first, so record `translation.locale` rather than the language you asked for: they differ exactly when the app does not ship the requested one. Translations are cached per resolved language and per translator.

- `options.resources`: Every language's bundle
- `options.supportedLanguages`: The languages the caller ships
- `options.fallbackLanguage`: The default language, and the one missing keys resolve through
- `options.onError`: Receives message errors; pass one that logs them, since the entry point stays free of a logger so it can run in the browser

### `IntlProvider`

`remix/ui` context provider, from `@sdxc/i18n/ui`. Publishes the `intl` prop to every descendant through context and renders `children` unchanged. To switch language on the client, render it with a new `I18n`.

### `setIntl(intl: I18n): void`

From `@sdxc/i18n/ui`. Registers a module-scoped default `I18n` for `intl` to fall back to when there is no ancestor `IntlProvider`. Call it once from the client bootstrap, before mounting or hydrating anything. Browser-only: it throws when called from server code, where a module-scoped translator would be shared by every concurrent request.

### `intl(handle: Handle<unknown, any>): I18n`

From `@sdxc/i18n/ui`. Reads the `I18n` published by the nearest ancestor `IntlProvider`, falling back to the `setIntl` default, and throws when neither exists.

### `Trans`

`remix/ui` component, from `@sdxc/i18n/ui`, for a message containing markup. Each `{#name}…{/name}` pair renders as the `components[name]` element with the content between them, nested markup included, as its children; a standalone `{#name/}` renders the element with no children.

- `intl`: Translator to format through, typed or not; defaults to the nearest ancestor `IntlProvider`'s (via `intl`)
- `i18nKey`: Message key. Named `i18nKey` because `key` is `remix/ui`'s own reconciliation prop and never reaches the component
- `values`: Values for the message's variables
- `components`: Elements keyed by markup name

Markup with no `components` entry renders its children unwrapped and reports an error through the translator's `onError`, so under the middleware it lands on the request log.

### Types

#### `Messages`, `Translate`, `TranslateParts`, `MessageKey`

```typescript
interface Messages {
	[key: string]: string | Messages;
}

type Translate<R = Messages> = (key: MessageKey<R>, values?: Record<string, unknown>) => string;
type TranslateParts<R = Messages> = (
	key: MessageKey<R>,
	values?: Record<string, unknown>,
) => MessagePart[];
```

`MessageKey<R>` is the union of dotted paths to `R`'s string leaves, so with typed bundles a typo such as `t("feeds.unraed")` is a type error. `createI18n` types its keys by the bundle at `resources[fallbackLanguage]` when the fallback is a literal; other languages may hold any subset of those keys. Resources typed as `Record<string, Messages>`, or a fallback typed as `string`, give an untyped translator. `IntlProvider`, `setIntl` and `Trans` take `I18n<any>`, so a typed translator passes there; a function of your own that takes any translator does the same. Variables are not typed; a locale test that parses every message is the way to catch a missing one.

#### `TFunction`

Deprecated alias of `Translate<Messages>`, kept for one release so call sites typing a `t` parameter migrate on their own schedule.

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

- `supportedLanguages` / `fallbackLanguage`: The languages detection may return, and the one returned when nothing matches; the middleware also resolves missing keys through `fallbackLanguage`
- `cookie`: `Cookie` (from `remix/cookie`) storing the preferred language as its plain value
- `sessionCookie` + `sessionStorage`: Pair used to load the session outside middleware; unnecessary when a live `Session` is passed to `detect`
- `order`: Which methods run and in what order; defaults to `searchParams`, `cookie`, `session`, `header`, with `custom` prepended when `findLocale` is set
- `findLocale`: Custom lookup for the `custom` method, such as a locale in the URL pathname; returning `null` defers to later methods

#### `DetectionMethod`

```typescript
type DetectionMethod = "searchParams" | "cookie" | "session" | "header" | "custom";
```

#### `I18nMiddlewareOptions`, `I18nOptions`, and `TranslatorOptions`

The option objects taken by the middleware, `createI18n`, and `createTranslator`, field by field above.

#### `Translation` and `Translator`

```typescript
interface Translation {
	locale: string; // the language the copy is produced in
	t: Translate;
	intl: I18n; // the translator t belongs to
}

interface Translator {
	(language?: string): Promise<Translation>;
}
```

## Pattern: Reusing the session from the session middleware

Order the i18n middleware after `remix/middleware/session` so the detector reads the language from the live request session: it needs no `sessionCookie`/`sessionStorage` configuration and performs no second storage read. Ordered before the session middleware, the `session` detection method is skipped instead.

```typescript
import i18n from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

import en from "./locales/en.js";
import es from "./locales/es.js";

let sessionCookie = createCookie("__session", { secrets: ["s3cr3t"] });
let sessionStorage = createCookieSessionStorage();

let router = createRouter({
	middleware: [
		session(sessionCookie, sessionStorage),
		i18n({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en" },
			resources: { en, es },
		}),
	],
});
```

## Pattern: Letting the user pick a language

Store the choice in a dedicated cookie and hand that cookie to the detector. The `searchParams` method still runs first, so a `?lng=` link overrides the stored choice for one request.

```typescript
import i18n from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/router";

import en from "./locales/en.js";
import es from "./locales/es.js";

let localeCookie = createCookie("lng", { maxAge: 60 * 60 * 24 * 365 });

let router = createRouter({
	middleware: [
		i18n({
			detection: {
				supportedLanguages: ["en", "es"],
				fallbackLanguage: "en",
				cookie: localeCookie,
			},
			resources: { en, es },
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
