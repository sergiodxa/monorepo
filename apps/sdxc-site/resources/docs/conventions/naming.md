---
title: Naming
description: What a package name tells you, and the conventions its exports follow, so the next package reads like the last one.
section:
    title: Conventions
    order: 3
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "What a package name tells you before you open its README"
    - "How symmetric pairs and meaningful prefixes make exports guessable"
    - "How types live in a namespace beside the value and options are named at the call site"
---

Names here are boring on purpose, so that a reader who has used two of these packages can
predict the third. This page lists the conventions a package name and its exports follow, so you
can guess an import before you look it up.

```bash
npm add @sdxc/http @sdxc/logger @sdxc/opml @sdxc/result
```

## Read what a package name tells you

A package is named for the problem it solves, in lowercase and hyphenated:
`@sdxc/markdown`, `@sdxc/rate-limit`, `@sdxc/server-timing`. Where the problem is a format, the
name is the format — `@sdxc/yaml`, `@sdxc/rss`, `@sdxc/atom`, `@sdxc/opml` — so the package you
want is the one you would have typed.

Where a package binds a contract to one vendor, the vendor is a suffix on the contract:
`@sdxc/session-storage-kv`, `@sdxc/data-table-d1`, `@sdxc/data-table-sqlstorage`. The name reads
as "this contract, on that thing". A package that is Remix middleware and nothing else says so
at the end: `@sdxc/no-www-middleware`.

## Expect parse and stringify together

Where a package reads a format it also writes it, and the two are `parse` and `stringify` —
`@sdxc/yaml` and `@sdxc/opml` export that pair, and `Markdown` and `XML` carry it as static
methods. A round trip through one of them reads like a round trip through any of them:

```typescript {% title="app/services/feeds/subscriptions.ts" %}
import type { OPML } from "@sdxc/opml";

import { parse, stringify } from "@sdxc/opml";

export function importSubscriptions(source: string) {
	return parse(source);
}

export function exportSubscriptions(outlines: OPML.Outline[]) {
	return stringify(outlines, { title: "Subscriptions", dateCreated: new Date() });
}
```

`parse` reads text, which can be wrong, so it answers with a `Result`. `stringify` answers with
a `Result` too wherever its input can hold something the format cannot write.

## Read the prefix

- **`is`** is a predicate that narrows: `isSuccess`, `isFailure`, `isModifiedSince`.
- **`to`** is a conversion, and it names what it converts to: `toRemix`, `toPlainText`.
- **`create`** builds a thing you then hold onto — a logger, a command line, a mail registry —
  so it is called once, in an initializer: `createLogger`, `createCLI`, `createMail`.
- **`parse`** reads text into a structure, and returns a `Result`, because text can be wrong.

A `create` call is where an app builds the one instance of something, so its result is a
module-level value every request and job then reads:

```typescript {% title="app/initializers/logger.ts" %}
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "links" });
```

## Find a function's types in its namespace

A function's own types are declared in a namespace merged with it, so they are reachable from
the same import and read as belonging to it:

```typescript {% title="app/services/feeds/refresh.ts" %}
import { retry } from "@sdxc/result";

export const REFRESH_RETRY: retry.Options<Error> = {
	times: 3,
	delay: 100,
	backoff: "exponential",
};
```

The same holds for constants a function takes, such as `redirect.Status.SeeOther`, and for a
component's props, such as `Button.Props` in `@sdxc/ui`.

## Name options at the call site

Anything beyond the one obvious argument goes in an options object, so a call reads without
consulting the signature:

```typescript
import { etag, policy } from "@sdxc/http/cache";

let tag = await etag(body, { weak: true });
let cacheControl = policy({
	visibility: "public",
	maxAge: "1 hour",
	sMaxAge: "1 day",
});
```

Durations are written the way you would say them — `"1 hour"`, `"5 minutes"` — so a cache age
at a call site reads as a duration rather than arithmetic.

> [!NOTE]
> A duration string is checked when your code type-checks: the amount must be a whole number, so
> `"1.5 hours"` is a type error and `"90 minutes"` is the way to write it.

## Where to go next

- [Subpath exports](/docs/conventions/subpath-exports) — where an adapter, a middleware or a
  test suite sits inside a package.
- [`Result` everywhere](/docs/conventions/result-everywhere) — what every `parse` answers with.
- [Every package](/api) — the names, side by side.
