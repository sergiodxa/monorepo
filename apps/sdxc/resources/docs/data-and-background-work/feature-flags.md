---
title: Feature flags
description: Declare flags in a typed catalog, target them by rule or percentage, and evaluate them on ctx.flags in handlers and jobs.
section:
    title: Data & background work
    order: 6
order: 5
lastUpdated: 2026-09-29
---

A feature flag lets you ship code that is switched off, turn it on for one team, then for ten
percent of everyone, and switch it off again without a deploy if it misbehaves. This guide builds
that from two packages. [`@sdxc/flags`](/api/flags) is the evaluation API, following the
OpenFeature model: a provider resolves flags, a client evaluates them, and nothing on that path
throws. [`@sdxc/flags-engine`](/api/flags-engine) is a provider you run yourself, with targeting
rules, percentage splits and a store to read definitions from.

```bash
npm add @sdxc/flags @sdxc/flags-engine
```

## Write the definitions

A definition names the values a flag can take as variants, and which one to serve by default.
Start with the definitions in code: flipping a flag is then an edit and a deploy, with the review
any other change gets.

```typescript {% title="app/lib/flags.ts" %}
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

A key missing from the set resolves to the default its call site passed, so retiring a flag is
deleting its entry, then its branch.

## Name them in a catalog

Call sites should not repeat a key, a type and a default. A catalog writes each down once, so a
misspelled key is a compile error rather than a flag that is silently off:

```typescript {% title="app/lib/flags.ts" %}
import { defineFlags, flag } from "@sdxc/flags/catalog";

export const features = defineFlags({
	newCheckout: flag.boolean("new-checkout", false),
	adhocPingApi: flag.boolean("adhoc-ping-api", true),
	digestBatchSize: flag.number("digest-batch-size", 50),
});
```

The default here is what a call site gets when nothing resolved: no definition, a provider that
failed to load, a variant of the wrong type. Pick the value that is safe to run with, which for a
new feature is usually off. `flag.string` and `flag.object` cover the other two types; an object
flag takes a `remix/data-schema` schema, because its value arrives from storage and is checked
before your code sees it.

## Build the instance

`createFlags` builds the API instance. Build it once at module scope, since a provider built per
request would initialize on every one. The provider itself is created lazily, the first time an
evaluation needs it, so loading the module in a Worker does no work:

```typescript {% title="app/lib/flags.ts" %}
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
record, so "which variant did this request get" is a field on the same record as its status and
duration, and evaluating a flag adds no log lines of its own.

## Publish `ctx.flags`

The router middleware from `@sdxc/flags/middleware/router` reads the request's subject once and
publishes a client as `ctx.flags`. List it after your auth middleware, so the subject is known,
and after `log()`, so the hook has a record to write to:

```typescript {% title="app/router.ts" %}
import featureFlags from "@sdxc/flags/middleware/router";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import { auth, currentUser } from "~/app/http/middleware/auth";
import { flags } from "~/app/lib/flags";
import { logger } from "~/app/logger";

export default createRouter({
	middleware: [
		log(logger),
		auth(),
		featureFlags(flags, {
			context: (ctx) => ({ targetingKey: currentUser(ctx)?.id }),
		}),
	],
});
```

Here `auth()` stands for your own authentication middleware and `currentUser` for however you
read the user it published.

`targetingKey` is the subject: what a percentage split hashes and what a per-user rule matches.
Every other field on the context is a fact about that subject or the request, available to
targeting by name.

Jobs get the same client through `@sdxc/flags/middleware/dispatcher`, added to the dispatcher's
middleware chain. There is no signed-in user in a job, so name the subject it acts for, such as
`featureFlags(flags, { context: (ctx) => ({ targetingKey: ctx.name }) })` for the job's own name.

## Evaluate in a handler

`ctx.flags.get(flag)` takes a catalog entry and answers with its type. When the subject of a
decision is not the request's subject, pass it on the evaluation:

```typescript {% title="app/http/controllers/api/ping.ts" %}
import { serviceUnavailable } from "@sdxc/http/response/json";
import { createAction } from "remix/router";

import { features } from "~/app/lib/flags";
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

`ctx.apiTeam` is whatever your API-key middleware published, and `runPing` your own service. An
API key belongs to a team rather than a user, so the team is the subject, and a rule written
against `team.slug` closes the endpoint for one caller while everyone else keeps it. Invocation
context merges over the middleware's, so the rest of the request's facts are still there.

Nothing in `get` fails. When a flag cannot be resolved, it answers with the default, and
`ctx.flags.details(flag)` tells you why: its `reason` is `DEFAULT` when nothing matched and
`ERROR`, with an `errorCode`, when the flag system itself is broken. That is the difference
between a flag that is off and flags that are down.

## Target a rule or a percentage

`targeting` is a list of rules, tried in order. The first whose condition holds decides:

```typescript {% title="app/lib/flag-rules.ts" %}
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

Typing the set as `FlagSet` rather than `StoredFlagSet` checks every rule as you write it. It is
still a `StoredFlagSet`, so it goes into `InMemoryFlagStore` the same way.

Conditions are a typed union, so an editor completes `op` rather than you learning an expression
language: `eq`, `in`, `lt`, `startsWith`, `matches`, `semver`, `exists`, and `all`, `any` and
`not` to combine them. `field` is a dotted path into the context. A path that resolves to nothing
makes every operator except `exists` false, so a rule about a field the caller left out never
matches everyone.

Segments are conditions declared once under the set's `segments` and referenced by name, like
`staff` above. Twenty flags can then share one definition of who counts as staff.

A split hashes the subject with the flag key, so a subject lands in the same arm on every request
in every isolate, and widening `on: 10` to `on: 25` keeps the first ten percent where they were.
When the context has no `targetingKey`, the split cannot place anyone: the evaluation reports
`TARGETING_KEY_MISSING` and serves the default, so a rollout that reached nobody reads as one.

## Move definitions into KV

When you want to flip a flag without a deploy, keep the set in Workers KV. `WorkerKVFlagStore`
stores the whole set as one JSON value, and `maxAge` says how long a loaded snapshot counts as
current:

```typescript {% title="app/lib/flag-provider.ts" %}
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

In `app/lib/flags.ts`, pass `provider: flagProvider` to `createFlags` in place of the in-memory
provider. Reloading is yours to schedule, because a Worker only has time while an invocation is
running.
`flagProvider().refresh()` reads the store again and answers with a `Result`, so hand it to
`waitUntil` behind a response and log a failure rather than failing the request. An admin page
writes a new set with `store.write(set)`, and validates an edit first against
`FLAG_DEFINITION_SCHEMA`, the same schema the engine parses with.

## Test with a pinned flag

A test builds its own instance, so nothing it sets leaks into the next one:

```typescript {% title="app/lib/flags.test.ts" %}
import { evaluateAll, parseFlagSet } from "@sdxc/flags-engine";
import { createFlags } from "@sdxc/flags/client";
import { InMemoryProvider } from "@sdxc/flags/provider/memory";
import { expect, test } from "vitest";

import { RULED_SET } from "~/app/lib/flag-rules";

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

Hand a pinned instance to the app the test drives. To check a targeting rule rather than a code
path, the second test uses evaluation as the pure function it is: `evaluateAll(parseFlagSet(set),
context)` answers what every flag would serve for a given context, with no store and no engine.

## Where to go next

- [Wire the router: middleware, context and services](/docs/building-remix-apps/wire-the-router)
  — where `ctx.flags` sits in the middleware order.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — evaluating flags
  inside a job.
- [Logs, traces and timings](/docs/operations-and-testing/observability) — reading evaluations
  off the request's log record.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers) — the same KV
  namespace pattern for values.
