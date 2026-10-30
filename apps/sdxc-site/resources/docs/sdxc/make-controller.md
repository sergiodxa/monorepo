---
title: Make a controller
description: Write a page, a form or a JSON endpoint with sdxc make controller, its route declared in a contract, mapped on the router, decided in the sitemap and guarded by a resource's abilities.
section:
    title: The sdxc command
    order: 2
order: 2.01
lastUpdated: 2026-10-25
outcomes:
    - "How to add a page, a form or a JSON endpoint with its route declared and mapped"
    - "How a controller is guarded by a resource's abilities"
    - "How the sitemap decides whether a new page is listed"
---

A controller answers one route. `sdxc make controller` writes it in `app/http/controllers/`,
declares its route in a contract in `routes/`, maps it on the router through `lazy()`, and adds
a page's decision to the sitemap, so the URL answers as soon as the command finishes:

```bash
sdxc make controller sponsors
```

```text
Wrote app/http/controllers/sponsors.tsx
Wrote app/http/controllers/sponsors.test.tsx
Wrote spec/sponsors.spec
Edited routes/web.ts
Edited app/initializers/router.tsx
Edited app/http/controllers/sitemap.ts
```

Reach for it whenever a feature needs a new URL: a page, a form with its action, or an endpoint.

## Flags

| Flag                  | Default       | What it does                                                                 |
| --------------------- | ------------- | ---------------------------------------------------------------------------- |
| `--method <method>`   | `get`         | `get`, `post`, `put`, `patch`, `delete`, or `form` for a page and its action |
| `--path <path>`       | `/<name>`     | the route's pattern, params included                                         |
| `--routes <contract>` | `make.routes` | the contract in `routes/` the route is declared in                           |
| `--resource <name>`   |               | check the resource's ability the method implies; see below                   |
| `--actions <list>`    |               | one controller per action of a resource, or `all`; see below                 |
| `--test`, `--no-test` | `make.tests`  | write the test beside it, or skip it                                         |
| `--spec`, `--no-spec` | `make.specs`  | write the pairing `.spec` under `spec/`, or skip it                          |
| `--dry-run`           |               | print the files and the diffs, and change nothing                            |
| `--force`             |               | replace the file, its test and its spec, keeping their declaration           |

On a terminal `--method` is asked for, with `get` selected; without one, it is `get`.

```bash
sdxc make controller ping --method post --path /api/ping
sdxc make controller posts/show --path "/posts/:slug"
sdxc make controller signup --method form
sdxc make controller api/keys --routes api
sdxc make controller posts/archive --resource post --method delete
```

## What it writes

The file comes from the stub that fits the route: a page by default, a form with
`--method form`, a JSON endpoint with `--routes api`, each checking an ability first with
`--resource`. A contract with its own `controller.<contract>.stub` takes that stub. The page
controller for `sdxc make controller sponsors`:

```tsx {% title="app/http/controllers/sponsors.tsx" %}
import { createAction } from "remix/router";

import page from "~/app/http/middleware/page";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

export default createAction(routes.sponsors, {
	middleware: page,
	/** Renders the Sponsors page. */
	handler: (ctx) =>
		ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				intl={ctx.intl}
				url={ctx.url}
				title="Sponsors"
			>
				<h1>Sponsors</h1>
				{/* TODO: render the page */}
			</DocumentLayout>,
		),
});
```

`--method form` writes a `createController` with two actions: `index` renders the form with its
honeypot fields and Turnstile widget, and `action` receives the submission behind the CAPTCHA
and spam checks, then redirects back with a `303`. `--routes api` writes a `createAction` with
the API chain that answers `Response.json({})`.

## Guard it with a resource's abilities

`--resource <name>` checks the request's access against the abilities
[`sdxc make policy <name>`](/docs/sdxc/make-policy) declares. `--method` picks the ability:

| `--method`     | Ability                 | Refused, or the row hidden or missing                |
| -------------- | ----------------------- | ---------------------------------------------------- |
| `get`          | `<name>.read`           | `404`; a page renders the not-found page             |
| `form`, `post` | `<name>.create`         | `403`                                                |
| `put`, `patch` | `<name>.read`, `update` | `404` when the read is refused, `403` for the update |
| `delete`       | `<name>.read`, `delete` | `404` when the read is refused, `403` for the delete |

A read, update or delete checks one row, so its route defaults to `/<controller>/:id`, and a
`--path` must hold `:id`. The row comes from `ctx.models` when `app/models/<name>.ts` exports its
row type, so a missing one is a 404 like a hidden one.
`sdxc make controller posts/archive --resource post --method delete` starts its handler with:

```tsx {% title="app/http/controllers/posts/archive.tsx" %}
let row = await ctx.models.post.find(ctx.params.id);
if (row === null || !ctx.access.can(abilities.post.read, { post: row })) {
	let missing = ctx.intl.t("notFound.title");
	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			intl={ctx.intl}
			url={ctx.url}
			title={missing}
		>
			<h1>{missing}</h1>
		</DocumentLayout>,
		{ status: 404 },
	);
}
if (!ctx.access.can(abilities.post.delete, { post: row })) {
	return new Response(null, { status: 403 });
}
```

Run `sdxc make policy <name>` first; when `app/policies/abilities.ts` does not declare the
resource yet, `make` writes the controller and prints a note saying so.

## Every action of a resource

`--actions` writes one controller per action under the name, each with the method and route a
resource's pages take:

```bash
sdxc make controller posts --actions all --resource post
```

| Action    | Route                     | Ability with `--resource` |
| --------- | ------------------------- | ------------------------- |
| `index`   | `GET /posts`              | none; filter each row     |
| `new`     | form at `/posts/new`      | `create`                  |
| `show`    | `GET /posts/:id`          | `read`                    |
| `edit`    | form at `/posts/:id/edit` | `update`                  |
| `destroy` | `POST /posts/:id/destroy` | `delete`                  |

In the `api` contract the actions are a JSON resource's endpoints: `index`, `show`, `create`,
`update` and `destroy`. `all` writes every action the contract has, and a list such as
`--actions index,show` writes the ones it names; `--actions` refuses `--method` and `--path`. A
list shows many rows, so `index` checks none: show each row a visitor may read with
`ctx.access.can(abilities.post.read, { post: row })`.

> [!NOTE]
> `--actions` writes the controllers alone. For the model, the form and the validator too, run
> [`sdxc scaffold`](/docs/sdxc/scaffold-a-resource).

## What it edits

The route goes into the contract, the mapping into the router initializer that imports that
contract and calls `createRouter`, and the decision into the sitemap:

```text
--- a/routes/web.ts
+++ b/routes/web.ts
 	notFound: "/*path",
+	sponsors: get("/sponsors"),
 });
--- a/app/initializers/router.tsx
+++ b/app/initializers/router.tsx
+	router.map(webRoutes.sponsors, lazy(() => import("~/app/http/controllers/sponsors")));
--- a/app/http/controllers/sitemap.ts
+++ b/app/http/controllers/sitemap.ts
 			notFound: false,
+			sponsors: true,
```

### The sitemap decision

A `get` or `form` route is a page, so `make` adds its decision to the sitemap: `true` lists it,
and a pattern with required params, such as `/posts/:slug`, gets `[]` for you to fill with the
pages to list. A page inside a group the sitemap excludes with `false` stays excluded.

## Names, routes and patterns

The name's folders nest the route in the contract and the file in `app/http/controllers/`:
`posts/show` writes `app/http/controllers/posts/show.tsx` and declares `show` inside a `posts`
group. A group `make` creates carries no path prefix, so the pattern is the whole path:
`/<name>` with the folders included, or what `--path` says.

## The test

The page and endpoint tests import the controller and check it exports what the router maps,
with a `test.todo` for the response:

```tsx {% title="app/http/controllers/sponsors.test.tsx" %}
import { describe, expect, test } from "vitest";

import controller from "~/app/http/controllers/sponsors";

describe("sponsors", () => {
	test("exports what the router maps", () => {
		expect(controller).toBeDefined();
	});

	test.todo("answers the Sponsors page");
});
```

The form's test runs through `createWebRouter()`, so the page chain's checks run as they do in
the Worker: it renders the form, and refuses a submission without the honeypot fields, one that
fills the trap, and one without a CAPTCHA token. Run it with:

```bash
bun run test app/http/controllers/signup.test.tsx
```

## The pairing spec

The pairing spec checks the running app from the outside: a page's spec opens it in a browser
and expects its heading, and an endpoint's spec requests it and expects a `200`:

```text {% title="spec/sponsors.spec" %}
use browser

test "Sponsors page loads" {
	when {
		browser.open "/sponsors"
	}
	then {
		expect browser.heading "Sponsors"
	}
}
```

[Write executable specs](/docs/operations-and-testing/executable-specs) covers the language and
how to run a suite against your dev server.

## Fill it in

- Read and write data through `ctx.models`, which [`sdxc make model`](/docs/sdxc/make-model)
  registers.
- Validate a form or a body with a schema from [`sdxc make validator`](/docs/sdxc/make-validator).
- Decide who may reach it with `--resource`, or by checking `ctx.access` against the abilities
  [`sdxc make policy`](/docs/sdxc/make-policy) adds.
- Add a check every page needs with [`sdxc make middleware --mount page`](/docs/sdxc/make-middleware).

## Where to go next

- [List routes](/docs/sdxc/list-routes) — confirm the route, its controller and its middleware.
- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — the five controllers a resource needs,
  from one command.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
