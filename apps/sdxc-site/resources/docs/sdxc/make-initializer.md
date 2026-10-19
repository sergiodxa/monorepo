---
title: Make an initializer
description: Write the module that builds the one instance of something the app shares, such as a client, a cache or a configured package, with sdxc make initializer.
section:
    title: The sdxc command
    order: 2
order: 2.10
lastUpdated: 2026-10-19
outcomes:
    - "What belongs in an initializer, and what belongs in a service"
    - "What `make initializer` writes"
    - "How to export a singleton or a per-request factory from it"
---

An initializer builds the one instance of something the app shares: an API client, a cache, a
configured package. `sdxc make initializer` writes one in `app/initializers/`, beside the router,
the dispatcher, the logger and the rest of the template's instances:

```bash
sdxc make initializer cache
```

```text
Wrote app/initializers/cache.ts
Wrote app/initializers/cache.test.ts
```

Reach for it when a package needs configuring once and importing everywhere in your app. Code
that knows nothing about your app is a package; code that reads or writes stored state is a
model.

## Flags

| Flag                  | Default      | What it does                         |
| --------------------- | ------------ | ------------------------------------ |
| `--test`, `--no-test` | `make.tests` | write the test beside it, or skip it |
| `--dry-run`           |              | print the files and change nothing   |
| `--force`             |              | replace the file and its test        |

## What it writes

A module-level instance named after the file's last segment in camelCase, built once when the
module is first imported:

```typescript {% title="app/initializers/cache.ts" %}
/** The Cache every caller imports. */
export const cache = { name: "cache" };
```

Nothing is declared or mapped: callers import the instance.

## The test

```typescript {% title="app/initializers/cache.test.ts" %}
import { describe, expect, test } from "vitest";

import { cache } from "~/app/initializers/cache";

describe("cache", () => {
	test("is built once, at import", () => {
		expect(cache).toBeDefined();
	});
});
```

```bash
bun run test app/initializers/cache.test.ts
```

## Fill it in

Replace the placeholder with the instance, configured from `env` and your app's constants:

```typescript {% title="app/initializers/cache.ts" %}
import { env } from "cloudflare:workers";

export const cache = createCache({ namespace: env.CACHE, ttl: "1 hour" });
```

`createCache` stands for the package you configure. Keep the module's top level to building
the object, since it runs in the Worker's global scope. An instance that needs something only a
request or an async step has, such as the request's database, or a constructor that reads or
fetches, is exported as a function that builds it instead.

To reach the instance as `ctx.<name>` in handlers, publish it from a middleware in the router's
chain, which [`sdxc make middleware --mount router`](/docs/sdxc/make-middleware) puts there.
[Wire the router](/docs/building-remix-apps/wire-the-router) covers the template's initializers
and the context they publish.

## Where to go next

- [Make a middleware](/docs/sdxc/make-middleware) — publish the instance on the context.
- [Make a service](/docs/sdxc/make-service) — the rules that use it.
- [Generate files](/docs/sdxc/generate-files) — the flags, configuration and stubs every kind
  shares.
