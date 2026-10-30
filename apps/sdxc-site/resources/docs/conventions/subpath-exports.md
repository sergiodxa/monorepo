---
title: Subpath exports
description: A package is split into entry points so importing one concern leaves the others out of your bundle.
section:
    title: Conventions
    order: 3
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "Why a package splits its concerns into subpath entry points"
    - "What recurring subpath shapes to expect, like `@sdxc/http/cache`"
    - "When a package has no root export and why that beats more packages"
---

Most packages here publish one entry point — reach for the name and you have the whole thing.
Where a package covers several concerns, each concern is its own subpath, and importing one
leaves the rest out of your bundle. This page shows the subpath shapes that recur, so you can
guess where an adapter, a middleware or a test suite lives before you open a README.

```bash
npm add @sdxc/cache @sdxc/http @sdxc/markdown @sdxc/rate-limit @sdxc/result @sdxc/u
```

```typescript
import { Policies } from "@sdxc/http/cache";
import { toRemix } from "@sdxc/markdown/remix";
import { p } from "@sdxc/u/size";
```

Every package page lists the subpaths it publishes, under **Imports**.

## Import the contract from the root and the adapter by name

A package built around one contract with swappable implementations keeps the contract at its
root and each implementation under the name of what it binds to. [`@sdxc/cache`](/api/cache)
publishes `Cache` at the root, `MemoryCache` at `@sdxc/cache/memory` and `WorkerKVCache` at
`@sdxc/cache/worker-kv`. Write your own code against the contract:

```typescript {% title="app/services/posts/cached-post.ts" %}
import type { Cache } from "@sdxc/cache";

import { loadPost } from "~/app/services/posts/load-post";

export function cachedPost(cache: Cache, id: string) {
	return cache.fetch(`post:${id}`, () => loadPost(id), { ttl: "5 minutes" });
}
```

Production hands it `new WorkerKVCache(env.CACHE)`, and a test hands it the in-memory adapter,
so the test runs without a KV namespace:

```typescript {% title="app/services/posts/cached-post.test.ts" %}
import { MemoryCache } from "@sdxc/cache/memory";
import { isSuccess } from "@sdxc/result";
import { expect, test } from "vitest";

import { cachedPost } from "~/app/services/posts/cached-post";

test("stores the post under its key", async () => {
	let cache = new MemoryCache();
	await cachedPost(cache, "1");

	let hit = await cache.read("post:1");
	expect(isSuccess(hit) && hit.data !== null).toBe(true);
});
```

The import you write decides what you deploy against: a Worker that imports only
`@sdxc/cache/worker-kv` carries no in-memory adapter. The same shape holds for `/memory` in
[`@sdxc/jobs`](/api/jobs), [`@sdxc/mail`](/api/mail) and [`@sdxc/messaging`](/api/messaging),
and for vendor names such as `@sdxc/messaging/slack` and `@sdxc/billing/providers/stripe`.

## Hold your own adapter to the conformance suite

**`/conformance`** is the test suite every implementation of a contract has to pass. The
adapters that ship run it, and a driver you write yourself runs the same one:

```typescript {% title="app/models/d1-cache.test.ts" %}
import { conformance } from "@sdxc/cache/conformance";

import { D1Cache } from "~/app/models/d1-cache";
import { openDatabase } from "~/app/initializers/database";

conformance({ name: "D1Cache", create: () => new D1Cache(openDatabase()) });
```

`conformance` registers Vitest tests, so it runs inside your own test file.
[`@sdxc/jobs`](/api/jobs), [`@sdxc/messaging`](/api/messaging),
[`@sdxc/newsletter`](/api/newsletter) and [`@sdxc/flags`](/api/flags) publish the same subpath
for their contracts.

## Add the middleware from its own subpath

**`/middleware`** is a package's Remix middleware. The core of the package works without a
router; the middleware is the binding, so code using the core alone never pulls the router in:

```typescript
import { addressKey, KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
```

Where a package also runs inside jobs or the command line, the binding for each is one level
down: `@sdxc/mail/middleware/jobs` and `@sdxc/logger/middleware/cli`.

**`/testing`** carries helpers for asserting against the package in your own tests, such as
`@sdxc/authz/testing` and `@sdxc/openapi/testing`. **`/remix`** is a framework binding on a
package that is framework-free at the root, such as `@sdxc/markdown/remix`, and **`/ui`** is a
package's `remix/component` components, such as `@sdxc/honeypot/ui`.

## Import from a package with no root

Some packages publish no root entry point at all, and [`@sdxc/http`](/api/http) is the clearest
case:

```typescript
import { Policies } from "@sdxc/http/cache";
import { ok } from "@sdxc/http/response/json";
```

The package is several independent concerns about HTTP — caching, content negotiation, status
codes, responses — so the subpath is the unit, and importing the status codes leaves the
caching layer out.

> [!NOTE]
> Only the subpaths a package's manifest names are importable. A path into a package's internals,
> such as `@sdxc/cache/lib/ttl`, fails to resolve, so import from a listed subpath even when the
> file you want sits deeper in the source.

## Why this rather than more packages

Subpaths keep concerns that version together in one release, so a change that touches two of
them lands as one version, while you still pay only for what you import.

## Where to go next

- [Install and pin](/docs/getting-started/install-and-pin) — how to pin every package, and so
  every subpath, at one release.
- [Cache on Workers](/docs/data-and-background-work/cache-on-workers) — the contract and its
  adapters at work in an app.
- [Naming](/docs/conventions/naming) — the conventions that make the exports behind each subpath
  guessable.
