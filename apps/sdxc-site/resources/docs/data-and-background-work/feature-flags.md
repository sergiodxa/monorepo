---
title: Feature flags
description: Declare flags in a typed catalog, target them by rule or percentage, and evaluate them on ctx.flags in handlers and jobs.
section:
    title: Data & background work
    order: 7
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "How to declare flags in a typed catalog and publish `ctx.flags`"
    - "How to target a flag by rule or percentage and store definitions in KV"
    - "How to evaluate a flag in a handler and test with a pinned flag"
---

A feature flag lets you ship code that is switched off, turn it on for one team, then for ten
percent of everyone, and switch it off again without a deploy if it misbehaves.
[`@sdxc/flags`](/api/flags) is the evaluation API, following the OpenFeature model, and nothing
on its path throws. [`@sdxc/flags-engine`](/api/flags-engine) is a provider you run yourself,
with targeting rules, percentage splits and a store to read definitions from.

```bash
npm add @sdxc/flags @sdxc/flags-engine @sdxc/http @sdxc/logger remix
```

## Write the definitions

A definition names the values a flag can take as variants, and which one to serve by default.
Start with the definitions in code, so flipping a flag gets the review any other change gets:

```typescript {% title="app/initializers/flags.ts" %}
import type { StoredFlagSet } from "@sdxc/flags-engine/store";

export const FLAG_SET: StoredFlagSet = {
	flags: {
		"new-checkout": {
			variants: { on: true, off: false },
			defaultVariant: "off",
		},
		"adhoc-ping-api": {
			variants: { on: true, off: false },
			defaultVariant: "on",
		},
		"digest-batch-size": {
			variants: { small: 20, default: 50, large: 200 },
			defaultVariant: "default",
		},
	},
};
```

## Name them in a catalog

A catalog writes each key, type and default down once, so a misspelled key is a compile error
rather than a flag that is silently off:

```typescript {% title="app/initializers/flags.ts" %}
import { defineFlags, flag } from "@sdxc/flags/catalog";

export const features = defineFlags({
	newCheckout: flag.boolean("new-checkout", false),
	adhocPingApi: flag.boolean("adhoc-ping-api", true),
	digestBatchSize: flag.number("digest-batch-size", 50),
});
```

The default is what a call site gets when nothing resolved, so pick the value that is safe to run
with, which for a new feature is usually off.

## Build the instance

`createFlags` builds the API instance once at module scope. The provider is created lazily, the
first time an evaluation needs it:

```typescript {% title="app/initializers/flags.ts" %}
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { createFlags, wideEventHook } from "@sdxc/flags/client";

export const flags = createFlags({
	provider: () =>
		new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	hooks: [wideEventHook()],
});
```

`wideEventHook()` writes each evaluation's key, variant and reason onto the invocation's log
record.

## Publish `ctx.flags`

The router middleware from `@sdxc/flags/middleware/router` reads the request's subject once and
publishes a client as `ctx.flags`:

> [!NOTE]
> List `featureFlags()` after your auth middleware, so the subject is known, and after `log()`,
> so the hook has a record to write to.

```typescript {% title="app/initializers/router.ts" %}
import featureFlags from "@sdxc/flags/middleware/router";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import { auth, currentUser } from "~/app/http/middleware/auth";
import { flags } from "~/app/initializers/flags";
import { logger } from "~/app/initializers/logger";

export function createWebRouter() {
	return createRouter({
		middleware: [
			log(logger),
			auth(),
			featureFlags(flags, {
				context: (ctx) => ({ targetingKey: currentUser(ctx)?.id }),
			}),
		],
	});
}
```

`auth()` and `currentUser` stand for your own authentication. `targetingKey` is the subject a
percentage split hashes; every other context field is available to targeting by name. Jobs get
the same client through `@sdxc/flags/middleware/dispatcher`.

## Evaluate in a handler

`ctx.flags.get(flag)` takes a catalog entry and answers with its type. When the subject of a
decision is not the request's subject, pass it on the evaluation:

```typescript {% title="app/http/controllers/api/ping.ts" %}
import { serviceUnavailable } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { features } from "~/app/initializers/flags";
import { runPing } from "~/app/services/ping";
import routes from "~/routes/web";

export default createAction(routes.api.ping, async (ctx) => {
	let team = ctx.apiTeam;

	let available = await ctx.flags.get(features.adhocPingApi, {
		context: { targetingKey: team.id, team: { slug: team.slug } },
	});

	if (!available)
		return serviceUnavailable({ detail: "Ad-hoc pings are unavailable" });

	return await runPing(ctx, team);
});
```

An API key belongs to a team, so the team is the subject here, merged over the middleware's
context. Nothing in `get` fails: an unresolved flag answers its default, and
`ctx.flags.details(flag)` reports `reason: "ERROR"` when the flag system itself is broken.

## Target a rule or a percentage

`targeting` is a list of rules, tried in order. The first whose condition holds decides:

```typescript {% title="config/flag-rules.ts" %}
import type { FlagSet } from "@sdxc/flags-engine";

export const RULED_SET: FlagSet = {
	segments: {
		staff: { op: "endsWith", field: "email", value: "@example.com" },
	},
	flags: {
		"new-checkout": {
			variants: { on: true, off: false },
			defaultVariant: "off",
			targeting: [
				{ when: { op: "segment", name: "staff" }, serve: "on" },
				{
					when: { op: "eq", field: "plan.tier", value: "pro" },
					serve: { weights: { on: 10, off: 90 } },
				},
				{ when: { op: "always" }, serve: { weights: { on: 1, off: 99 } } },
			],
		},
	},
};
```

Typing the set as `FlagSet` checks every rule as you write it, and it goes into
`InMemoryFlagStore` the same way. Conditions are the JSON form of
[`@sdxc/expression`](/api/expression); `field` is a dotted path into the context, and segments
like `staff` are conditions declared once and shared by name. A split hashes the subject with the
flag key, so widening `on: 10` to `on: 25` keeps the first ten percent where they were.

> [!WARNING]
> When the context has no `targetingKey`, the split cannot place anyone: the evaluation reports
> `TARGETING_KEY_MISSING` and serves the default, so a rollout that reached nobody reads as one.

## Move definitions into KV

To flip a flag without a deploy, keep the set in Workers KV. `WorkerKVFlagStore` stores the whole
set as one JSON value, and `maxAge` says how long a loaded snapshot counts as current:

```typescript {% title="app/initializers/flag-provider.ts" %}
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";
import { env } from "cloudflare:workers";

let provider: EngineProvider | undefined;

export function flagProvider(): EngineProvider {
	provider ??= new EngineProvider(
		createEngine({
			store: new WorkerKVFlagStore(env.FLAGS),
			maxAge: "5 minutes",
		}),
	);
	return provider;
}
```

Pass `provider: flagProvider` to `createFlags` in place of the in-memory provider. A Worker only
has time while an invocation runs, so schedule reloads yourself: hand
`flagProvider().refresh()` to `waitUntil` behind a response. An admin page writes a new set with
`store.write(set)`.

## Test with a pinned flag

A test builds its own instance, so nothing it sets leaks into the next one:

```typescript {% title="app/initializers/flags.test.ts" %}
import { evaluateAll, parseFlagSet } from "@sdxc/flags-engine";
import { createFlags } from "@sdxc/flags/client";
import { InMemoryProvider } from "@sdxc/flags/provider/memory";
import { expect, test } from "vitest";

import { RULED_SET } from "~/config/flag-rules";

test("a pinned flag answers the pinned value", async () => {
	let flags = createFlags({
		provider: () =>
			new InMemoryProvider({
				"new-checkout": {
					variants: { on: true, off: false },
					defaultVariant: "on",
				},
			}),
	});

	await flags.ready();
	expect(await flags.getClient().boolean("new-checkout", false)).toBe(true);
});

test("staff get the new checkout", () => {
	let served = evaluateAll(parseFlagSet(RULED_SET), {
		targetingKey: "user-1",
		email: "ada@example.com",
	});

	expect(served["new-checkout"]?.value).toBe(true);
});
```

To check a targeting rule rather than a code path, `evaluateAll(parseFlagSet(set), context)`
answers what every flag would serve for a given context, with no store and no engine.

## Where to go next

- [Decide who can do what](/docs/identity-and-security/authorization) — flags as guards over
  the abilities a policy grants.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — evaluating flags
  inside a job.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading evaluations
  off the request's log record.
