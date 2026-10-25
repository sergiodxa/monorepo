---
title: Make a binding
description: Declare a KV namespace, D1 database, R2 bucket, queue, rate limit, email sender or Durable Object binding in cloudflare.config.ts with sdxc make binding, then type, use and test it.
section:
    title: The sdxc command
    order: 2
order: 2.15
lastUpdated: 2026-10-25
outcomes:
    - "What each `make binding` helper writes, and which placeholder to replace before deploying"
    - "How to read the new binding from `env` once `sdxc run typegen` types it"
    - "Where a test gets the binding, since Vitest runs outside the Worker"
---

A binding is how the Worker reaches a Cloudflare resource: a KV namespace, a D1 database, an R2
bucket, a queue. The Worker receives only what `cloudflare.config.ts` declares under `env`, and
`sdxc run typegen` types `env` from the same file. `sdxc make binding` adds the declaration, in
the form the helper takes, so the key you read in code and the resource Cloudflare attaches are
named in one place:

```bash
sdxc make binding kv CACHE
```

```text
edited cloudflare.config.ts
Next: sdxc run typegen
```

```text
--- a/cloudflare.config.ts
+++ b/cloudflare.config.ts
 		env: {
+			CACHE: bindings.kv({ id: "00000000000000000000000000000000" }),
```

Run the command the last line names, and `env.CACHE` type checks as a `KVNamespace`:

```bash
sdxc run typegen
```

## Helpers

The first argument is the `bindings` helper, spelled as `cf/config` spells it. Each writes a
declaration with placeholder values, and the last column is what to change before the first
deploy.

| Helper          | Writes                                                                          | Before deploying                                                                                  |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `kv`            | `bindings.kv({ id: "000…" })`                                                   | put the id `cf kv namespaces create --title <name>` prints                                        |
| `d1`            | `bindings.d1({ name: manifest.name, id: "00000000-…" })`                        | give it a name of its own, and put the id `cf d1 create --name <name>` prints                     |
| `r2`            | `bindings.r2({ name: "<key in lower case>" })`                                  | create the bucket with `cf r2 buckets create --name <name>`                                       |
| `queue`         | `bindings.queue({ name: manifest.name })`                                       | give it a queue of its own, created with `cf queues create --queue-name <name>`                   |
| `rateLimit`     | `bindings.rateLimit({ namespace: "1001", simple: { limit: 100, period: 60 } })` | pick a namespace of its own and the limit it allows                                               |
| `sendEmail`     | `bindings.sendEmail()`                                                          | nothing                                                                                           |
| `durableObject` | `bindings.durableObject({ worker, exportName })`, with placeholders             | fill in the Worker that defines the class and the class's exported name                           |
| `secret`        | `bindings.secret()`, and `NAME=` in `.env.example`                              | set its value with `cf workers secrets update`, as [Make a secret](/docs/sdxc/make-secret) covers |

<warning>
The `d1`, `queue` and `rateLimit` helpers start from the values the template's own `DB`, `QUEUE`
and `RATE_LIMITER` use. Deployed as written, the new binding shares that database, that queue or
that rate-limit counter, so give it its own name or namespace first. A queue has exactly one
consumer, and this Worker already consumes the template's for its jobs.
</warning>

An R2 bucket name holds lowercase letters, digits and hyphens, so a key with an underscore, such
as `USER_UPLOADS`, needs its bucket renamed from `user_uploads` to `user-uploads`.

For a Durable Object class this Worker defines, [`sdxc make do`](/docs/sdxc/make-do) writes the
class, its export and a binding with every name filled in; reach for the `durableObject` helper
for a class another Worker defines.

## Names

The key is SCREAMING_SNAKE_CASE. One already in that form is kept as it is, and kebab-case or
camelCase is converted, so `user-uploads` and `userUploads` both declare `USER_UPLOADS`. A key
that holds anything else is refused:

```text
"api.key" is not a binding name
```

The binding is added as the first entry of `env`, so the newest one is on top.

## Flags

| Flag        | What it does                                   |
| ----------- | ---------------------------------------------- |
| `--dry-run` | print the edit as a diff, and change nothing   |
| `--force`   | replace a binding of that key with the new one |

A key `env` already declares stops the run with the file as it was:

```text
CACHE is already declared in cloudflare.config.ts; pass --force to replace it
```

Pass `--force` to swap the binding for a different helper: the old declaration is removed and
the new one is added at the top of `env`. `make binding` edits `cloudflare.config.ts` only, so a
Worker configured in `wrangler.jsonc` stops with `No cloudflare.config.ts in the project`.

## Read it from env

Import `env` from `cloudflare:workers` where the binding is used, in the layer that owns what it
stores. A KV namespace holding a copy of an outside answer is read through a service:

```typescript {% title="app/services/exchange-rates.ts" %}
import { env } from "cloudflare:workers";

/** Stores the rates for an hour, so every page in that hour reads one copy. */
export async function saveRates(rates: Record<string, number>): Promise<void> {
	await env.CACHE.put("rates", JSON.stringify(rates), { expirationTtl: 3600 });
}

/** The stored rates, or `null` once they expired. */
export async function readRates(): Promise<Record<string, number> | null> {
	return await env.CACHE.get<Record<string, number>>("rates", "json");
}
```

## Test it

Vitest imports the app's modules in Node, where `cloudflare:workers` is the stand-in in
`app/test/cloudflare-workers.ts`, and its `env` holds only the bindings listed there. Add the new
one with the mock `@sdxc/cloudflare-mocks` exports for its helper, which the template already
installs: `createKVNamespace()`, `createD1Database()`, `createR2Bucket()`, `createQueue()`,
`createRateLimit()` or `createSendEmail()`.

```typescript {% title="app/test/cloudflare-workers.ts" %}
import {
	createD1Database,
	createKVNamespace,
	createQueue,
	createRateLimit,
	createSendEmail,
} from "@sdxc/cloudflare-mocks";

/** The bindings and secrets the app reads, with their development values. */
export const env = {
	DB: createD1Database(),
	EMAIL: createSendEmail(),
	QUEUE: createQueue(),
	RATE_LIMITER: createRateLimit(),
	SESSIONS: createKVNamespace(),
	CACHE: createKVNamespace(),
	SESSION_SECRET: "development-session-secret",
	HONEYPOT_SECRET: "development-honeypot-secret",
	TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
	TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
} as Partial<Cloudflare.Env> as Cloudflare.Env;
```

A binding left out of the stand-in reads as `undefined`, so a test of code that uses it fails on
the first call. With it there, the service is tested through the same `env` it reads in
production:

```typescript {% title="app/services/exchange-rates.test.ts" %}
import { describe, expect, test } from "vitest";

import { readRates, saveRates } from "~/app/services/exchange-rates";

describe("exchange rates", () => {
	test("reads back the rates it saved", async () => {
		await saveRates({ EUR: 0.92 });

		expect(await readRates()).toEqual({ EUR: 0.92 });
	});
});
```

```bash
bun run test app/services/exchange-rates.test.ts
```

## Where to go next

- [Make a secret](/docs/sdxc/make-secret) — an API key or signing key, declared with its
  development value.
- [Make a Durable Object](/docs/sdxc/make-do) — a class of this Worker with its binding filled
  in.
- [Deploy your app](/docs/getting-started/first-deploy#create-the-resources-the-app-binds) —
  create the resources the bindings name, and write their ids back.
