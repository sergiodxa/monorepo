---
title: Cache on Cloudflare Workers
description: Keep values in Workers KV with a stale copy for outages, and store whole responses at the edge under tags you can purge.
section:
    title: Data & background work
    order: 6
order: 1
lastUpdated: 2026-09-29
---

A Worker has two caches worth using, and they answer different questions. Workers KV holds
_values_: the list of releases you fetched from an API, a rendered feed, anything you would
rather not compute twice. The platform's HTTP cache holds _responses_: a whole page, stored at
the edge and replayed without your Worker running at all.

This guide sets up both. [`@sdxc/cache`](/api/cache) reads and writes values through KV and
answers every call with a `Result`, and [`@sdxc/workers-cache`](/api/workers-cache) declares
which responses the edge may store, tags them, and purges them when the content changes.

```bash
npm add @sdxc/cache @sdxc/workers-cache @sdxc/http @sdxc/result
```

## Open a cache for each request

`WorkerKVCache` lives at `@sdxc/cache/worker-kv` and takes a KV namespace binding. Given a
`waitUntil`, it hands each write to the invocation instead of awaiting it, so the reader who paid
for a miss does not also pay for the put.

```typescript {% title="app/services/cache.ts" %}
import type { Cache } from "@sdxc/cache";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { env, waitUntil } from "cloudflare:workers";

export function requestCache(): Cache {
	return new WorkerKVCache(env.CACHE, { waitUntil });
}
```

Build one per request rather than one per isolate. A deferred write is held on the instance
until KV has it, so a read on the same instance sees what was just written, and the request is
the scope where reading your own writes matters.

Code that uses a cache should take the `Cache` interface rather than the class. That is what lets
a test hand it a `MemoryCache` instead.

## Read through with `fetch`

`fetch(key, load, options)` returns the stored entry, or runs `load`, stores what it returned, and
returns that. The value's type comes from the loader, so nothing is annotated:

```tsx {% title="app/http/controllers/packages.tsx" %}
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { requestCache } from "~/app/services/cache";
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
the store can do wrong. An unreachable namespace, an entry that is not
JSON and a refused write all still answer with the loaded value, so a failure here means
`listPackages` itself failed and there was nothing to show. The error's `code` says which case
you are in: `load_failed` for the loader, `unavailable` and `invalid_value` for the store.

What comes back is what reads out of KV, which is JSON. A `Date` your loader returned arrives as
the string it serialized to, and the type says so, on a hit and on a miss alike.

## Choose a TTL

`ttl` takes a duration string such as `"10 minutes"` or `"1 day"`, checked at compile time by
[`@sdxc/duration`](/api/duration), or a number of whole seconds. Leave it out and the entry never
expires.

KV refuses a TTL under 60 seconds. A shorter one leaves the entry unwritten and reports
`unavailable`, so a lifetime you compute at runtime needs a floor:

```typescript {% title="app/services/daily-report.ts" %}
import type { Cache } from "@sdxc/cache";

import { buildReport, secondsUntilMidnight } from "~/app/services/report";

export async function storeDailyReport(cache: Cache) {
	let seconds = Math.max(secondsUntilMidnight(new Date()), 60);
	return await cache.write("report:today", await buildReport(), { ttl: seconds });
}
```

## Keep a stale copy for when the source is down

A TTL decides when a value stops being fresh. It should not also decide when your page goes
blank. Write every successful fetch under two keys: one that expires, whose presence is what
"fresh" means, and one that never does, which answers when the upstream refuses you.

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
`write` rather than `fetch` because the fallback needs to know the load
failed, which `fetch` would report only as a failure with no stale value beside it. `read`
succeeds with `null` on a miss, so a missing entry and a present one are both a success. Reading
the type parameter back is an assertion: KV cannot prove what a key holds, so prefix keys by what
they hold and keep one shape per prefix.

## Store whole responses at the edge

A value in KV still costs a Worker invocation to serve. For a public page, the edge can serve the
response itself. `@sdxc/workers-cache` handles the part HTTP does not standardize: tagging a
response and purging by tag.

Declare the tags once, as functions, so the header a page writes and the purge that clears it
cannot drift apart:

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

Each builder validates the tag it produces and throws on one the platform would drop, so a bad tag
fails where you wrote it rather than silently at the edge.

Register the middleware once, handing it the platform cache. List it ahead of your session and
auth middleware, so the check it runs on the finished response sees everything they added:

```typescript {% title="app/router.ts" %}
import { log } from "@sdxc/logger/middleware";
import workersCache from "@sdxc/workers-cache/middleware";
import { cache as platformCache } from "cloudflare:workers";
import { createRouter } from "remix/router";

import { logger } from "~/app/logger";

export default createRouter({
	middleware: [log(logger), workersCache({ cache: () => platformCache })],
});
```

A handler then declares what it wants with `ctx.cache(policy, ...tags)`:

```tsx {% title="app/http/controllers/releases.tsx" %}
import { createAction } from "remix/router";

import { requestCache } from "~/app/services/cache";
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

`ctx.cache()` records intent and writes nothing. The middleware writes `Cache-Control` and
`Cache-Tag` after the handler returns, once it can inspect the finished response. A response
carrying `Set-Cookie`, or a `public` policy on a request that carried a session, is downgraded to
`private, no-store` and logged as a warning (and throws in development), so a signed-in page
cannot end up in a shared cache. A route that never calls `ctx.cache()` is left exactly as it
was, so no page inherits a lifetime it did not choose.

## Purge when the content changes

A write action purges the tags it invalidated. `ctx.cache.purge()` awaits the platform and
returns a `Result`, which is what you want before redirecting to the page you just changed:

```typescript {% title="app/http/controllers/publish-release.ts" %}
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { saveRelease } from "~/app/data/releases";
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

`saveRelease` stands for your own write, answering the version it stored.

When nobody is about to look, `ctx.cache.purgeLater(...tags)` runs the purge after the response
and logs a failure instead of returning one. Outside a request, `purge(platformCache, { tags })`
does the same from a job, and `{ everything: true }` empties the cache when you no longer know
which entries are wrong.

## Test both layers without a platform

`MemoryCache` from `@sdxc/cache/memory` serializes on write and parses on read, so it behaves
like KV down to the `Date` coming back as a string, and its `now` option expires an entry without
waiting for one. `createRecordingCache()` records purges instead of sending them:

```typescript {% title="app/services/cache.test.ts" %}
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

In production, `cacheStatus(response)` reads the `cf-cache-status` header as `"hit"`, `"miss"`,
`"expired"`, `"bypass"` or `"unknown"`, which is worth logging while you check that pages are
actually being stored.

## Where to go next

- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the data the
  cache sits in front of.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — refresh an entry on
  a schedule instead of on a reader's miss.
- [Test Workers apps](/docs/operations-and-testing/testing) — run a KV assertion against a real
  binding.
- [`Result` everywhere](/docs/conventions/result-everywhere) — the shape every cache call answers
  with.
