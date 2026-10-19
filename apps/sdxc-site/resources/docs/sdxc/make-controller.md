---
title: Make a controller
description: Write a page, a form or a JSON endpoint with sdxc make controller, its route declared in a contract, mapped on the router, decided in the sitemap and guarded by a resource's abilities.
section:
    title: The sdxc command
    order: 2
order: 2.01
lastUpdated: 2026-10-19
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
| `--dry-run`           |               | print the files and the diffs, and change nothing                            |

On a terminal `--method` is asked for, with `get` selected; without one, it is `get`.

```bash
sdxc make controller ping --method post --path /api/ping
sdxc make controller posts/show --path "/posts/:slug"
sdxc make controller signup --method form
sdxc make controller api/keys --routes api
sdxc make controller posts/archive --resource post --method delete
```

## What it writes

The file comes from the stub that fits the route:

| Stub                            | Written for                                   | What it is                                                 |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `controller.stub`               | any method on a contract without its own stub | a page rendered in the document layout with the page chain |
| `controller.form.stub`          | `--method form`                               | a page with a form and the action that receives it         |
| `controller.api.stub`           | `--routes api`                                | a JSON endpoint with the API chain                         |
| `controller.resource.stub`      | `--resource`                                  | the page, checking the resource's ability first            |
| `controller.resource.form.stub` | `--resource` with `--method form`             | the form, checking the ability in both actions             |
| `controller.api.resource.stub`  | `--resource` with `--routes api`              | the JSON endpoint, checking the ability first              |

A contract with a stub named after it, `controller.<contract>.stub`, takes that stub, so a
project can add `controller.admin.stub` for `--routes admin`. `--method` sets the route helper
the contract declares; the handler's shape comes from the stub, so a `post` route on the web
contract starts from the page stub for you to turn into the action you need.

The page controller for `sdxc make controller sponsors`:

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
[`sdxc make policy <name>`](/docs/sdxc/make-policy) declares, the way a scaffolded controller
does. `--method` picks the ability:

| `--method`     | Ability                 | Refused, or the row hidden or missing                |
| -------------- | ----------------------- | ---------------------------------------------------- |
| `get`          | `<name>.read`           | `404`; a page renders the not-found page             |
| `form`, `post` | `<name>.create`         | `403`                                                |
| `put`, `patch` | `<name>.read`, `update` | `404` when the read is refused, `403` for the update |
| `delete`       | `<name>.read`, `delete` | `404` when the read is refused, `403` for the delete |

A read, update or delete checks one row, so its route defaults to `/<controller>/:id`, and a
`--path` must hold `:id`. When `app/models/<name>.ts` exports its row type, the row comes from
`ctx.models`, so a missing one is a 404 like a hidden one; otherwise it is `{ id: ctx.params.id }`
for you to replace. `sdxc make controller posts/archive --resource post --method delete` starts
its handler with:

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
resource yet, `make` writes the controller and prints a note saying so. A nested name checks the
nested group: `--resource billing/invoice` checks `abilities.billing.invoice.*` against
`{ invoice: row }`.

## Every action of a resource

`--actions` writes one controller per action under the name, each with the method and route a
resource's pages take, and formats them together:

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

In the `api` contract the actions are the endpoints of a JSON resource:

```bash
sdxc make controller api/posts --routes api --actions index,show,create,update,destroy
```

| Action    | Route               | Ability with `--resource` |
| --------- | ------------------- | ------------------------- |
| `index`   | `GET /posts`        | none; filter each row     |
| `show`    | `GET /posts/:id`    | `read`                    |
| `create`  | `POST /posts`       | `create`                  |
| `update`  | `PATCH /posts/:id`  | `update`                  |
| `destroy` | `DELETE /posts/:id` | `delete`                  |

`all` writes every action the contract has, and a list writes the ones it names. Each
controller is the one `--method` and `--path` would write, so `--actions` refuses both. A list
shows many rows, so `index` checks none and the run prints a note: show each row a visitor may
read with `ctx.access.can(abilities.post.read, { post: row })`.

<note>
`--actions` writes the controllers alone. For the model, the form and the validator too, run
[`sdxc scaffold`](/docs/sdxc/scaffold-a-resource).
</note>

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

The contract gains the import of the route helper when it lacks it: `post`, `put`, `patch`,
`del` for `--method delete`, or `form`.

### The sitemap decision

A `get` or `form` route is a page, so when a controller builds the sitemap with `fromRoutes` over
the same contract, `make` adds the page's decision there:

- `true` lists the page.
- `[]` is written for a pattern with required params, such as `/posts/:slug`, for you to fill
  with the pages to list.
- A `form` route decides its page under `index`: `signup: { index: true }`.
- A page inside a group the sitemap already excludes with `false` stays excluded.

`post`, `put`, `patch` and `delete` routes are no pages and get no decision.

## Names, routes and patterns

The name's folders nest the route in the contract and the file in `app/http/controllers/`.
`sdxc make controller posts/show --path "/posts/:slug"` writes
`app/http/controllers/posts/show.tsx`, declares `show` inside a `posts` group, created when
missing, and maps `webRoutes.posts.show`:

```text
--- a/routes/web.ts
+++ b/routes/web.ts
+	posts: {
+		show: get("/posts/:slug"),
+	},
```

A group `make` creates carries no path prefix, so the pattern is the whole path: `/<name>` with
the folders included, or what `--path` says. `api/keys --routes api` joins the template's `api`
group and is served at `/api/keys`.

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

## Fill it in

- Read and write data through `ctx.models`, which [`sdxc make model`](/docs/sdxc/make-model)
  registers.
- Validate a form or a body with a schema from [`sdxc make validator`](/docs/sdxc/make-validator).
- Decide who may reach it with `--resource`, or by checking `ctx.access` against the abilities
  [`sdxc make policy`](/docs/sdxc/make-policy) adds.
- Add a check every page needs with [`sdxc make middleware --mount page`](/docs/sdxc/make-middleware).

[Wire the router](/docs/building-remix-apps/wire-the-router) covers the router the controller is
mapped on, [Forms and params](/docs/building-remix-apps/forms-and-params) a form's fields and
route params, and [JSON APIs](/docs/http-apis/json-apis) an endpoint's responses.

## Where to go next

- [List routes](/docs/sdxc/list-routes) — confirm the route, its controller and its middleware.
- [Scaffold a resource](/docs/sdxc/scaffold-a-resource) — the five controllers a resource needs,
  from one command.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
