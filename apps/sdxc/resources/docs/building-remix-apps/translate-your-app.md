---
title: Translate your app
description: Detect each request's language, translate MessageFormat 2 messages in handlers, views, jobs and islands, and catch broken copy in a test.
section:
    title: Building Remix apps
    order: 3
order: 4
lastUpdated: 2026-09-29
---

This guide makes an app answer in the visitor's language. [`@sdxc/i18n`](/api/i18n) detects
the language per request and publishes a translator on the context, and the messages it
translates are [Unicode MessageFormat 2](https://messageformat.unicode.org), formatted by
[`@sdxc/messageformat`](/api/messageformat). The same bundles serve a handler, a component
deep in the tree, a background job with no request behind it, and a hydrated island.

```bash
npm add remix @sdxc/i18n @sdxc/messageformat @sdxc/result
```

## Write the messages

A bundle is a plain object per language, nested by key segment, with MessageFormat 2 strings
as leaves. JSON is a convenient home for them, since translators can edit it without touching
code.

```json {% title="app/locales/en.json" %}
{
	"projects": {
		"title": "Projects",
		"greeting": "Welcome back, {$name}",
		"count": ".input {$count :number}\n.match $count\n0 {{No projects yet}}\none {{{$count} project}}\n* {{{$count} projects}}",
		"invite": "Read {#docs}the guide{/docs} before inviting your team."
	}
}
```

- `{$name}` interpolates a value. It is inserted raw, and JSX escapes it when it renders.
- A plural is one key: `.input` declares `$count` as a number, `.match` picks a variant by
  the language's plural category, an exact key such as `0` beats a category, and `*` catches
  the rest. Spanish and Polish get their own categories from the same syntax.
- `{#docs}…{/docs}` is markup, which a component turns into an element.

State the languages once, in a module the middleware and everything outside a request share:

```typescript {% title="app/lib/i18n.ts" %}
import type { Messages } from "@sdxc/i18n";

import en from "~/app/locales/en.json";
import es from "~/app/locales/es.json";

export const SUPPORTED_LANGUAGES = ["en", "es"];

export const FALLBACK_LANGUAGE = "en";

export const RESOURCES: Record<string, Messages> = { en, es };
```

Keep one resources object for the whole app. Compiled messages are cached per resources
object, language and key, so every request shares the work of compiling a message once.

## Detect the language per request

The `i18n` middleware detects the request's language and publishes `ctx.locale` and
`ctx.intl`. The `logger` is the one from
[Wire the router](/docs/building-remix-apps/wire-the-router). Put `i18n` after `log()`, because a message that fails to format is recorded as an
`i18n.error` warning on the request's log rather than thrown.

```typescript {% title="bootstrap/app.tsx" %}
import type { Middleware } from "remix/router";

import i18n from "@sdxc/i18n/middleware";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/lib/i18n";

import { logger } from "./logger";

export default function application() {
	let middleware: Middleware[] = [
		log(logger) as Middleware,
		i18n({
			detection: {
				supportedLanguages: SUPPORTED_LANGUAGES,
				fallbackLanguage: FALLBACK_LANGUAGE,
			},
			resources: RESOURCES,
		}) as Middleware,
		// …the rest of your chain
	];

	return createRouter({ middleware });
}
```

Detection tries a `?lng=` search parameter, a cookie, the session and the `Accept-Language`
header, in that order, and always resolves to a supported language: `es-AR` matches a
supported `es`, and anything unmatched gets the fallback. A key missing from the detected
language falls back through the primary subtag and then the fallback language, and a key
missing everywhere renders as the key itself, which makes it easy to spot on the page.

## Translate in a handler

A handler calls `ctx.intl.t` with a key and its values, and passes `ctx.locale` to the
document so `<html lang>` states the language the page is written in. `Project` is your model,
read through the `ctx.db` your database middleware publishes, and `DocumentLayout` is your
layout, taking the title and the language.

```tsx {% title="app/http/controllers/projects.tsx" %}
import { Heading, Text } from "@sdxc/ui";
import { createAction } from "remix/router";

import Project from "~/app/data/project";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.projects.index, async (ctx) => {
	let projects = await Project.list(ctx.db);

	return ctx.render(
		<DocumentLayout title={ctx.intl.t("projects.title")} locale={ctx.locale}>
			<Heading>{ctx.intl.t("projects.title")}</Heading>
			<Text>{ctx.intl.t("projects.count", { count: projects.length })}</Text>
		</DocumentLayout>,
	);
});
```

## Messages with markup

A message containing markup renders through `Trans`. Each `{#name}…{/name}` pair becomes the
element you pass under that name, with the text between them as its children, so a
translator can move the link anywhere in the sentence.

```tsx {% title="app/http/controllers/welcome.tsx" %}
import { Trans } from "@sdxc/i18n/ui";
import { createAction } from "remix/router";

import routes from "~/routes/web";

export default createAction(routes.welcome, (ctx) =>
	ctx.render(
		<p>
			<Trans
				intl={ctx.intl}
				i18nKey="projects.invite"
				components={{ docs: <a href={routes.docs.href()} /> }}
			/>
		</p>,
	),
);
```

The prop is `i18nKey` because `key` is `remix/ui`'s own reconciliation prop and never reaches
the component.

## Reach the translator from any component

Passing `ctx.intl` down through every prop gets old quickly. `IntlProvider` publishes it
through context, and `intl(handle)` reads it back wherever the component sits.

```tsx {% title="resources/components/empty-projects.tsx" %}
import type { Handle } from "remix/ui";

import { intl } from "@sdxc/i18n/ui";

export function EmptyProjects(handle: Handle) {
	return () => <p>{intl(handle).t("projects.count", { count: 0 })}</p>;
}
```

Wrap the page once, in the handler, and every component under it reads the same translator.
`ProjectsPage` is your view, with `EmptyProjects` somewhere inside it:

```tsx {% title="app/http/controllers/projects.tsx" %}
import { IntlProvider } from "@sdxc/i18n/ui";
import { createAction } from "remix/router";

import Project from "~/app/data/project";
import ProjectsPage from "~/resources/views/projects";
import routes from "~/routes/web";

export default createAction(routes.projects.index, async (ctx) => {
	let projects = await Project.list(ctx.db);

	return ctx.render(
		<IntlProvider intl={ctx.intl}>
			<ProjectsPage projects={projects} />
		</IntlProvider>,
	);
});
```

## Let the visitor choose

Detection reads a cookie when you give it one, so a language picker is a form that writes it.
Hand the detector the `remix/cookie` cookie your picker writes, exported here from your own
`app/http/cookies.ts`:

```typescript {% title="bootstrap/app.tsx" %}
import type { Middleware } from "remix/router";

import i18n from "@sdxc/i18n/middleware";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import { LOCALE_COOKIE } from "~/app/http/cookies";
import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/lib/i18n";

import { logger } from "./logger";

export default function application() {
	let middleware: Middleware[] = [
		log(logger) as Middleware,
		i18n({
			detection: {
				supportedLanguages: SUPPORTED_LANGUAGES,
				fallbackLanguage: FALLBACK_LANGUAGE,
				cookie: LOCALE_COOKIE,
			},
			resources: RESOURCES,
		}) as Middleware,
		// …the rest of your chain
	];

	return createRouter({ middleware });
}
```

The picker's action validates the submitted language against `SUPPORTED_LANGUAGES` and
answers with a redirect that sets the cookie; creating and serializing it is covered in
Remix's
[cookie documentation](https://github.com/remix-run/remix/tree/main/packages/cookie). The
search parameter still runs first, so a `?lng=es` link overrides the stored choice for one
request.

## Translate outside a request

A background job that sends an email has no `ctx.intl`. `createTranslator` builds one over the
same bundles, and binding it to a language is synchronous, so the job calls a plain function
like this one with the language stored in its input.

```typescript {% title="app/jobs/welcome-email.ts" %}
import { createTranslator } from "@sdxc/i18n";

import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/lib/i18n";

const translate = createTranslator({
	resources: RESOURCES,
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: FALLBACK_LANGUAGE,
});

export function welcomeEmail(input: { locale: string; name: string }) {
	let { locale, t } = translate(input.locale);
	return { locale, subject: t("emails.welcome.subject", { name: input.name }) };
}
```

A language you do not ship resolves to the fallback, so record the `locale` it returns, not
the one you asked for. Store the request's `ctx.locale` in the job's input when you enqueue
it, and the email arrives in the language the visitor was reading.

A hydrated island is the same case in the browser. Call `setIntl(intl)` from
`@sdxc/i18n/ui` once in the client bootstrap, with a translator built by `createTranslator`
for `document.documentElement.lang`, and `intl(handle)` inside the island falls back to it.

## Catch broken messages in a test

A message that fails to parse renders its key, and a placeholder that fails to format renders
as `{$name}`. Neither throws, which keeps a page up, and also means a typo in a translation
ships silently. `parse` from `@sdxc/messageformat` returns a `Result`, so a test can check
every message in every bundle.

```typescript {% title="app/locales/locales.test.ts" %}
import type { Messages } from "@sdxc/i18n";

import { parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";
import { expect, test } from "vitest";

import { RESOURCES } from "~/app/lib/i18n";

function* leaves(messages: Messages, prefix = ""): Generator<[string, string]> {
	for (let [key, value] of Object.entries(messages)) {
		let path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") yield [path, value];
		else yield* leaves(value, path);
	}
}

test.each(Object.entries(RESOURCES))(
	"every %s message parses",
	(_language, bundle) => {
		let broken = [...leaves(bundle)].filter(([, source]) =>
			isFailure(parse(source)),
		);
		expect(broken).toEqual([]);
	},
);
```

For formatting a single message outside a bundle, `new MessageFormat(locale, source)` from
the same package compiles it once and formats it with `format(values)` as often as you need.

## Where to go next

- [Build the interface with remix/ui](/docs/building-remix-apps/interface-with-remix-ui) —
  the components the translated copy renders into.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — enqueuing the
  job that carries `ctx.locale`.
- [Send email](/docs/data-and-background-work/send-email) — translated email from that job.
- [`@sdxc/messageformat`](/api/messageformat) — custom functions and `formatToParts`.
