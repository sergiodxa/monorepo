---
title: Subpath exports
description: A package is split into entry points so importing one concern leaves the others out of your bundle.
section:
  title: Conventions
  order: 2
order: 3
lastUpdated: 2026-09-21
---

Most packages here publish one entry point and nothing else — reach for the name and you have
the whole thing. Where a package covers several concerns, each concern is its own subpath, and
importing one leaves the rest out of your bundle entirely.

```typescript
import { Policies } from "@sdxc/http/cache";
import { toRemix } from "@sdxc/markdown/remix";
import { p } from "@sdxc/u/size";
```

Every package page lists the subpaths it publishes, under **Imports**.

## The recurring shapes

**`/middleware`** is where a package's Remix middleware lives. The core of the package knows
nothing about a router; the middleware is the binding, and it is a separate import so a
consumer using the core alone never pulls the router in.

**`/conformance`** is a shared test suite a driver has to pass. A package built around one
contract with swappable implementations publishes the suite that proves an implementation
satisfies it, so a driver you write yourself is held to the same standard as the ones that ship.

**A vendor name** is an adapter for that vendor. `@sdxc/cache/worker-kv` and
`@sdxc/cache/memory` are two implementations of the same contract; the vendor-neutral core sits
at the root, and the one you import decides what you deploy against.

**`/remix`** is a framework binding, on the packages that are framework-free at the root.

Three of those shapes sit side by side in [`@sdxc/cache`](/api/cache), and its source
tree reads as the entry points it publishes:

<files title="packages/cache/src">
<folder name="adapters">
<file name="memory.ts" />
<file name="worker-kv.ts" />
</folder>
<folder name="lib">
<file name="attempt.ts" />
<file name="json.ts" />
<file name="ttl.ts" />
</folder>
<folder name="testing">
<file name="conformance.ts" />
</folder>
<file name="errors.ts" />
<file name="index.ts" />
</files>

`index.ts` is the contract at the root, `adapters/` are the two implementations of it, and
`testing/conformance.ts` is the suite either of them has to pass. `lib/` is published under no
subpath at all: it is the package's own workings, and the only files a consumer can import are
the four the manifest names.

## A package with no root

Some packages publish no root entry point at all — [`@sdxc/http`](/api/http) is the
clearest case:

```typescript
import { Policies } from "@sdxc/http/cache";
import { ok } from "@sdxc/http/response/json";
```

There is no `@sdxc/http` to import, on purpose. The package is four unrelated concerns that
happen to be about HTTP, and a root that re-exported all of them would make importing the
status codes drag in the caching layer. The subpath is the unit, so the import names what you
actually wanted.

## Why this rather than more packages

The alternative is publishing `@sdxc/http-cache` and `@sdxc/http-status` as separate releases.
Subpaths keep concerns that version together in one release, so a change that touches two of
them lands as one version rather than two that have to be upgraded in step — while still
costing a consumer only what they import.
