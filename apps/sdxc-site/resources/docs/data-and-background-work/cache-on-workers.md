---
title: Cache on Cloudflare Workers
description: Keep values in Workers KV with a stale copy for outages, and store whole responses at the edge under tags you can purge.
section:
    title: Data & background work
    order: 7
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "How to read through a Workers KV cache and keep a stale copy for outages"
    - "How to store whole responses at the edge with `@sdxc/workers-cache` and purge them by tag"
    - "How to test both cache layers without a platform"
---

A Worker has two caches worth using, and they answer different questions. Workers KV holds
_values_: the list of releases you fetched from an API, a rendered feed, anything you would
rather not compute twice. The platform's HTTP cache holds _responses_: a whole page, stored at
the edge and replayed without your Worker running at all.

This guide sets up both. [`@sdxc/cache`](/api/cache) reads and writes values through KV and
answers every call with a `Result`, and [`@sdxc/workers-cache`](/api/workers-cache) declares
which responses the edge may store, tags them, and purges them when the content changes.

```bash
npm add @sdxc/cache @sdxc/http @sdxc/logger @sdxc/result @sdxc/workers-cache remix
```

## Open a cache for each request

`WorkerKVCache` lives at `@sdxc/cache/worker-kv` and takes a KV namespace binding. Given a
`waitUntil`, it hands each write to the invocation instead of awaiting it, so the reader who paid
for a miss does not also pay for the put.

```typescript {% title="app/initializers/cache.ts" %}
import type { Cache } from "@sdxc/cache";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { env, waitUntil } from "cloudflare:workers";

export function requestCache(): Cache {
	return new WorkerKVCache(env.CACHE, { waitUntil });
}
```

Build one per request: a deferred write is held on the instance until KV has it, so a read on
the same instance sees what was just written. Code that uses a cache takes the `Cache` interface,
so a test can hand it a `MemoryCache`.

## Read through with `fetch`

`fetch(key, load, options)` returns the stored entry, or runs `load`, stores what it returned, and
returns that. The value's type comes from the loader, so nothing is annotated:

```tsx {% title="app/http/controllers/packages.tsx" %}
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { requestCache } from "~/app/initializers/cache";
import { listPackages } from "~/app/services/registry";
import PackagesPage from "~/resources/views/packages";
import routes from "~/routes/web";

export default createAction(routes.packages, async (ctx) => {
	let packages = await requestCache().fetch("packages:all", () => listPackages(), {
		ttl: "10 minutes",
	});

	if (isFailure(packages)) return ctx.render(<PackagesPage packages={[]} />);
	return ctx.render(<PackagesPage packages={packages.data} />);
});
```

Here `listPackages` is your own loader and `PackagesPage` your view. `fetch` absorbs everything
the store can do wrong, so a failure here means `listPackages` itself failed. What comes back is
JSON, so a `Date` your loader returned arrives as a string, and the type says so. `ttl` takes a
duration string or a number of whole seconds; leave it out and the entry never expires.

> [!WARNING]
> KV refuses a TTL under 60 seconds. A shorter one leaves the entry unwritten and reports
> `unavailable`, so a lifetime you compute at runtime needs a floor.

## Keep a stale copy for when the source is down

A TTL decides when a value stops being fresh, not when your page goes blank. Write every
successful fetch under two keys: one that expires, whose presence means "fresh", and one that
never does, which answers when the upstream refuses you:

```typescript {% title="app/services/releases.ts" %}
import type { Cache } from "@sdxc/cache";

import { isSuccess } from "@sdxc/result";

import type { Release } from "~/app/services/github";

import { fetchReleases } from "~/app/services/github";

const FRESH_KEY = "releases:fresh";
const LAST_KEY = "releases:last";

export async function readReleases(cache: Cache): Promise<Release[]> {
	let fresh = await cache.read<Release[]>(FRESH_KEY);
	if (isSuccess(fresh) && fresh.data !== null) return fresh.data;

	let fetched = await fetchReleases();
	if (isSuccess(fetched)) {
		await cache.write(FRESH_KEY, fetched.data, { ttl: "1 hour" });
		await cache.write(LAST_KEY, fetched.data);
		return fetched.data;
	}

	let stale = await cache.read<Release[]>(LAST_KEY);
	if (isSuccess(stale) && stale.data !== null) return stale.data;

	return [];
}
```

`fetchReleases` is your own call to the upstream API, answering a `Result`. This uses `read` and
`write` because the fallback needs to know the load failed. `read` succeeds with `null` on a miss.

## Store whole responses at the edge

A value in KV still costs a Worker invocation to serve; for a public page, the edge can serve the
response itself. Declare the tags once, as functions, so the header a page writes and the purge
that clears it cannot drift apart:

```typescript {% title="app/services/edge-cache.ts" %}
import { policy } from "@sdxc/http/cache";
import { createTags } from "@sdxc/workers-cache";

export const TAGS = createTags({
	release: (version: string) => `release:${version}`,
	releaseList: () => "releases",
});

export const PUBLIC_PAGE = policy({
	visibility: "public",
	maxAge: "5 minutes",
	sMaxAge: "1 day",
}).toString();
```

Register the middleware once, handing it the platform cache, ahead of your session and auth
middleware so its check on the finished response sees everything they added:

```typescript {% title="app/initializers/router.ts" %}
import { log } from "@sdxc/logger/middleware";
import workersCache from "@sdxc/workers-cache/middleware";
import { cache as platformCache } from "cloudflare:workers";
import { createRouter } from "remix/router";

import { logger } from "~/app/initializers/logger";

export function createWebRouter() {
	return createRouter({
		middleware: [log(logger), workersCache({ cache: () => platformCache })],
	});
}
```

A handler then declares what it wants with `ctx.cache(policy, ...tags)`:

```tsx {% title="app/http/controllers/releases.tsx" %}
import { createAction } from "remix/router";

import { requestCache } from "~/app/initializers/cache";
import { PUBLIC_PAGE, TAGS } from "~/app/services/edge-cache";
import { readReleases } from "~/app/services/releases";
import ReleasesPage from "~/resources/views/releases";
import routes from "~/routes/web";

export default createAction(routes.releases, async (ctx) => {
	let releases = await readReleases(requestCache());
	ctx.cache(PUBLIC_PAGE, TAGS.releaseList());
	return ctx.render(<ReleasesPage releases={releases} />);
});
```

The middleware writes `Cache-Control` and `Cache-Tag` once it can inspect the finished response.
A response carrying `Set-Cookie`, or a `public` policy on a request that carried a session, is
downgraded to `private, no-store` and logged, so a signed-in page cannot end up in a shared cache.

> [!WARNING]
> Workers Cache stores a `200` with no freshness headers for two hours under a key that ignores
> cookies. That default is why every route answers `private, no-store` until it declares a
> policy: a bare response would hand one visitor's page to the next.

## Purge when the content changes

A write action purges the tags it invalidated. `ctx.cache.purge()` awaits the platform and
returns a `Result`, which is what you want before redirecting to the page you just changed:

```typescript {% title="app/http/controllers/publish-release.ts" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { saveRelease } from "~/app/models/releases";
import { TAGS } from "~/app/services/edge-cache";
import routes from "~/routes/web";

export default createAction(routes.publishRelease, async (ctx) => {
	let version = await saveRelease(ctx.formData);

	let purged = await ctx.cache.purge(TAGS.release(version), TAGS.releaseList());
	if (isFailure(purged)) {
		ctx.log.warn("cache.purge_failed", { error: purged.error.message });
	}

	return redirect(routes.releases.href(), { status: redirect.Status.SeeOther });
});
```

`saveRelease` stands for your own write, answering the version it stored. When nobody is about to
look, `ctx.cache.purgeLater(...tags)` runs the purge after the response instead.

## Test both layers without a platform

`MemoryCache` from `@sdxc/cache/memory` behaves like KV down to the `Date` coming back as a
string, and its `now` option expires an entry without waiting. `createRecordingCache()` records
purges instead of sending them:

```typescript {% title="app/services/edge-cache.test.ts" %}
import { MemoryCache } from "@sdxc/cache/memory";
import { createRecordingCache, purge } from "@sdxc/workers-cache";
import { expect, test } from "vitest";

import { TAGS } from "~/app/services/edge-cache";

test("expires the fresh copy and purges the list", async () => {
	let clock = 0;
	let cache = new MemoryCache({ now: () => clock });

	await cache.write("releases:fresh", [{ version: "2026.9.1" }], { ttl: "1 hour" });
	clock += 3_600_001;
	expect(await cache.read("releases:fresh")).toEqual({
		status: "success",
		data: null,
	});

	let edge = createRecordingCache();
	await purge(edge, { tags: [TAGS.releaseList()] });
	expect(edge.purgedTags).toEqual(["releases"]);
});
```

## Where to go next

- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the data the
  cache sits in front of.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — refresh an entry on
  a schedule instead of on a reader's miss.
- [Test Workers apps](/docs/operations-and-testing/testing) — run a KV assertion against a real
  binding.
