---
title: Make a middleware
description: Write a middleware with sdxc make middleware and, with --mount, call it last in the router's chain or in a controller chain such as page or api.
section:
    title: The sdxc command
    order: 2
order: 2.02
lastUpdated: 2026-10-19
---

A middleware runs before a controller: it publishes something on the context, such as the
signed-in user, or answers the request itself, such as a redirect to sign in.
`sdxc make middleware` writes one in `app/http/middleware/`, and `--mount` puts it in a chain in
the same run:

```bash
sdxc make middleware require-user --mount page
```

```text
Wrote app/http/middleware/require-user.ts
Wrote app/http/middleware/require-user.test.ts
Edited app/http/middleware/page.ts
```

Reach for it when several controllers need the same step. A step one controller needs belongs in
that controller.

## Flags

| Flag                  | Default      | What it does                                     |
| --------------------- | ------------ | ------------------------------------------------ |
| `--mount <target>`    |              | import it and call it last in that chain         |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it             |
| `--dry-run`           |              | print the files and the diff, and change nothing |

## What it writes

The middleware is a factory that takes no options and returns the function the chain runs:

```typescript {% title="app/http/middleware/require-user.ts" %}
import type { Middleware } from "remix/router";

/** Creates the middleware; add it to a router's chain or to a route's `lazy()` guards. */
export default function requireUser(): Middleware {
	return (_context, next) => {
		// TODO: publish on the context, or answer before the handler runs
		return next();
	};
}
```

The function is named after the file's last segment in camelCase, so `auth/require-user` writes
`app/http/middleware/auth/require-user.ts` exporting `requireUser`.

## Mount it on a chain

`--mount` imports the middleware's default export and calls it last in the chain you name, so it
runs after everything the chain already publishes: the session, the language, the renderer.

```bash
sdxc make middleware require-user --mount page
sdxc make middleware request-id --mount router
```

```text
--- a/app/http/middleware/page.ts
+++ b/app/http/middleware/page.ts
+import requireUser from "~/app/http/middleware/require-user";
@@
 	render({ assets: assetResolver }),
+	requireUser(),
 );
```

The targets are your project's own, each named after its file:

| Target           | Found as                                                                            | The call goes                  |
| ---------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| `router`, …      | an initializer in `app/initializers/` that imports and calls `createRouter`         | last in its `middleware` array |
| `page`, `api`, … | a module under `app/http/middleware/` whose default export is `createMiddleware(…)` | last among its arguments       |

A chain in a folder takes its path, such as `admin/page`. A router initializer and a chain with
the same name resolve to the router initializer. A target the project lacks stops the command
before anything is written and lists the ones it has:

```text
No middleware chain "admin" to mount on; this project has: router, api, page
```

The router chain runs for every request, pages and endpoints alike; `page` runs for every
controller that declares it as its `middleware`, and `api` for every endpoint. When the call
cannot be placed, such as a router that passes no `middleware` array or a chain that already
binds the name, `make` writes the middleware and its test and prints the import and the call to
add by hand.

To run it before an entry that is already in the chain, move the call after the run. A
middleware that needs options gets them where it is called.

## The test

```typescript {% title="app/http/middleware/require-user.test.ts" %}
import { describe, expect, test } from "vitest";

import requireUser from "~/app/http/middleware/require-user";

describe("require-user", () => {
	test("creates a middleware function", () => {
		expect(typeof requireUser()).toBe("function");
	});
});
```

```bash
bun run test app/http/middleware/require-user.test.ts
```

## Fill it in

Publish a value with a context key the controllers read, or return a response to stop the chain.
A middleware that guards a group of routes, instead of a whole chain, goes in `lazy()`'s second
argument where the router maps them, so it answers before the controller's module loads.
[Wire the router](/docs/building-remix-apps/wire-the-router) covers both, and
[Authorization](/docs/identity-and-security/authorization) the rules a guard asks, which
[`sdxc make policy`](/docs/sdxc/make-policy) writes.

## Where to go next

- [Make a controller](/docs/sdxc/make-controller) — the controllers that declare a chain.
- [List routes](/docs/sdxc/list-routes) — see the middleware that runs for each route.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
