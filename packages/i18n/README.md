# @sdxc/i18n

Language detection and [Unicode MessageFormat 2](https://messageformat.unicode.org) translators for Remix routers and `remix/component`.

## Installation

```sh
npm add @sdxc/i18n
```

Requires [`remix`](https://www.npmjs.com/package/remix) v3. Messages format through [`@sdxc/messageformat`](https://www.npmjs.com/package/@sdxc/messageformat), and the middleware logs through [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger).

The package has three entry points:

- `@sdxc/i18n`: translators, the language detector and `getClientLocales`; runs in the browser too.
- `@sdxc/i18n/middleware`: the `i18n` middleware for `remix/router`.
- `@sdxc/i18n/middleware/cli`: the `i18n` middleware for an [`@sdxc/cli`](https://www.npmjs.com/package/@sdxc/cli) command line, which installs alongside.
- `@sdxc/i18n/ui`: `IntlProvider`, `intl`, `setIntl` and `Trans` for `remix/component`.

## Usage

### Write a bundle per language

A bundle is a plain object nested by dotted key segment, with MessageFormat 2 strings as leaves.

```typescript
export default {
	greeting: "Hello {$name}",
	inbox: {
		unread:
			".input {$count :number}\n.match $count\none {{{$count} message}}\n* {{{$count} messages}}",
		article: "Read {#link}{$title}{/link}",
	},
};
```

Variables are `{$name}` and interpolate unescaped. Plurals `.match` a `:number` input on the language's CLDR categories (`one`, `few`, `other`, …) or exact numbers, with `*` catching the rest. Markup is `{#name}…{/name}` or `{#name/}`, rendered by `Trans`.

### Translate

```typescript
import { createI18n } from "@sdxc/i18n";

import en from "./locales/en.js";
import es from "./locales/es.js";

let intl = createI18n({ locale: "es-MX", fallbackLanguage: "en", resources: { en, es } });

intl.t("greeting", { name: "Ada" }); // "Hola Ada", read from es
intl.t("inbox.unread", { count: 3 }); // from en when es lacks the key
intl.t("inbox.missing"); // "inbox.missing"
```

A key resolves through each truncation of the locale, then of the fallback language, so `es-MX` reads `es-MX`, then `es`, then `en`, and `zh-Hant-TW` reads `zh-Hant` before `zh`. A key found nowhere returns itself.

### Translate per request

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
	return new Response(context.intl.t("greeting", { name: "Ada" }), {
		headers: { "Content-Language": context.locale },
	});
});
```

The middleware detects the language from `?lng=`, a cookie, the session and `Accept-Language`, then publishes `context.locale` and `context.intl`.

### Render with `remix/component`

```tsx
import type { Handle } from "remix/component";

import { intl, IntlProvider, Trans } from "@sdxc/i18n/ui";

router.get("/", (context) =>
	context.render(
		<IntlProvider intl={context.intl}>
			<Teaser title="Hello MF2" href="/posts/mf2" />
		</IntlProvider>,
	),
);

function Teaser(handle: Handle<{ title: string; href: string }>) {
	return () => (
		<article>
			<h2>{intl(handle).t("greeting", { name: "Ada" })}</h2>
			<Trans
				i18nKey="inbox.article"
				values={{ title: handle.props.title }}
				components={{ link: <a href={handle.props.href} /> }}
			/>
		</article>
	);
}
```

### Translate without a request

```typescript
import { createTranslator } from "@sdxc/i18n";

let translate = createTranslator({
	resources: { en, es },
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
});

let { locale, t } = translate(user.language); // locale is "en" when user.language is unsupported
```

## API

### `createI18n(options: I18nOptions): I18n`

From `@sdxc/i18n`. A translator fixed to `options.locale`, built synchronously; messages compile on first use and are cached per `resources` object, so keep one bundle object per app.

- `options.locale`: The language to translate into
- `options.fallbackLanguage`: The language whose bundle answers keys the locale lacks, and types the keys
- `options.resources`: Bundles keyed by language
- `options.onError`: `(error, key) => void`, receiving syntax and formatting errors; errors are discarded without it

A placeholder that fails to format renders its fallback, such as `{$name}`, and a message that fails to compile renders its key.

### `createTranslator(options: TranslatorOptions): Translator`

From `@sdxc/i18n`. A factory for code with no request behind it. Calling it with a language returns a cached `Translation` (`{ locale, t, intl }`); a regional language binds to its supported truncation (`es-UY` to `es`), and an unsupported or missing one to `fallbackLanguage`, so record `translation.locale`.

- `options.resources`, `options.fallbackLanguage`, `options.onError`: As in `createI18n`
- `options.supportedLanguages`: The languages a translation may bind to

### `LanguageDetector`

From `@sdxc/i18n`. `new LanguageDetector(options: LanguageDetectorOptions)` creates a detector; `detector.detect(request: Request, session?: Session): Promise<string>` runs each method in order and returns the first supported match, or the fallback language. A candidate is matched with RFC 4647 Lookup, each `Accept-Language` range in priority order trying its truncations (`es-AR`, then `es`) before the next; `q=0` ranges never match. When no range matches, a candidate matches by primary subtag, so `en-US` finds `en-GB`. A method missing its option, such as `cookie`, is skipped, and a live `Session` passed to `detect` is read directly.

### `getClientLocales(requestOrHeaders: Request | Headers): string | undefined`

From `@sdxc/i18n`. The highest-quality `Accept-Language` tag that `Intl` can represent, or `undefined`. It keeps the client's exact region (`en-GB`) for `Intl` formatting even when the app ships only `en` copy.

### `i18n(options: I18nMiddlewareOptions): Middleware`

Default export of `@sdxc/i18n/middleware`. Sets `context.locale` and `context.intl` per request, and logs message errors as `i18n.error` warnings on the request's `@sdxc/logger` log. Importing it adds `locale: string` and `intl: I18n` to `RequestContext` from `remix/router`.

- `options.detection`: A `LanguageDetectorOptions`; its `fallbackLanguage` also answers missing keys
- `options.resources`: Bundles keyed by language

Both middleware entries publish under the same context keys, `CurrentLocale` and `CurrentIntl`, exported from each, so code reading `ctx.get(CurrentIntl)` works in a route or a command.

### `i18n(options: TranslatorOptions): CommandMiddleware`

Default export of `@sdxc/i18n/middleware/cli`, taking the same options as `createTranslator`. It installs three properties on an `@sdxc/cli` command's context:

- `ctx.translate`: the `createTranslator` factory (key `Translators`), for text the command writes to someone else: `ctx.translate(user.language)` answers a `Translation` whose `locale` is the language it bound to
- `ctx.locale` and `ctx.intl`: the command's own output in the language of whoever runs it, from the first of `LC_ALL`, `LC_MESSAGES` and `LANG` that is set (`es_AR.UTF-8` matches `es-AR`, then `es`); `C`, `POSIX`, an unsupported language or no variable binds `fallbackLanguage`

Message errors become `i18n.error` warnings on the run's `@sdxc/logger` log unless `options.onError` is given.

### `IntlProvider`

From `@sdxc/i18n/ui`. Publishes its `intl` prop to every descendant and renders `children`; render it with a new `I18n` to switch language.

### `intl(handle: Handle): I18n`

From `@sdxc/i18n/ui`. The `I18n` from the nearest `IntlProvider`, else the `setIntl` default; it throws when neither exists.

### `setIntl(intl: I18n): void`

From `@sdxc/i18n/ui`. Registers the default `I18n` for `intl` in the browser; call it before mounting. It throws on the server, where a module-scoped translator would serve every request.

### `Trans`

From `@sdxc/i18n/ui`. Renders a message with markup: `{#name}…{/name}` becomes `components[name]` with the enclosed content as children, and `{#name/}` the element alone.

- `i18nKey`: The message key (`key` is reserved by `remix/component`)
- `values`: The message's variables
- `components`: Elements keyed by markup name; markup without an entry renders its content unwrapped and reports through `onError`
- `intl`: The translator to use; defaults to `intl(handle)`

### Types

#### `I18n<R>`

```typescript
interface I18n<R = Messages> {
	readonly locale: string;
	t: Translate<R>; // (key, values?) => string
	parts: TranslateParts<R>; // (key, values?) => MessagePart[]
	onError: I18nErrorHandler; // (error: Error, key: string) => void
}
```

`parts` returns `@sdxc/messageformat` parts, markup included, for a renderer of your own; a missing key yields one text part holding the key.

#### `Messages` and `MessageKey<R>`

`Messages` is a bundle: `{ [key: string]: string | Messages }`. `MessageKey<R>` is the union of dotted paths to `R`'s string leaves, so with typed bundles `t("inbox.unraed")` is a type error. Keys are typed by `resources[fallbackLanguage]` when the fallback is a literal; bundles typed as `Record<string, Messages>` give string keys. `IntlProvider`, `setIntl` and `Trans` accept `I18n<any>`. Variables are untyped.

#### `LanguageDetectorOptions` and `DetectionMethod`

```typescript
type DetectionMethod = "searchParams" | "cookie" | "session" | "header" | "custom";

interface LanguageDetectorOptions {
	supportedLanguages: string[];
	fallbackLanguage: string;
	cookie?: Cookie; // holds the language as its plain value
	sessionCookie?: Cookie; // with sessionStorage, loads the session outside middleware
	sessionStorage?: SessionStorage;
	sessionKey?: string; // default "lng"
	searchParamKey?: string; // default "lng"
	order?: DetectionMethod[]; // default searchParams, cookie, session, header
	findLocale?(request: Request): Promise<string | string[] | null>; // the "custom" method
}
```

Setting `findLocale` puts `custom` first in the default order; returning `null` defers to the next method.

#### `Translate`, `TranslateParts`, `I18nErrorHandler`, `I18nOptions`, `I18nMiddlewareOptions`, `TranslatorOptions`, `Translation`, `Translator`

The function and option types used above. `I18nMiddlewareOptions` comes from `@sdxc/i18n/middleware`; the rest from `@sdxc/i18n`.

#### `CurrentLocale`, `CurrentIntl` and `Translators`

The context keys, from `@sdxc/i18n/middleware` (`CurrentLocale`, `CurrentIntl`) and `@sdxc/i18n/middleware/cli` (all three), for code that reads by key: `ctx.get(CurrentIntl)`. A command line whose middleware includes `i18n()` types `ctx.translate`, `ctx.locale` and `ctx.intl` on every handler.

## Pattern: Reading The Language From The Session

Order `i18n` after Remix's session middleware so the `session` method reads the live session, with no `sessionCookie` or `sessionStorage` needed.

```typescript
import i18n from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createCookieSessionStorage } from "remix/session-storage/cookie";

import en from "./locales/en.js";
import es from "./locales/es.js";

let sessionCookie = createCookie("__session", { secrets: ["s3cr3t"] });

let router = createRouter({
	middleware: [
		session(sessionCookie, createCookieSessionStorage()),
		i18n({
			detection: { supportedLanguages: ["en", "es"], fallbackLanguage: "en", sessionKey: "lng" },
			resources: { en, es },
		}),
	],
});
```

## Pattern: Letting The User Pick A Language

Store the choice in a cookie the detector reads. `?lng=` still runs first, so a link overrides the stored choice for one request.

```typescript
import i18n from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";
import { createRouter } from "remix/router";

import en from "./locales/en.js";
import es from "./locales/es.js";

let languageCookie = createCookie("lng", { maxAge: 60 * 60 * 24 * 365 });

let router = createRouter({
	middleware: [
		i18n({
			detection: {
				supportedLanguages: ["en", "es"],
				fallbackLanguage: "en",
				cookie: languageCookie,
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
		headers: { Location: "/", "Set-Cookie": await languageCookie.serialize(language) },
	});
});
```

## Pattern: Locale In The URL Path

`findLocale` reads `/es/dashboard`; an unsupported segment falls through to the other methods.

```typescript
import { LanguageDetector } from "@sdxc/i18n";

let detector = new LanguageDetector({
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
	async findLocale(request) {
		return new URL(request.url).pathname.split("/").at(1) ?? null;
	},
});

let locale = await detector.detect(request);
```

## Pattern: Translating In A Background Job

One translator serves every run; `onError` sends broken messages somewhere visible, and the email records the language it was actually written in.

```typescript
import { createTranslator } from "@sdxc/i18n";
import { currentLog } from "@sdxc/logger";

import en from "./locales/en.js";
import es from "./locales/es.js";

let translate = createTranslator({
	resources: { en, es },
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
	onError: (error, key) => currentLog()?.warn("i18n.error", { key, message: error.message }),
});

export async function sendDigest(user: { email: string; language: string; unread: number }) {
	let { locale, t } = translate(user.language);
	await sendEmail({
		to: user.email,
		language: locale,
		subject: t("inbox.unread", { count: user.unread }),
	});
}
```

## Pattern: Sending A Translated Email From A Command

An admin command writes its own output in the developer's language and the email in the recipient's, using the same bundles the routes use.

```typescript
import { argument, command, commands, createCLI, failure, success } from "@sdxc/cli";
import i18n from "@sdxc/i18n/middleware/cli";
import * as s from "remix/data-schema";

import en from "./locales/en.js";
import es from "./locales/es.js";

let contract = commands({
	invites: commands({ resend: command({ arguments: { email: argument(s.string()) } }) }),
});

let cli = createCLI({
	name: "app",
	commands: contract,
	middleware: [
		i18n({ resources: { en, es }, supportedLanguages: ["en", "es"], fallbackLanguage: "en" }),
	],
});

cli.map(contract.invites.resend, async (ctx) => {
	let user = await findUserByEmail(ctx.arguments.email);
	if (user === null) return failure(new Error(ctx.intl.t("cli.userNotFound")));

	let { locale, t } = ctx.translate(user.language);
	await sendEmail({ to: user.email, language: locale, subject: t("invite.subject") });

	ctx.stdout(`${ctx.intl.t("cli.inviteSent", { email: user.email })}\n`);
	return success();
});

process.exitCode = await cli.run(process.argv.slice(2));
```

With `LANG=es_AR.UTF-8` the command reports in Spanish, whatever language the email went out in.

## Pattern: Hydrating Islands In The Browser

Register one translator before hydrating, so every island's `intl(handle)` and `Trans` resolve without a provider. Read the language from the server-rendered `<html lang>`.

```typescript
import { createTranslator } from "@sdxc/i18n";
import { setIntl } from "@sdxc/i18n/ui";

import en from "./locales/en.js";
import es from "./locales/es.js";

let { intl } = createTranslator({
	resources: { en, es },
	supportedLanguages: ["en", "es"],
	fallbackLanguage: "en",
})(document.documentElement.lang);

setIntl(intl);
```

## Pattern: Formatting Dates In The Client's Region

Copy follows the detected language; dates and numbers follow the client's exact locale from `getClientLocales`.

```typescript
import { getClientLocales } from "@sdxc/i18n";

router.get("/orders/:id", (context) => {
	let region = getClientLocales(context.request) ?? context.locale; // "en-GB" for an en-only app
	let placed = new Intl.DateTimeFormat(region, { dateStyle: "long" }).format(order.placedAt);
	return new Response(context.intl.t("orders.placed", { date: placed }));
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
