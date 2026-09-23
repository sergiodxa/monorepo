# ADR-078: `@sdxc/i18n` on MessageFormat 2, Without i18next

## Status

**Accepted** - 2026-09-23

## Background

`@sdxc/i18n` wraps [i18next](https://www.i18next.com) in three places: the router middleware
builds one i18next instance per request, `createTranslator` builds and caches one per language
for work with no request behind it, and the `remix/ui` layer (`IntlProvider`, `intl`, `Trans`)
passes a live instance down the render tree. The package's own value — language detection,
per-request isolation, bundle narrowing, `Trans` for markup — already lives in this repo; i18next
is the lookup and interpolation engine underneath.

What the apps ask of that engine is small. Every consumer (`uptime`, `reader`, `r3-auth`,
`auth-saas`) ships its locales as TypeScript modules under one `translation` namespace, disables
interpolation escaping because JSX escapes text nodes, and calls `t(key, values)`. Measured across
`apps/*/app/locales` and every call site on 2026-09-23:

| i18next feature                          | Used                                                |
| ---------------------------------------- | --------------------------------------------------- |
| Dotted nested keys                       | everywhere                                          |
| `{{name}}` interpolation                 | ~2,000 placeholders                                 |
| `count` plurals (`_one` / `_other`)      | 176 `_one`, 196 `_other`                            |
| Fallback language for a missing key      | yes, through `fallbackLng`                          |
| `interpolation.escapeValue: false`       | every instance in every app                         |
| Namespaces other than `translation`      | none                                                |
| Backend / post-processor plugins         | none                                                |
| Nesting (`$t(...)`), formatters, context | none                                                |
| `returnObjects`, `defaultValue`          | none                                                |
| `changeLanguage`, `loaded` events        | none (the `IntlProvider` subscribes, nothing emits) |
| Instance members outside `t`             | `language` once, `cloneInstance` once (a test)      |

For that surface the dependency costs more than it returns:

- **Per-request cost.** The middleware runs `createInstance()` plus an async `init()` on every
  request, in a Worker, to answer lookups on two static objects.
- **Bundle weight.** i18next ships to the client for every hydrated island in `uptime` and
  `reader`, to power `t()` and an event emitter nobody fires.
- **Types.** `TFunction` is i18next's type, re-exported to 119 call sites. Its overloads are
  loose over our untyped resources (any string is a key) and heavy to check.
- **API drift.** The package's options expose `InitOptions` and `Module` wholesale, so consumers can
  reach i18next features the package does not test and the apps do not use.
- **A second parser.** `Trans` pulls `html-parse-stringify` to tokenize `<tag>` markers, which
  treats `link`, `br`, `img`, `hr` as void elements. The README carries a warning about it and one
  locale already uses `<link>`.

## Context

### Current state

| Module                                                  | Depends on i18next for                                        |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| `src/index.ts`                                          | re-exporting `i18n` and `TFunction` types                     |
| `src/middleware.ts`                                     | `createInstance`, `init`, `InitOptions`, `Module`, `Resource` |
| `src/lib/translator.ts`                                 | `createInstance`, `init`, `getFixedT`                         |
| `src/ui/intl-provider.tsx`                              | the `i18n` type, `on`/`off` for `languageChanged` / `loaded`  |
| `src/ui/trans.tsx`                                      | `i18n.t`, `TOptions`                                          |
| `src/lib/language-detector.ts`, `get-client-locales.ts` | nothing                                                       |

### What a replacement has to preserve

| Behavior                                                                   | Where it is relied on                                          |
| -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Lookup order: locale → its primary subtag → fallback → fallback's subtag   | `en-US` requests resolving through `en`                        |
| Missing key everywhere returns the key itself                              | tests and the "missing key renders as the key" debugging habit |
| A `count` picks the sentence form by CLDR plural category                  | 372 plural keys, including `ja` (only `other`)                 |
| The count itself is interpolated like any other value                      | nearly every plural string                                     |
| Values interpolate raw; escaping is the renderer's job                     | every app sets `escapeValue: false` today                      |
| One translator per request, fixed to one language, no shared mutable state | concurrent requests in one isolate                             |

### Choosing a message format

Dropping i18next is also the moment to stop writing messages in its private convention
(`{{name}}` placeholders, plurals split across `_one`/`_other` keys, markup as ad-hoc HTML tags).

| Format                        | Standing                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| i18next JSON v4               | one library's convention; plural variants live in separate keys a translator must keep in step                 |
| ICU MessageFormat (MF1)       | the de facto standard of translation platforms; frozen, and its successor is MF2                               |
| Unicode MessageFormat 2 (MF2) | CLDR's successor to MF1, syntax and data model declared stable in 2025 (LDML 47); markup is part of the syntax |
| `Intl.MessageFormat` (TC39)   | the proposed native JS API, formatting MF2 source; not shipped in any browser or in workerd yet                |

MF2 is the format the platform is converging on, and the only one whose native runtime API is
being designed. Writing MF1 now would mean converting every message a second time the day
`Intl.MessageFormat` ships.

## Decision

1. Write every message in **Unicode MessageFormat 2**.
2. Add **`@sdxc/messageformat`**, a ponyfill of the proposed `Intl.MessageFormat`: an owned MF2
   parser and formatter exposing the proposal's API, exported as a module and never installed on
   `globalThis`.
3. Rebuild **`@sdxc/i18n`** on it and remove the `i18next` and `html-parse-stringify` dependencies.
4. Land **breaking changes together with the app updates**: every app is updated in the same
   change, and npm releases are date-versioned with no compatibility promise, so no deprecated
   alias or transitional signature is kept.

### Messages in MF2

Locale files stay TypeScript modules with nested objects; only the leaf strings change.

| Today (i18next)                                                      | MF2                                                                                                |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `"Hello {{name}}"`                                                   | `"Hello {$name}"`                                                                                  |
| `unread_one: "{{count}} unread"`, `unread_other: "{{count}} unread"` | `unread: ".input {$count :number}\n.match $count\none {{{$count} unread}}\n* {{{$count} unread}}"` |
| `"Read <articleLink>{{title}}</articleLink>"`                        | `"Read {#articleLink}{$title}{/articleLink}"`                                                      |

Plural variants collapse into one key, so a translator sees every form of a sentence together, and
languages with more categories (`few`, `many`) add variants without adding keys. Markup is MF2
syntax, so any name wraps children, including `link` and `br`.

### `@sdxc/messageformat`: the ponyfill

A new public package, because MF2 is a format capability of its own with uses outside
`@sdxc/i18n`.

```typescript
import { MessageFormat } from "@sdxc/messageformat";

let mf = new MessageFormat("en", "{#b}{$count :number}{/b} new posts");
mf.format({ count: 1200 }); // "1,200 new posts"
mf.formatToParts({ count: 1200 }); // [{ type: "markup", kind: "open", name: "b" }, { type: "number", ... }, ...]
```

- **Surface.** `new MessageFormat(locales, source, options?)`, `format(values?, onError?)`,
  `formatToParts(values?, onError?)`, tracking the TC39 proposal's shape and part types. Nothing
  beyond the proposal is public, so switching to the native class is an import change.
- **Parser.** A hand-written recursive-descent parser for the full MF2 grammar: simple messages,
  `.input`/`.local` declarations, `.match` with multiple selectors and `*` fallbacks, literals
  (quoted `|…|` included), options, attributes, and markup (open, close, standalone). It produces
  the MF2 data model, so a message parses once and formats many times.
- **Functions.** The default registry: `:string`, `:number`, `:integer` (formatting through
  `Intl.NumberFormat`, plural and exact-match selection through `Intl.PluralRules`). `:date`,
  `:time`, `:datetime`, `:currency`, `:unit`, and `:percent` land when a message needs them.
  Custom functions go through the `functions` option the proposal defines.
- **Errors.** MF2 defines fallback output for bad references and unknown functions (`{$name}`);
  formatting produces that fallback and reports through `onError`, so a broken translation shows a
  visible marker and never throws at render time. Syntax errors are reported by a `parse` that
  returns an `@sdxc/result` `Result`, used by the locale test described below; the constructor
  follows the proposal and throws, the one exception to the repo's no-throw rule, kept so the class
  stays a drop-in for the native one.
- **Conformance.** The Unicode MessageFormat working group publishes a JSON test suite; the package
  runs it as its spec, vendored under `test/`.
- **Retiring it.** Once `Intl.MessageFormat` ships in workerd and the browsers the apps target, and
  the native class passes the same conformance suite plus our tests, `@sdxc/messageformat` exports
  `globalThis.Intl.MessageFormat` behind a feature check, then is deprecated. Because the proposal
  is at stage 1 and may still change, existence alone is never enough to switch.

### `@sdxc/i18n` on MessageFormat

```typescript
interface I18n<Resources = Messages> {
	/** Language the copy is produced in, always a supported one. */
	readonly locale: string;
	t: Translate<Resources>;
	/** Parts for callers that render markup, such as `Trans`. */
	parts: TranslateParts<Resources>;
}

function createI18n<R extends Messages>(options: {
	locale: string;
	fallbackLanguage: string;
	resources: Record<string, R>;
}): I18n<R>;
```

- **Lookup.** `t(key, values?)` walks the chain `[locale, primary(locale), fallback,
primary(fallback)]` (deduplicated, restricted to languages in `resources`) for the first string
  leaf at the dotted `key`, and returns `key` when there is none.
- **Compilation.** Each hit becomes a `MessageFormat` for the language it was found in, compiled
  on first use and cached per language and key in a module-level `Map`. Messages are immutable, so
  concurrent requests share compiled messages safely, and nothing runs at module load, which keeps
  Worker startup inside the platform's limits.
- **Per request.** `createI18n` is synchronous and builds only a closure over the chain; the async
  `createInstance().init()` leaves the request path.
- **Escaping.** Output is plain text; JSX escapes it, as every app configures today.

### Typed keys

`resources` are TypeScript modules, so `Translate<R>` derives its key union from the fallback
language's bundle as dotted paths to string leaves. A typo in `t("feeds.unraed")` is a type error.
Typing each key's variables from its MF2 source with template-literal types is possible but costly
for the checker; it is left out, and the locale test below catches missing variables instead.
Apps can widen to `Translate<Messages>` (any string) when their bundles are large.

### Middleware, translator, and UI

- **Middleware.** `@sdxc/i18n/middleware` keeps its detection options, replaces `i18next`/`plugins`
  with `resources`, and publishes `context.intl: I18n` next to `context.locale`. `context.i18next`
  and bundle narrowing (`pickResources`) are removed.
- **`createTranslator`.** Keeps its name and returns `Translation { locale, t, intl }`; the `i18n`
  field becomes `intl`. It returns the `Translation` synchronously, since nothing inside awaits.
- **`IntlProvider`** takes `intl: I18n` and only publishes it; the i18next event subscription goes
  away because an `I18n` is immutable. A client language switch renders a provider with a new one.
  `intl(handle)` and `setIntl(intl)` keep their names and the browser-only guard.
- **`Trans`** calls `intl.parts(i18nKey, values)` and folds markup open/close parts into the
  matching `components` element, children included; standalone markup renders the element with no
  children. An unmatched name renders its children unwrapped and logs through `currentLog()`.
  The `parse-trans.ts` tag walker and its ambient `.d.ts` are deleted.

### Exported types

`I18n`, `Translate`, `TranslateParts`, and `Messages` replace the re-exported `i18n` and
`TFunction`; call sites that type a `t` parameter use `Translate`, typed by a bundle or untyped.

### Converting the locale files

A one-off codemod under `scripts/` rewrites each app's locale modules: `{{name}}` → `{$name}`,
each `key_<category>` group → one `.match` message with `*` taking the `other` form, and HTML-style
tags used by `Trans` → MF2 markup. Each app gains a `locales.test.ts` (reader already has one) that
parses every message in every language, and checks each language uses the same variable names as
the fallback, so a translation that drops `{$count}` fails CI.

## Consequences

### Positive

- Messages are in the standard format translation platforms and future native APIs understand.
- No async instance construction per request, and compiled messages are shared across requests.
- Client bundles drop i18next and `html-parse-stringify`; the ponyfill is the only formatter and
  disappears once the platform provides one.
- Plural forms of a sentence live together, and markup has no reserved names.
- Translation keys are type-checked; every message is syntax- and variable-checked in CI.

### Negative

- A full MF2 parser and conformance suite is the bulk of the work, more than an i18next-style
  lookup would be.
- The proposal can change before it ships; the ponyfill follows it, and a change in shape is a
  change in `@sdxc/messageformat` consumers too.
- Every locale string in four apps and six languages is rewritten, and MF2's plural syntax is
  longer to read in source than the `_one`/`_other` pair.
- Breaking changes in every app: `ctx.i18next` → `ctx.intl`, `IntlProvider i18n=` → `intl=`,
  `createTranslator(...).i18n` → `.intl`.

### Neutral

- `LanguageDetector` and `getClientLocales` are untouched.
- Plural selection still comes from `Intl.PluralRules`, the same source i18next uses, so each
  language picks the same form it does today.

## Implementation Plan

### Phase 1: `@sdxc/messageformat`

- [x] Vendor the Unicode MessageFormat conformance tests and wire them as the package spec
- [x] Parser to the MF2 data model, with `parse` returning a `Result`
- [x] Formatter with `format`/`formatToParts`, `:string`/`:number`/`:integer`, fallback and `onError`
- [x] README, JSDoc, and entry in the root README package table

### Phase 2: `@sdxc/i18n`

- [x] Tests first for the "preserve" table: chain order with regional locales, missing-key echo,
      plural selection for `en`, `es`, `ja`, `fr` (`0` is `one` in French), raw interpolation
- [x] `createI18n`, the compiled-message cache, `Translate<R>` with type tests
- [x] Rewrite `middleware.ts`, `translator.ts`, `intl-provider.tsx`, `trans.tsx` on `I18n` and parts
- [x] Drop `i18next` and `html-parse-stringify`; update the README

### Phase 3: Adopt, one commit per app

- [x] Codemod each app's locales and add its `locales.test.ts`
- [x] `r3-auth`: middleware, emails' `createTranslator`, `ctx.i18next` → `ctx.intl`
- [x] `reader`: middleware, `push/copy.tsx`, controllers, `bootstrap/browser.ts`
- [x] `uptime`: middleware, emails, jobs, `bootstrap/browser.ts`, `app-shell.test.tsx`
      (`cloneInstance({ lng })` → `createI18n({ locale, ... })`)
- [x] `auth-saas`: middleware, mail
- [ ] Build and deploy each deployed app

### Phase 4: Native `Intl.MessageFormat` (when it ships)

- [ ] Run the conformance suite and package tests against the native class in workerd and browsers
- [ ] Export the native class behind a feature check, keeping the ponyfill as fallback
- [ ] Deprecate `@sdxc/messageformat` once every target runtime passes natively

## Alternatives Considered

### 1. Keep i18next, cache instances across requests

One instance per language at module scope and `getFixedT(locale)` per request removes the
per-request `init()`, but keeps the client weight, the loose `TFunction`, the option surface, and
the private message convention.

### 2. Own lookup over the i18next message convention

The smallest change: a ~150-line `t` that reads `{{name}}` and `_one`/`_other` as they are, with
no content migration. It keeps a single library's convention with no standard behind it and no
path to a native API.

### 3. ICU MessageFormat (MF1)

Supported by every translation platform today, but superseded by MF2 and not the syntax
`Intl.MessageFormat` formats, so it means a second migration later.

### 4. Use the `messageformat` npm package (v4) as the ponyfill

It is the reference MF2 implementation and tracks the proposal closely. Owning the parser keeps
the formatter within the repo's conventions (`Result` for parsing, `currentLog()`, no module-scope
work) and sized to what the apps ship; `messageformat` remains the reference the conformance suite
and our output are compared against.

## References

- [Unicode MessageFormat 2 specification](https://github.com/unicode-org/message-format-wg)
- [TC39 `Intl.MessageFormat` proposal](https://github.com/tc39/proposal-intl-messageformat)
- [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)
- [CLDR plural rules](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
- `packages/i18n/README.md`

## Current Progress

Phases 1–3 done on 2026-09-23: `@sdxc/messageformat` passes the conformance suite, `@sdxc/i18n`
runs on it, and `r3-auth`, `reader`, `uptime`, and `auth-saas` translate through it. Pending: the
npm bootstrap of `@sdxc/messageformat` and its trusted publisher, and the app deploys.

### Deviations from the plan

Phase 2 settled these details differently from the sketch above:

- Resources have no `translation` namespace: a bundle is the language's messages directly.
- `createI18n<Resources, Fallback>` returns `I18n<Resources[Fallback]>`, typing keys by the
  fallback language's bundle when the fallback is a literal.
- `I18n` carries an `onError` field, so `Trans` and other consumers report through the same handler.
- `IntlProvider`, `setIntl`, and `Trans` take `I18n<any>`, so a translator typed by any bundle
  passes.
- `@sdxc/messageformat` reports nothing without an `onError`; the `@sdxc/i18n` middleware supplies one that logs.
- Messages format with `bidiIsolation: "none"`, so output carries no isolation characters.
- Unannotated numeric values format with `:number`, so copy shows the locale's digit grouping.
