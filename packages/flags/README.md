# @sdxc/flags

Feature flag evaluation implementing the OpenFeature specification.

The API follows [OpenFeature](https://openfeature.dev) `v0.9.0`: the flag system is a provider you
hand to an instance you own, the subject travels with each call, and an evaluation that cannot
resolve returns the default it was handed, with the reason on its detailed form.

## Installation

```sh
npm add @sdxc/flags
```

Optional peers, each needed only by the entry point that uses it:
[`remix`](https://www.npmjs.com/package/remix) for the router middleware,
[`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs) for the dispatcher middleware, and
[`vitest`](https://www.npmjs.com/package/vitest) for the conformance suite. Structure flags take
any [Standard Schema](https://standardschema.dev) library; the examples use `remix/data-schema`.

## Usage

### Evaluate a flag

```typescript
import { createFlags } from "@sdxc/flags/client";
import { InMemoryProvider } from "@sdxc/flags/provider/memory";

let flags = createFlags({
	provider: () =>
		new InMemoryProvider({
			"new-checkout": { variants: { on: true, off: false }, defaultVariant: "off" },
		}),
});

let client = flags.getClient();

await client.boolean("new-checkout", false, { targetingKey: "user-1" }); // false

let details = await client.stringDetails("checkout-copy-variant", "control");
details.value; // "control", the default it was handed
details.reason; // "ERROR"
details.errorCode; // "FLAG_NOT_FOUND"
```

Every method is asynchronous and none throws. A structure flag takes a schema, and a value the
schema rejects answers the default with `TYPE_MISMATCH`:

```typescript
import * as s from "remix/data-schema";

let copy = await client.object(
	"checkout-copy",
	{ title: "Checkout", cta: "Pay" },
	{ schema: s.object({ title: s.string(), cta: s.string() }) },
);
```

### Declare a catalog

A catalog writes each key, type and default once, so call sites restate none of them:

```typescript
import { defineFlags, flag } from "@sdxc/flags/catalog";
import * as s from "remix/data-schema";

export let features = defineFlags({
	newCheckout: flag.boolean("new-checkout", false),
	digestBatch: flag.number("digest-batch-size", 50),
	checkoutCopy: flag.object("checkout-copy", s.object({ title: s.string(), cta: s.string() }), {
		title: "Checkout",
		cta: "Pay",
	}),
});

await client.get(features.newCheckout); // Promise<boolean>
await client.get(features.digestBatch, { context: { targetingKey: "team-1" } }); // Promise<number>
await client.get(features.newCheckout, { defaultValue: true }); // a different fallback for this call
await client.details(features.checkoutCopy); // EvaluationDetails<{ title: string; cta: string }>
```

### Install into a fetch router

The middleware reads the request's subject once and publishes a client as `ctx.flags`; importing
it is what types `ctx.flags`.

```typescript
import featureFlags from "@sdxc/flags/middleware/router";
import { createRouter } from "remix/router";

import { flags } from "./flags.ts";

let router = createRouter({
	middleware: [
		featureFlags(flags, {
			context: (ctx) => ({ targetingKey: ctx.request.headers.get("x-user-id") ?? undefined }),
		}),
	],
});

router.get("/checkout", async (ctx) => {
	let enabled = await ctx.flags.boolean("new-checkout", false);
	return new Response(enabled ? "new checkout" : "classic checkout");
});
```

### Install into a job dispatcher

```typescript
import featureFlags from "@sdxc/flags/middleware/dispatcher";
import { createJobDispatcher, createJobHandler } from "@sdxc/jobs";

import { flags } from "./flags.ts";
import { jobs } from "./jobs.ts";

export let dispatcher = createJobDispatcher({
	middleware: [featureFlags(flags, { context: (ctx) => ({ targetingKey: ctx.input.teamId }) })],
});

export default createJobHandler(jobs.sendWeeklyDigest, async (ctx) => {
	if (await ctx.flags.boolean("weekly-digest-v2", false)) return sendV2(ctx.input);
	return sendV1(ctx.input);
});
```

## API

| Entry point                         | Contains                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| `@sdxc/flags`                       | Types only: context, details, reasons, error codes, hooks, events |
| `@sdxc/flags/client`                | `createFlags`, the shipped hooks, the propagator                  |
| `@sdxc/flags/catalog`               | `defineFlags` and `flag`                                          |
| `@sdxc/flags/provider`              | The `Provider` interface and the kit for writing one              |
| `@sdxc/flags/provider/noop`         | `NoopProvider`                                                    |
| `@sdxc/flags/provider/memory`       | `InMemoryProvider`                                                |
| `@sdxc/flags/conformance`           | The Vitest suite a provider runs                                  |
| `@sdxc/flags/middleware`            | The `Flags` context key                                           |
| `@sdxc/flags/middleware/router`     | Middleware for a `remix/router` router                            |
| `@sdxc/flags/middleware/dispatcher` | Middleware for an `@sdxc/jobs` dispatcher                         |

### `createFlags(options?: FlagsOptions): Flags`

Builds an API instance; instances share no providers, context, hooks or handlers. Build it once
at module scope, so its provider initializes once per process rather than once per request.

- `provider`: a function building the default provider, called the first time it is needed.
  Without it, evaluation runs through `NoopProvider`.
- `context`: the global evaluation context.
- `hooks`: hooks around every evaluation the instance makes.
- `handlers`: event handlers by event name, one handler or an array.
- `propagator`: where the transaction context comes from.

### `Flags`

The instance `createFlags` returns.

| Member                                        | Does                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `getClient(domain?, context?)`                | A client for the domain's provider, carrying `context` as its client context     |
| `setProvider(provider)`                       | Sets and initializes the default provider; answers `Result<void, ProviderError>` |
| `setProvider(domain, provider)`               | The same for one domain; clients of other domains keep the default               |
| `setContext(context)`                         | Replaces the global context                                                      |
| `addHooks(...hooks)`                          | Adds API-level hooks                                                             |
| `addHandler(event, handler)`, `removeHandler` | Subscribes to provider events across every domain                                |
| `setTransactionContext(context, callback)`    | Runs `callback` with `context` as the transaction context                        |
| `setTransactionContextPropagator(propagator)` | Replaces the propagator                                                          |
| `providerMetadata(domain?)`                   | The metadata of the provider serving a domain                                    |
| `ready()`                                     | Resolves once every registered provider has initialized                          |
| `shutdown()`                                  | Shuts every provider down and resets the instance; answers a `Result`            |

`Result` comes from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). A context
field set at a later level wins, in this order: global, transaction, client, invocation, then
whatever a `before` hook returns. A field set to `undefined` removes it.

### `Client`

What code evaluates through. `boolean`, `string` and `number` take
`(key, defaultValue, context?, options?)`; `object` takes `(key, defaultValue, options, context?)`,
with `options.schema` required. Each has a `*Details` twin answering `EvaluationDetails<T>`.
`get(flag, options?)` and `details(flag, options?)` evaluate a catalog handle.
`addHooks`, `addHandler` and `removeHandler` work at the client's domain, `track(name, context?,
details?)` forwards an action to the provider's `track`, and `metadata` and `providerStatus`
describe the client.

### `wideEventHook(): Hook`

Sets `feature_flag.key`, `feature_flag.result.reason`, `feature_flag.result.variant`,
`feature_flag.provider.name` and, on failure, `error.type` and `error.message` on the current
wide event from [`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger). Outside a logged
invocation it does nothing.

### `redactHook(fields: string[]): Hook`

Removes the named fields from the context before the provider and later hooks see it.

### `asyncLocalStoragePropagator(): TransactionContextPropagator`

A propagator backed by
[`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage), so code
nested inside `flags.setTransactionContext(...)` evaluates with that context.

### `defineFlags(catalog)` and `flag`

`defineFlags` answers the object of handles it was given with every value type kept.
`flag.boolean(key, defaultValue)`, `flag.string(...)` and `flag.number(...)` build handles;
`flag.object(key, schema, defaultValue)` types the default from the schema.

### `Provider`

```typescript
interface Provider {
	readonly metadata: ProviderMetadata;
	readonly hooks?: Hook[];
	readonly events?: ProviderEvents;
	readonly domainScoped?: boolean;
	resolveBoolean(key, defaultValue, context): MaybePromise<ResolutionDetails<boolean>>;
	resolveString(key, defaultValue, context): MaybePromise<ResolutionDetails<string>>;
	resolveNumber(key, defaultValue, context): MaybePromise<ResolutionDetails<number>>;
	resolveObject(key, defaultValue, context): MaybePromise<ResolutionDetails<JSONValue>>;
	initialize?(context: EvaluationContext, domain?: string): Promise<void>;
	shutdown?(): Promise<void>;
	track?(name: string, context: EvaluationContext, details?: TrackingEventDetails): void;
}
```

Metadata and four resolvers make a working provider. A provider's status follows the events it
emits, so one with `initialize` stays `NOT_READY` until it emits `PROVIDER_READY`.
`domainScoped: true` refuses binding the same instance to a second domain.

### `resolved(value, details?)` and `failed(defaultValue, errorCode, errorMessage?)`

Build a resolver's answer: `resolved` carries a value with its `variant`, `reason` and
`flagMetadata`; `failed` carries the default, the `ErrorCode` and `reason: "ERROR"`.

### `ProviderEvents`

The emitter a provider holds as `events`, with `emit(event, details?)`, `on(event, handler)` and
`off(event, handler)`. A throwing listener leaves the others running.

### `ProviderError`

`new ProviderError(code, message?, options?)`: an `Error` with an `ErrorCode` as `code`. Reject
`initialize` with one; a resolver that throws one reports its `code` instead of `GENERAL`.

### `NoopProvider`

Answers every evaluation with its default and `reason: "DEFAULT"`. It serves an instance with no
provider set and after `shutdown()`.

### `new InMemoryProvider(flags?: FlagSet)`

A provider answering from a `FlagSet` in memory, with the full lifecycle and events.
`putConfiguration(flags)` swaps the set and emits `PROVIDER_CONFIGURATION_CHANGED` naming every
key in the old or new set. A flag resolves with reason `STATIC`, `TARGETING_MATCH` when `contextEvaluator`
names a variant, `DEFAULT` when it names none, and `DISABLED` with the caller's default when
`disabled` is set.

```typescript
interface FlagConfiguration<T extends FlagValue = FlagValue> {
	variants: Record<string, T>;
	defaultVariant: string;
	disabled?: boolean;
	contextEvaluator?: (context: EvaluationContext) => string | undefined;
	flagMetadata?: FlagMetadata;
}

type FlagSet = Record<string, FlagConfiguration>;
```

### `conformance(name, create, options: ConformanceOptions): void`

Registers Vitest tests checking a provider against the specification. `create` builds a fresh
provider per test, and each option turns on the group that needs it:

- `flags`: the `FlagSet` the provider serves, for the resolution checks.
- `lifecycle`: the provider implements `initialize` and `shutdown`.
- `failing`: builds a provider whose `initialize` rejects, for the error-event checks.
- `tracking`: the provider implements `track`.

### `Flags` from `./middleware`

The context key both middlewares publish the client under; `ctx.get(Flags)` reads it where the
`ctx.flags` property is not typed.

### `featureFlags(flags, options?)` from `./middleware/router` and `./middleware/dispatcher`

The default export of each. Awaits `flags.ready()`, then publishes
`flags.getClient(options.domain, await options.context?.(ctx))` as `ctx.flags`. `context` runs
once per request or job run and may be async.

### Types

`FlagValue` is any JSON value and `FlagValueType` names its kind. `EvaluationContext` holds an
optional `targetingKey` plus any JSON or `Date` fields. A provider answers `ResolutionDetails<T>`;
a client answers `EvaluationDetails<T>`, which adds `flagKey` and always has `flagMetadata`.
`Reason` is an open string union (`STATIC`, `DEFAULT`, `TARGETING_MATCH`, `SPLIT`, `CACHED`,
`DISABLED`, `UNKNOWN`, `STALE`, `ERROR`); `ErrorCode` is closed (`PROVIDER_NOT_READY`,
`PROVIDER_FATAL`, `FLAG_NOT_FOUND`, `PARSE_ERROR`, `TYPE_MISMATCH`, `TARGETING_KEY_MISSING`,
`INVALID_CONTEXT`, `GENERAL`). `Flag<T>` and `FlagOptions<T>` are a catalog handle and its
per-call options; `EvaluationOptions` and `ObjectEvaluationOptions<T>` carry per-call `hooks`,
`hints` and the required `schema`. `Hook`, `HookContext`, `HookData`, `HookHints` and
`HookStage` describe hooks. `ProviderStatus`, `ProviderEvent`, `ProviderEventDetails`,
`EventDetails`, `EventHandler` and `ProviderEventHandler` describe events.
`ClientMetadata`, `ProviderMetadata`, `FlagMetadata` and `EventMetadata` identify clients,
providers, resolved flags and events. `TrackingEventDetails` is what `track` attaches, with an
optional numeric `value`. `ResolvedDetails<T>`, `FlagsOptions`, `TransactionContextPropagator`,
`FeatureFlagsOptions` and `MaybePromise<T>` are the shapes the functions above take.

## Pattern: A Provider Against A Flag Service

The provider fetches its rules in `initialize`, emits `PROVIDER_READY`, and answers each
resolver with `resolved` or `failed`. The conformance suite checks it in a Vitest file.

```typescript
import type { FlagValue, ResolutionDetails } from "@sdxc/flags";
import type { Provider } from "@sdxc/flags/provider";

import { failed, ProviderError, ProviderEvents, resolved } from "@sdxc/flags/provider";
import * as s from "remix/data-schema";

let RuleSchema = s.object({ value: s.boolean(), variant: s.string() });

export class ServiceProvider implements Provider {
	readonly metadata = { name: "flag-service" };
	readonly events = new ProviderEvents();

	#endpoint: string;
	#rules = new Map<string, { value: boolean; variant: string }>();

	constructor(endpoint = "https://flags.example.com/rules") {
		this.#endpoint = endpoint;
	}

	async initialize(): Promise<void> {
		let response = await fetch(this.#endpoint);
		if (!response.ok) {
			let message = `The flag service answered ${response.status}.`;
			this.events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL", message });
			throw new ProviderError("PROVIDER_FATAL", message);
		}
		for (let [key, rule] of Object.entries(await response.json())) {
			this.#rules.set(key, s.parse(RuleSchema, rule));
		}
		this.events.emit("PROVIDER_READY");
	}

	resolveBoolean(key: string, defaultValue: boolean): ResolutionDetails<boolean> {
		let rule = this.#rules.get(key);
		if (!rule) return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named "${key}".`);
		return resolved(rule.value, { variant: rule.variant, reason: "STATIC" });
	}

	resolveString(key: string, defaultValue: string): ResolutionDetails<string> {
		return this.#booleansOnly(key, defaultValue);
	}

	resolveNumber(key: string, defaultValue: number): ResolutionDetails<number> {
		return this.#booleansOnly(key, defaultValue);
	}

	resolveObject(key: string, defaultValue: FlagValue): ResolutionDetails<FlagValue> {
		return this.#booleansOnly(key, defaultValue);
	}

	#booleansOnly<T extends FlagValue>(key: string, defaultValue: T): ResolutionDetails<T> {
		return failed(defaultValue, this.#rules.has(key) ? "TYPE_MISMATCH" : "FLAG_NOT_FOUND");
	}
}
```

```typescript
import { conformance } from "@sdxc/flags/conformance";

import { ServiceProvider } from "./service-provider.ts";

conformance("flag-service", () => new ServiceProvider(), {
	lifecycle: true,
	failing: () => new ServiceProvider("https://flags.example.com/missing"),
});
```

## Pattern: Pinning Flags In A Test

A test builds its own instance and pins flags through `InMemoryProvider`, with targeting written
as a function; `putConfiguration` changes them mid-test.

```typescript
import { createFlags } from "@sdxc/flags/client";
import { InMemoryProvider } from "@sdxc/flags/provider/memory";
import { expect, test } from "vitest";

test("serves the new checkout to the enrolled team", async () => {
	let provider = new InMemoryProvider({
		"new-checkout": {
			variants: { on: true, off: false },
			defaultVariant: "off",
			contextEvaluator: (context) => (context.targetingKey === "team-1" ? "on" : undefined),
		},
	});
	let flags = createFlags({ provider: () => provider });
	await flags.ready();

	let client = flags.getClient(undefined, { targetingKey: "team-1" });
	expect(await client.boolean("new-checkout", false)).toBe(true);
	expect(await client.boolean("new-checkout", false, { targetingKey: "team-2" })).toBe(false);

	provider.putConfiguration({
		"new-checkout": { variants: { on: true, off: false }, defaultVariant: "off", disabled: true },
	});
	expect((await client.booleanDetails("new-checkout", false)).reason).toBe("DISABLED");
});
```

## Pattern: Context At Every Level

The global context names the service, the router middleware names the request's subject, a
transaction context adds what is learned mid-request, and a call can override any of it.

```typescript
import { asyncLocalStoragePropagator, createFlags } from "@sdxc/flags/client";
import featureFlags from "@sdxc/flags/middleware/router";
import { createRouter } from "remix/router";

import { ServiceProvider } from "./service-provider.ts";

export let flags = createFlags({
	provider: () => new ServiceProvider(),
	context: { service: "checkout" },
	propagator: asyncLocalStoragePropagator(),
});

let router = createRouter({
	middleware: [
		featureFlags(flags, {
			context: (ctx) => ({ targetingKey: ctx.request.headers.get("x-user-id") ?? undefined }),
		}),
	],
});

router.post("/orders", async (ctx) => {
	let plan = await planFor(ctx.request);
	return flags.setTransactionContext({ plan }, async () => {
		let express = await ctx.flags.boolean("express-shipping", false); // sees service, user and plan
		let forOwner = await ctx.flags.boolean("express-shipping", false, { targetingKey: "owner-1" });
		return Response.json({ express, forOwner });
	});
});
```

## Pattern: Separate Providers Per Domain

A domain binds its own provider, so one area of an application can read flags from another
system while everything else keeps the default.

```typescript
import { createFlags } from "@sdxc/flags/client";
import { InMemoryProvider } from "@sdxc/flags/provider/memory";
import featureFlags from "@sdxc/flags/middleware/router";
import { isFailure } from "@sdxc/result";

import { ServiceProvider } from "./service-provider.ts";

export let flags = createFlags({ provider: () => new ServiceProvider() });

let outcome = await flags.setProvider(
	"marketing",
	new InMemoryProvider({ "hero-copy": { variants: { a: "Hello", b: "Hi" }, defaultVariant: "a" } }),
);
if (isFailure(outcome)) throw outcome.error;

let marketing = flags.getClient("marketing");
await marketing.string("hero-copy", "Welcome"); // "Hello"
flags.providerMetadata("marketing").name; // "in-memory"

let middleware = featureFlags(flags, { domain: "marketing" }); // ctx.flags reads the same provider
```

## Pattern: Reacting To Provider Status

`ERROR` and `DEFAULT` read differently: one is a flag system that is down, the other a flag with
nothing to serve. Handlers and `providerStatus` surface the first.

```typescript
import { createFlags } from "@sdxc/flags/client";

import { ServiceProvider } from "./service-provider.ts";

export let flags = createFlags({
	provider: () => new ServiceProvider(),
	handlers: {
		PROVIDER_ERROR: (details) => alert(`${details.providerName}: ${details.message}`),
		PROVIDER_CONFIGURATION_CHANGED: (details) => invalidate(details.flagsChanged ?? []),
	},
});

let client = flags.getClient();
let details = await client.booleanDetails("new-checkout", false);
if (details.reason === "ERROR" && client.providerStatus !== "READY") {
	degraded(details.errorCode, details.errorMessage);
}

client.track("checkout-completed", { targetingKey: "user-1" }, { value: 42.5 });
```

## Pattern: Redacted Context And Wide-Event Records

API-level hooks run around every evaluation: `redactHook` strips fields before a third-party
provider sees them, and `wideEventHook` records each evaluation on the request's wide event.
List the logger middleware before the flags middleware so there is an event to write to.

```typescript
import type { Hook } from "@sdxc/flags";

import { createFlags, redactHook, wideEventHook } from "@sdxc/flags/client";
import featureFlags from "@sdxc/flags/middleware/router";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import { ServiceProvider } from "./service-provider.ts";

let timing: Hook = {
	before(hook) {
		hook.hookData.set("start", performance.now());
	},
	finally(hook) {
		let start = hook.hookData.get("start") as number;
		recordLatency(hook.flagKey, performance.now() - start);
	},
};

export let flags = createFlags({
	provider: () => new ServiceProvider(),
	hooks: [redactHook(["email", "ip"]), wideEventHook(), timing],
});

let router = createRouter({
	middleware: [log(createLogger({ service: "checkout" })), featureFlags(flags)],
});
```

`before` hooks run API, client, invocation, then provider hooks; `after`, `error` and `finally`
run in reverse, and each hook's `hookData` belongs to it alone.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written
`YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out
per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/flags": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later
release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
