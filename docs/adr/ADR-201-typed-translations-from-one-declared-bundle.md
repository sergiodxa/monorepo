# ADR-201: Typed Translations From One Declared Bundle

## Status

**Implemented** - 2026-11-19

## Background

`@sdxc/i18n` could type a translator's keys and values once a bundle was declared `as const`,
but only `createI18n` saw the bundle. Every translator an app actually calls (`ctx.intl` from
the router middleware, `createTranslator` for jobs and emails, `intl(handle)` and `Trans` in
components) was built over `Readonly<Record<string, Messages>>`, and every app's catalog widened
its texts to `string`, so a misspelled key or a stale value compiled and rendered a raw key or a
`{$name}` placeholder.

## Context

- The middleware augments `remix/router`'s `RequestContext` once, for every app that imports it,
  so `ctx.intl` cannot be generic over a bundle the middleware never sees as a type.
- `@sdxc/mail` already solved the same problem for templates with `MailTypes`, an empty
  interface an app augments.
- Non-fallback languages must hold the fallback's keys, but their texts are their own; typing
  them as the English literals would reject every translation.
- Some apps build keys from runtime prefixes (`withPrefix(t, "page.alerts.form")`) or from a
  slug, which a key union cannot check without a type for subtrees.
- The kit's app layout ranks `resources/` outside `app/initializers/`, so an initializer
  importing a TypeScript bundle reads as an outward dependency, where a JSON import never did.

## Decision

1. `@sdxc/i18n` exports `I18nTypes`, an empty interface an app augments with
   `messages: typeof en`, and `AppMessages`, which reads it back or falls back to `Messages`.
   `I18n`, `Translate` and `TranslateParts` default to `AppMessages`, so `ctx.intl`,
   `createTranslator`, `intl(handle)` and the CLI middleware are typed with no extra argument;
   an app that declares nothing keeps untyped translators.
2. `Trans` is generic over its `i18nKey`, so its `values` prop is required and typed exactly as
   `t()`'s second argument is. `IntlProvider`, `setIntl` and `Trans`'s `intl` prop keep accepting
   `I18n<any>`, since publishing a translator needs no knowledge of its bundle.
3. The fallback bundle is a TypeScript module declared `as const` (`as const satisfies …` where a
   block is also checked against another type). Every other language is
   `satisfies LocaleMessages<typeof en>`: the fallback's keys, no others, each any string.
4. `MessageAt<R, P>` and `MessagePrefix<R>` name subtrees, so a scoped translator types its keys
   as `MessageKey<MessageAt<AppMessages, P>>`. A union of prefixes keeps only the shared keys.
5. `@sdxc/mail` keeps `MailTypes`. It stays independent of `@sdxc/i18n` (any translator
   function may back a mailer), and an app's existing
   `MailTypes { translate: ReturnType<typeof translate>["t"] }` derives from `createTranslator`,
   which now reads `I18nTypes`, so the bundle is still declared once.
6. The kit's dependency rule treats `resources/locales/` as data every layer reads, as it does
   declaration modules, and `sdxc scaffold` adds copy to TypeScript bundles as well as JSON ones.

## Consequences

### Positive

- A missing key, a misspelled one, a missing value or a value the message no longer reads fails
  the type check in every app; adopting it found stale values, a message that did not exist, and
  185 untranslated messages across five of Uptime's languages.
- Non-fallback bundles cannot drift: a key English gains is a compile error until translated.

### Negative

- Type-checking cost grows with the catalog: Uptime's ~3,300 messages raise instantiations from
  2.76M to 3.57M, with check time unchanged at about 11s.
- Keys built from runtime strings need a guard or a typed table, since a `string` key no longer
  type-checks against a declared bundle.

### Neutral

- JSON catalogs become TypeScript modules; the doctor's `translations` check already reads both.
