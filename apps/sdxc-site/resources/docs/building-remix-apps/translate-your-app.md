---
title: Translate your app
description: Detect each request's language, translate MessageFormat 2 messages in handlers, views, jobs and islands, and catch broken copy in a test.
section:
    title: Building Remix apps
    order: 4
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "How to detect each request's language and translate MessageFormat 2 messages in handlers and views"
    - "How to reach the translator from any component, island or job"
    - "How to catch broken messages in a test"
---

This guide makes an app answer in the visitor's language. [`@sdxc/i18n`](/api/i18n) detects
the language per request and publishes a translator on the context, and the messages it
translates are [Unicode MessageFormat 2](https://messageformat.unicode.org), formatted by
[`@sdxc/messageformat`](/api/messageformat). The same bundles serve a handler, a component
deep in the tree, a background job with no request behind it, and a hydrated island.

```bash
npm add @sdxc/i18n @sdxc/logger @sdxc/messageformat @sdxc/result @sdxc/ui remix
```

## Write the messages

A bundle is a plain object per language, nested by key segment, with MessageFormat 2 strings
as leaves:

```json {% title="resources/locales/en.json" %}
{
	"projects": {
		"title": "Projects",
		"greeting": "Welcome back, {$name}",
		"count": ".input {$count :number}\n.match $count\n0 {{No projects yet}}\none {{{$count} project}}\n* {{{$count} projects}}",
		"invite": "Read {#docs}the guide{/docs} before inviting your team."
	}
}
```

`{$name}` interpolates a value, a plural `.match`es on the language's plural category with `*`
catching the rest, and `{#docs}…{/docs}` is markup a component turns into an element.

State the languages once, in a module the middleware and everything outside a request share:

```typescript {% title="app/initializers/i18n.ts" %}
import type { Messages } from "@sdxc/i18n";

import en from "~/resources/locales/en.json";
import es from "~/resources/locales/es.json";

export const SUPPORTED_LANGUAGES = ["en", "es"];

export const FALLBACK_LANGUAGE = "en";

export const RESOURCES: Record<string, Messages> = { en, es };
```

Keep one resources object for the whole app, since compiled messages are cached per object.

## Detect the language per request

The `i18n` middleware detects the request's language and publishes `ctx.locale` and
`ctx.intl`. The `logger` is the one from
[Wire the router](/docs/building-remix-apps/wire-the-router).

> [!NOTE]
> Put `i18n` after `log()`. A message that fails to format is recorded as an `i18n.error`
> warning on the request's log, so the log has to exist before the translator runs.

```typescript {% title="app/initializers/router.tsx" %}
import i18n from "@sdxc/i18n/middleware";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import {
	FALLBACK_LANGUAGE,
	RESOURCES,
	SUPPORTED_LANGUAGES,
} from "~/app/initializers/i18n";

import { logger } from "./logger";

export function createWebRouter() {
	return createRouter({
		middleware: [
			log(logger),
			i18n({
				detection: {
					supportedLanguages: SUPPORTED_LANGUAGES,
					fallbackLanguage: FALLBACK_LANGUAGE,
				},
				resources: RESOURCES,
			}),
			// …the rest of your chain
		],
	});
}
```

Detection tries a `?lng=` search parameter, a cookie, the session and the `Accept-Language`
header, in that order, and always resolves to a supported language: `es-AR` matches `es`, and
anything unmatched gets the fallback. A key missing everywhere renders as the key itself.

## Translate in a handler

A handler calls `ctx.intl.t` with a key and its values, and passes `ctx.locale` to your layout
so `<html lang>` states the page's language:

```tsx {% title="app/http/controllers/projects.tsx" %}
import { Heading, Text } from "@sdxc/ui";
import { createAction } from "remix/router";

import Project from "~/app/models/project";
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

## Render messages with markup

A message containing markup renders through `Trans`. Each `{#name}…{/name}` pair becomes the
element you pass under that name, so a translator can move the link anywhere in the sentence:

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

## Reach the translator from any component

`IntlProvider` publishes the translator through context, and `intl(handle)` reads it back
wherever the component sits:

```tsx {% title="resources/components/empty-projects.tsx" %}
import type { Handle } from "remix/component";

import { intl } from "@sdxc/i18n/ui";

export function EmptyProjects(handle: Handle) {
	return () => <p>{intl(handle).t("projects.count", { count: 0 })}</p>;
}
```

Wrap the page once, in the handler. `ProjectsPage` is your view, with `EmptyProjects` inside it:

```tsx {% title="app/http/controllers/projects.tsx" %}
import { IntlProvider } from "@sdxc/i18n/ui";
import { createAction } from "remix/router";

import Project from "~/app/models/project";
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

## Translate outside a request

A background job has no `ctx.intl`. `createTranslator` builds one over the same bundles, once,
beside the languages:

```typescript {% title="app/initializers/i18n.ts" %}
import { createTranslator } from "@sdxc/i18n";

export const translate = createTranslator({
	resources: RESOURCES,
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: FALLBACK_LANGUAGE,
});
```

A job binds it to the language stored in its input:

```typescript {% title="app/services/welcome-email.ts" %}
import { translate } from "~/app/initializers/i18n";

export function welcomeEmail(input: { locale: string; name: string }) {
	let { locale, t } = translate(input.locale);
	return { locale, subject: t("emails.welcome.subject", { name: input.name }) };
}
```

> [!NOTE]
> A language you do not ship resolves to the fallback, so record the `locale` the translator
> returns, not the one you asked for.

Store the request's `ctx.locale` in the job's input when you enqueue it. For hydrated islands,
call `setIntl(translate(document.documentElement.lang).intl)`, with `setIntl` from
`@sdxc/i18n/ui`, in `bootstrap/browser.ts` before `run()`.

## Catch broken messages in a test

A message that fails to parse renders its key instead of throwing, so a typo ships silently.
`parse` from `@sdxc/messageformat` returns a `Result`, so a test can check every message:

```typescript {% title="resources/locales/locales.test.ts" %}
import type { Messages } from "@sdxc/i18n";

import { parse } from "@sdxc/messageformat";
import { isFailure } from "@sdxc/result";
import { expect, test } from "vitest";

import { RESOURCES } from "~/app/initializers/i18n";

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

Detection is one request through the router; `migrate()` prepares the in-memory database, as
[Test Workers apps](/docs/operations-and-testing/testing#drive-the-real-router) sets up:

```typescript {% title="app/http/controllers/projects.test.tsx" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migrate } from "~/app/test/database";
import routes from "~/routes/web";

beforeAll(migrate);

test("answers in the closest language the app ships", async () => {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.projects.index.href(), "https://example.com"), {
			headers: { "Accept-Language": "es-AR,es;q=0.9" },
		}),
	);

	expect(await response.text()).toMatch(/<html[^>]* lang="es"/);
});
```

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) —
  the components the translated copy renders into.
- [Send email](/docs/data-and-background-work/send-email) — translated email, sent from a
  request or a job.
- [`@sdxc/messageformat`](/api/messageformat) — custom functions and `formatToParts`.
