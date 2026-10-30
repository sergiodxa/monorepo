---
title: Make a Durable Object
description: Write a Durable Object class with sdxc make do, re-exported from bootstrap/worker.ts with its export and its binding declared in cloudflare.config.ts.
section:
    title: The sdxc command
    order: 2
order: 2.14
lastUpdated: 2026-10-25
outcomes:
    - "How `make do` declares a Durable Object's class, export and binding in one run"
    - "Where the class goes: `app/models/` or `app/services/`, picked with `--role`"
    - "How to call the object from the app and test it without the Worker runtime"
---

A Durable Object is one instance of a class that Cloudflare runs in one place, with storage of
its own, so every request for the same name reaches the same object in order: a counter, a chat
room, a per-tenant store. Running one takes three edits beside the class: the Worker re-exports
it, `cloudflare.config.ts` declares it as an export, and a binding gives the app a way to reach
it. `sdxc make do` writes the class and makes all three:

```bash
sdxc make do page-views --role model
```

```text
Wrote app/models/page-views.ts
Edited cloudflare.config.ts
Edited bootstrap/worker.ts
Next: sdxc run typegen
```

Run what the last line names, so `env.PAGE_VIEWS` type checks:

```bash
sdxc run typegen
```

Reach for it when the requests for one thing must run one at a time against state only that
thing holds: a counter that never loses an increment, a room whose messages arrive in order. A
table every request reads and writes is a [model](/docs/sdxc/make-model) instead.

## Flags

The class goes where its role puts it, and its binding is named after it unless you name it.

| Flag               | Default             | What it does                                                     |
| ------------------ | ------------------- | ---------------------------------------------------------------- |
| `--role <role>`    | `service`           | `model` writes it in `app/models/`, `service` in `app/services/` |
| `--binding <NAME>` | from the class name | the key the app reads it from on `env`                           |
| `--dry-run`        |                     | print the file and the diffs, and change nothing                 |
| `--force`          |                     | write the class again and replace its binding                    |

```bash
sdxc make do geo-fetch --binding GEO_FETCH
```

Pick `--role model` when the object owns stored state, as a counter or a room's history does, and
leave the default for one that holds none of its own, such as an object that only serializes
calls to an outside API.

## Names

The class is the name in PascalCase with `DO` after it, and the binding is the name in
SCREAMING_SNAKE_CASE:

`page-views` writes the class `PageViewsDO` with the binding `PAGE_VIEWS`, and a name that
already ends in `do` gets `DO` once. `--binding` turns kebab-case or camelCase into
SCREAMING_SNAKE_CASE: `--binding chat-rooms` declares `CHAT_ROOMS`.

## What it writes

The class extends `DurableObject` from `cloudflare:workers` and overrides `fetch` to answer with
its own name, so the binding answers the first time something reaches it.

## What it edits

The class is declared as an export of the Worker with SQLite storage, its binding is added to
the Worker's `env`, and `bootstrap/worker.ts` re-exports it, since Cloudflare finds the class
among the entry point's exports:

```text
--- a/cloudflare.config.ts
+++ b/cloudflare.config.ts
-import { bindings, defineConfig, triggers } from "cf/config";
+import { bindings, defineConfig, triggers, exports } from "cf/config";
@@
 export default defineConfig({
 	worker: {
+		exports: {
+			PageViewsDO: exports.durableObject({ storage: "sqlite" }),
+		},
 		name: manifest.name,
@@
 		env: {
+			PAGE_VIEWS: bindings.durableObject({ worker: manifest.name, exportName: "PageViewsDO" }),
--- a/bootstrap/worker.ts
+++ b/bootstrap/worker.ts
 } satisfies ExportedHandler<Cloudflare.Env>;
+
+export { PageViewsDO } from "~/app/models/page-views";
```

> [!WARNING]
> Cloudflare keeps an object's storage under its class name, so pick the name before the first
> deploy. To rename a deployed class, declare the new name as its own entry in `exports` and turn
> the old one into `exports.durableObject({ state: "renamed", renamedTo: "NewName" })`; the next
> deploy moves its objects, data included, to the new class.

A file that already exists, or a binding of that name already in `env`, stops the run with the
project as it was; `--force` writes the class and its binding again and keeps the export and the
re-export. A Worker configured in `wrangler.jsonc` declares the class there by hand.

## Fill it in

Give the object the methods a caller needs. A method on the class is callable over RPC from a
stub, and `this.ctx.storage` is the object's own storage:

```typescript {% title="app/models/page-views.ts" %}
import { DurableObject } from "cloudflare:workers";

/** One page's view counter, addressed by the page's path. */
export class PageViewsDO extends DurableObject<Cloudflare.Env> {
	/** Counts one more view and answers the total; two views of one page count in order. */
	async increment(): Promise<number> {
		let views = ((await this.ctx.storage.get<number>("views")) ?? 0) + 1;
		await this.ctx.storage.put("views", views);
		return views;
	}
}
```

Reach an object by name through its binding. The binding names its Worker by `manifest.name`, so
the generated `env` types it as a namespace of any class; name the class once where you reach it,
and every method on the stub type checks:

```typescript {% title="app/services/count-view.ts" %}
import type { PageViewsDO } from "~/app/models/page-views";

import { env } from "cloudflare:workers";

/** Counts a view of `path` and answers its total. */
export async function countView(path: string): Promise<number> {
	let namespace = env.PAGE_VIEWS as DurableObjectNamespace<PageViewsDO>;
	return await namespace.getByName(path).increment();
}
```

## Test it

Vitest imports the app's modules in Node, where `cloudflare:workers` is the stand-in in
`app/test/cloudflare-workers.ts`, and that stand-in exports the `DurableObject` base class, so
a module that extends it loads. Construct the object with `createDurableObjectState()` from
`@sdxc/cloudflare-mocks`, which the template already installs. Its storage works like the
object's own, so the test calls the methods a stub would:

```typescript {% title="app/models/page-views.test.ts" %}
import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { env } from "cloudflare:workers";
import { describe, expect, test } from "vitest";

import { PageViewsDO } from "~/app/models/page-views";

describe("PageViewsDO", () => {
	test("counts every view of its page", async () => {
		let views = new PageViewsDO(
			createDurableObjectState({ name: "/pricing" }),
			env,
		);

		expect(await views.increment()).toBe(1);
		expect(await views.increment()).toBe(2);
	});
});
```

```bash
bun run test app/models/page-views.test.ts
```

`make do` writes no test of its own, so this file is yours to add.

## Where to go next

- [Make a binding](/docs/sdxc/make-binding) — the KV namespace, bucket or queue an object or the
  Worker reads beside it.
- [Test Workers apps](/docs/operations-and-testing/testing) — every Cloudflare mock the
  stand-in can hold, and where each is looser than the platform.
- [Deploy](/docs/sdxc/deploy) — ship the class, its export and its binding together.
