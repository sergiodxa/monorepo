---
title: Naming
description: What a package name tells you, and the conventions its exports follow, so the next package reads like the last one.
section:
  title: Conventions
  order: 2
order: 4
lastUpdated: 2026-09-21
---

Names here are meant to be guessable. A reader who has used two of these packages should be
able to predict the third, and that only works if the naming is boring on purpose.

## Package names

A package is named for the problem it solves, in lowercase and hyphenated:
`@sdxc/markdown`, `@sdxc/rate-limit`, `@sdxc/server-timing`. Where the problem is a format, the
name is the format — `@sdxc/yaml`, `@sdxc/rss`, `@sdxc/atom`, `@sdxc/opml` — so the package you
want is the one you would have typed.

Where a package binds a contract to one vendor, the vendor is a suffix on the contract:
`@sdxc/session-storage-kv`, `@sdxc/data-table-d1`, `@sdxc/data-table-sqlstorage`. The name reads
as "this contract, on that thing", and swapping the vendor is swapping the last segment.

No package is named after the author, a metaphor or an animal. The scope carries the
attribution; the name carries the job.

## Symmetric pairs

Where a package reads a format it also writes it, and the two are `parse` and `stringify` —
`@sdxc/markdown`, `@sdxc/yaml`, `@sdxc/xml` and `@sdxc/opml` all expose that pair. A reader who
knows one knows the others.

## Prefixes that mean something

- **`is`** is a predicate that narrows: `isSuccess`, `isFailure`, `isModifiedSince`.
- **`to`** is a conversion, and it names what it converts to: `toRemix`, `toPlainText`.
- **`create`** builds a thing you then hold onto — a router, a client, a mixin — rather than
  computing an answer.
- **`parse`** reads text into a structure, and returns a `Result`, because text can be wrong.

## Types live in a namespace beside the value

A function's own types are declared in a namespace merged with it, so they are reachable from
the same import and read as belonging to it:

```typescript
import { redirect } from "@sdxc/response";
import { retry } from "@sdxc/result";

let options: retry.Options<Error> = { times: 3, delay: 100, backoff: "exponential" };
return redirect("/articles", { status: redirect.Status.SeeOther });
```

The same holds for a component and its props: `Command.Props`, `Command.ItemProps` and
`Command.Variant` come from the same import as `Command` itself.

## Options are named at the call site

Anything beyond the one obvious argument goes in an options object, so a call reads without
consulting the signature:

```typescript
await etag(body, { weak: true });
policy({ visibility: "public", maxAge: "1 hour", sMaxAge: "1 day" });
```

Durations are written the way you would say them — `"1 hour"`, `"5 minutes"` — and converted
internally, so a cache age at a call site is readable rather than arithmetic.
