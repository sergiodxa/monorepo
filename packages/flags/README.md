# @sdxc/flags

Feature flag evaluation implementing the OpenFeature specification.

The API is [OpenFeature](https://openfeature.dev) `v0.9.0`, so a flag system is a constructor
argument rather than a name in your call sites. Nothing on the evaluation path throws: an
evaluation that cannot resolve returns the default it was handed and carries the reason on its
detailed form.

Evaluation is dynamic-context, so the subject travels with the call instead of being set
globally, and there is no singleton — `createFlags()` builds an instance your application owns.

## Installation

```bash
npm add @sdxc/flags
```

Three optional peers, each needed only by the part that uses it:
[`remix`](https://www.npmjs.com/package/remix) for the router middleware and for the
`remix/data-schema` schemas the examples write structures with,
[`@sdxc/jobs`](https://www.npmjs.com/package/@sdxc/jobs) for the dispatcher middleware, and
[`vitest`](https://www.npmjs.com/package/vitest) for the conformance suite. Any
[Standard Schema](https://standardschema.dev) library works in place of `remix/data-schema`.

## Usage

### Evaluating a flag

An instance owns the providers, the global context, the hooks and the handlers; a client is
what code evaluates through. Nothing throws, and every method is asynchronous whether or not
the provider had to await anything:

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
details.value; // "control" — the default it was handed
details.reason; // "ERROR", with details.errorCode "FLAG_NOT_FOUND"
```

### Declaring a catalog

A catalog writes every key, type and default down once, so a call site restates none of them
and a misspelled key is not expressible:

```typescript
import { defineFlags, flag } from "@sdxc/flags/catalog";
import * as s from "remix/data-schema";

let CopySchema = s.object({ title: s.string(), cta: s.string() });

export let features = defineFlags({
	newCheckout: flag.boolean("new-checkout", false),
	digestBatch: flag.number("digest-batch-size", 50),
	checkoutCopy: flag.object("checkout-copy", CopySchema, { title: "Checkout", cta: "Pay" }),
});

await client.get(features.newCheckout); // Promise<boolean>
await client.get(features.digestBatch, { context: { targetingKey: "team-1" } }); // Promise<number>
await client.get(features.newCheckout, { defaultValue: true }); // a safer fallback here only
```

### Installing into a fetch router

The middleware reads the request's subject once and publishes the client as `ctx.flags`:

```typescript
import featureFlags from "@sdxc/flags/middleware/router";
import { createRouter } from "remix/router";

import { flags } from "./flags.ts";

let router = createRouter({
	middleware: [
		featureFlags(flags, {
			context(ctx) {
				return { targetingKey: ctx.session.get("userId"), country: ctx.request.cf?.country };
			},
		}),
	],
});

router.get("/checkout", async (ctx) => {
	if (await ctx.flags.boolean("new-checkout", false)) return ctx.render(NewCheckoutView, {});
	return ctx.render(CheckoutView, {});
});
```

Importing the middleware is what types `ctx.flags`, because it augments `RequestContext` from
its own module rather than from an ambient declaration.

### Installing into a job dispatcher

```typescript
import featureFlags from "@sdxc/flags/middleware/dispatcher";
import { createJobDispatcher, createJobHandler } from "@sdxc/jobs";

import { flags } from "./flags.ts";

export let dispatcher = createJobDispatcher({
	logger,
	middleware: [featureFlags(flags, { context: (ctx) => ({ targetingKey: ctx.get(Team).id }) })],
	queue,
});

export default createJobHandler(jobs.sendWeeklyDigest, async (ctx) => {
	if (await ctx.flags.boolean("weekly-digest-v2", false)) return sendV2(ctx);
	return sendV1(ctx);
});
```

The dispatcher types `ctx.flags` from the effect this middleware declares, folded out of the
chain it was listed in.

## API

The entry points split along the job being done, so an application that only evaluates flags
imports `/client` and one middleware and ships none of the authoring kit, the test provider or
the suite.

| Entry point                         | Contains                                                       |
| ----------------------------------- | -------------------------------------------------------------- |
| `@sdxc/flags`                       | The shared vocabulary: context, details, error codes, reasons  |
| `@sdxc/flags/client`                | `createFlags`, the instance, the propagator, the shipped hooks |
| `@sdxc/flags/catalog`               | `defineFlags` and the `flag.*` handles                         |
| `@sdxc/flags/provider`              | The `Provider` interface and the kit for writing one           |
| `@sdxc/flags/provider/noop`         | `NoopProvider`                                                 |
| `@sdxc/flags/provider/memory`       | `InMemoryProvider`                                             |
| `@sdxc/flags/conformance`           | The suite every provider runs                                  |
| `@sdxc/flags/middleware`            | The `Flags` context key both middlewares publish to            |
| `@sdxc/flags/middleware/router`     | The middleware for a `remix/router` fetch router               |
| `@sdxc/flags/middleware/dispatcher` | The middleware for a job dispatcher                            |

### `@sdxc/flags`

The vocabulary, as types only, so importing it to write a signature emits no runtime code.

#### `FlagValue` and `FlagValueType`

```typescript
type FlagValue = JSONValue;
type FlagValueType = "boolean" | "string" | "number" | "object";
```

The four types a flag evaluates to, which together are exactly what JSON holds, and the name
of whichever evaluation produced a value. `JSONValue` comes from
[`@sdxc/types`](https://www.npmjs.com/package/@sdxc/types).

#### `EvaluationContext`

```typescript
interface EvaluationContext {
	targetingKey?: string;
	[field: string]: Date | JSONValue | undefined;
}
```

What targeting reads. `targetingKey` is the subject a percentage rollout hashes and a per-user
rule matches; every other field is a fact about that subject or about the request it arrived
on.

#### `ResolutionDetails<T>` and `EvaluationDetails<T>`

```typescript
interface ResolutionDetails<T extends FlagValue> {
	value: T;
	variant?: string;
	reason?: Reason;
	errorCode?: ErrorCode;
	errorMessage?: string;
	flagMetadata?: FlagMetadata;
}

interface EvaluationDetails<T extends FlagValue> extends ResolutionDetails<T> {
	flagKey: string;
	flagMetadata: FlagMetadata;
}
```

A provider answers with the first and an application reads the second: the client adds the key
it was asked for and fills in the metadata the provider left out, so a reader never guards
against its absence.

#### `Reason`

```typescript
type Reason =
	| "STATIC"
	| "DEFAULT"
	| "TARGETING_MATCH"
	| "SPLIT"
	| "CACHED"
	| "DISABLED"
	| "UNKNOWN"
	| "STALE"
	| "ERROR"
	| (string & {});
```

Why a flag resolved to the value it did, and worth branching on: `DEFAULT` means nothing
resolved the flag while `ERROR` means something tried and failed, which is the difference
between a flag that is off and a flag system that is down. The set stays open, so a provider's
own reason still type-checks while the enumerated ones complete in an editor.

#### `ErrorCode`

```typescript
type ErrorCode =
	| "PROVIDER_NOT_READY"
	| "PROVIDER_FATAL"
	| "FLAG_NOT_FOUND"
	| "PARSE_ERROR"
	| "TYPE_MISMATCH"
	| "TARGETING_KEY_MISSING"
	| "INVALID_CONTEXT"
	| "GENERAL";
```

Why an evaluation ended in the default value. The set is closed, so a consumer branches on it
exhaustively.

#### `Client`

```typescript
interface Client {
	readonly metadata: ClientMetadata;
	readonly providerStatus: ProviderStatus;

	boolean(key, defaultValue, context?, options?): Promise<boolean>;
	string(key, defaultValue, context?, options?): Promise<string>;
	number(key, defaultValue, context?, options?): Promise<number>;
	object<T>(key, defaultValue, options: ObjectEvaluationOptions<T>, context?): Promise<T>;

	booleanDetails(key, defaultValue, context?, options?): Promise<EvaluationDetails<boolean>>;
	stringDetails(key, defaultValue, context?, options?): Promise<EvaluationDetails<string>>;
	numberDetails(key, defaultValue, context?, options?): Promise<EvaluationDetails<number>>;
	objectDetails<T>(key, defaultValue, options, context?): Promise<EvaluationDetails<T>>;

	get<T extends FlagValue>(flag: Flag<T>, options?: FlagOptions<T>): Promise<T>;
	details<T extends FlagValue>(
		flag: Flag<T>,
		options?: FlagOptions<T>,
	): Promise<EvaluationDetails<T>>;

	addHooks(...hooks: Hook[]): void;
	addHandler(event: ProviderEvent, handler: EventHandler): void;
	removeHandler(event: ProviderEvent, handler: EventHandler): void;
	track(name: string, context?: EvaluationContext, details?: TrackingEventDetails): void;
}
```

What a handler evaluates through. Nothing here throws. The structure methods take their
required `options` third, ahead of the optional context, because the schema it carries is what
makes a structure checked rather than cast:

```typescript
let copy = await client.object(
	"checkout-copy",
	{ title: "Checkout", cta: "Pay" },
	{ schema: s.object({ title: s.string(), cta: s.string() }) },
);
```

#### `Flag<T>` and `FlagOptions<T>`

```typescript
interface Flag<T extends FlagValue> {
	readonly key: string;
	readonly type: FlagValueType;
	readonly defaultValue: T;
	readonly schema?: StandardSchemaV1<unknown, T>;
}

interface FlagOptions<T extends FlagValue> extends EvaluationOptions {
	defaultValue?: T;
	context?: EvaluationContext;
}
```

A flag as a catalog declares it, and what one evaluation of that handle may change.

#### `EvaluationOptions` and `ObjectEvaluationOptions<T>`

```typescript
interface EvaluationOptions {
	hooks?: Hook[];
	hints?: HookHints;
}

interface ObjectEvaluationOptions<T extends FlagValue> extends EvaluationOptions {
	schema: StandardSchemaV1<unknown, T>;
}
```

Per-invocation hooks, which run after the configured ones, and the hints every hook receives.
The schema is required on a structure evaluation, because an unchecked cast on a value that
arrived over a network is what the check exists to prevent, and an optional check is one
nobody adds.

#### `Hook`, `HookContext`, `HookData`, `HookHints`, `HookStage`

```typescript
interface Hook {
	before?(context: HookContext, hints: HookHints): MaybePromise<EvaluationContext | void>;
	after?(
		context: HookContext,
		details: EvaluationDetails<FlagValue>,
		hints: HookHints,
	): MaybePromise<void>;
	error?(context: HookContext, error: unknown, hints: HookHints): MaybePromise<void>;
	finally?(
		context: HookContext,
		details: EvaluationDetails<FlagValue>,
		hints: HookHints,
	): MaybePromise<void>;
}
```

Arbitrary behavior around an evaluation. `before` runs API, then client, then invocation, then
provider hooks, and the other three run in the exact reverse; register a hook at the level it
belongs to, since an API hook covers every evaluation, a client hook covers one domain and an
invocation hook covers one call. A context returned from `before` merges in at the highest
precedence there is. `HookContext` carries the key, the value type, the default, the merged
context, both metadata structures, and a `HookData` map belonging to that hook alone.

#### `ProviderStatus`, `ProviderEvent` and the event structures

```typescript
type ProviderStatus = "NOT_READY" | "READY" | "ERROR" | "STALE" | "FATAL";
type ProviderEvent =
	"PROVIDER_READY" | "PROVIDER_ERROR" | "PROVIDER_CONFIGURATION_CHANGED" | "PROVIDER_STALE";

interface ProviderEventDetails {
	flagsChanged?: string[];
	message?: string;
	errorCode?: ErrorCode;
	eventMetadata?: EventMetadata;
}

interface EventDetails extends ProviderEventDetails {
	providerName: string;
}

type EventHandler = (details: EventDetails) => void;
```

Status is read from what a provider announces, never inferred from a lifecycle call, which is
what makes an outage readable as an outage rather than as every flag being off. A provider
that implements `initialize` without emitting `PROVIDER_READY` therefore stays `NOT_READY`.
`ERROR` is recoverable and `FATAL` is not. A handler that throws does not stop the others.

#### `ClientMetadata`, `ProviderMetadata`, `FlagMetadata`, `EventMetadata`

```typescript
interface ClientMetadata {
	readonly domain?: string;
}

interface ProviderMetadata {
	readonly name: string;
}

type FlagMetadata = Record<string, string | number | boolean>;
type EventMetadata = Record<string, string | number | boolean>;
```

How a client and a provider identify themselves, and the arbitrary properties a provider
attaches to a resolved flag — `contextId`, `flagSetId` and `version` are the three an
observability integration reads. The client passes through whatever arrives and invents
nothing.

#### `TrackingEventDetails`

```typescript
interface TrackingEventDetails {
	value?: number;
	[field: string]: JSONValue | undefined;
}
```

What an application attaches to an action it wants measured against the flags a subject saw.
`value` is the scalar an analytics backend maps to its own numeric field.

#### `MaybePromise<T>`

```typescript
type MaybePromise<T> = T | Promise<T>;
```

A value that may already be there, so an implementation answering from memory allocates no
promise to report what it already knows.

### `@sdxc/flags/client`

#### `createFlags(options?: FlagsOptions): Flags`

Builds an API instance. There is no global singleton, so two instances share no providers, no
context and no handlers, and a test that sets a provider cannot reach the next one. Build it
at module scope: an instance created inside a request would re-initialize its provider on
every one, which is why the middlewares take the instance as an argument.

```typescript
export let flags = createFlags({
	provider: () => new ServiceProvider(),
	context: { service: "checkout" },
	hooks: [wideEventHook()],
	handlers: { PROVIDER_ERROR: (details) => report(details.message) },
	propagator: asyncLocalStoragePropagator(),
});
```

- `options.provider` — builds the default provider, called the first time an evaluation needs
  it so startup constructs nothing it may not use.
- `options.context` — the global evaluation context, lowest of the merge levels.
- `options.hooks` — API-level hooks, which run around every evaluation this instance makes.
- `options.handlers` — event handlers by event, each one handler or an array of them.
- `options.propagator` — where the transaction level of the context merge comes from.

#### `Flags`

```typescript
interface Flags {
	providerMetadata(domain?: string): ProviderMetadata;
	getClient(domain?: string, context?: EvaluationContext): Client;
	setProvider(provider: Provider): Promise<Result<void, ProviderError>>;
	setProvider(domain: string, provider: Provider): Promise<Result<void, ProviderError>>;
	setContext(context: EvaluationContext): void;
	addHooks(...hooks: Hook[]): void;
	addHandler(event: ProviderEvent, handler: EventHandler): void;
	removeHandler(event: ProviderEvent, handler: EventHandler): void;
	setTransactionContextPropagator(propagator: TransactionContextPropagator): void;
	setTransactionContext<T>(context: EvaluationContext, callback: () => T): T;
	ready(): Promise<void>;
	shutdown(): Promise<Result<void, ProviderError>>;
}
```

The API instance `createFlags` returns. `getClient` with a context returns a client carrying it
as the client merge level, which is how a request publishes its subject. `ready()` awaits the
initialization of every registered provider, which is what a middleware awaits on an isolate's
first request, and `shutdown()` returns the instance to how it started, which is what makes one
reusable between tests. `setProvider` and `shutdown` answer with a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) rather than throwing. `ready()`
resolves to nothing, because `setProvider` initializes the provider it registers and hands its
caller that outcome; a later `ready()` awaits the same memoized answer. Nothing on the
evaluation path returns a `Result` either, because nothing there fails.

```typescript
let outcome = await flags.setProvider("marketing", new ServiceProvider());
if (isFailure(outcome)) report(outcome.error.message);
```

#### `FlagsOptions`

The options `createFlags` takes, listed above.

#### `wideEventHook(): Hook`

A `finally` hook that attaches the key, reason, variant, provider and — when it failed — the
error to the wide event of the invocation the evaluation ran inside, under the attribute names
an OpenTelemetry feature-flag record is read with. The event comes from
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger); outside an invocation there is no
log and the hook does nothing.

```typescript
let flags = createFlags({ provider, hooks: [wideEventHook()] });
```

#### `redactHook(fields: string[]): Hook`

A `before` hook that removes named fields from the context, so nothing a resolver or a later
hook sees carries them.

```typescript
let flags = createFlags({ provider, hooks: [redactHook(["email", "ip"])] });
```

#### `asyncLocalStoragePropagator(): TransactionContextPropagator`

The propagator backed by
[`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage), which
is what lets a nested call see context an outer one set without threading it through every
signature in between.

```typescript
flags.setTransactionContext({ targetingKey: user.id }, () => next());
```

#### `TransactionContextPropagator`

```typescript
interface TransactionContextPropagator {
	getTransactionContext(): EvaluationContext | undefined;
	setTransactionContext<T>(context: EvaluationContext, callback: () => T): T;
}
```

The contract an API instance calls for the transaction level of the merge, for code that
learns something about the subject halfway through a request.

### `@sdxc/flags/catalog`

#### `defineFlags(catalog)`

Hands back the object of `Flag<T>` handles it was given, with every value type preserved, so
the application's flags are one named thing a call site reaches into.

```typescript
export let features = defineFlags({ newCheckout: flag.boolean("new-checkout", false) });
```

#### `flag.boolean(key, defaultValue)`, `flag.string(key, defaultValue)`, `flag.number(key, defaultValue)`

Builds a handle carrying the key the flag management system knows the flag by, the type, and
what every evaluation falls back to. Pass it to `client.get` or `client.details`.

#### `flag.object(key, schema, defaultValue)`

Builds a structure handle, with the schema written once here instead of at every call site.
The schema comes second because it is what types the default: a structure the schema would
reject is a compile error here rather than a `TYPE_MISMATCH` in production.

```typescript
flag.object("checkout-copy", CopySchema, { title: "Checkout", cta: "Pay" });
```

### `@sdxc/flags/provider`

#### `Provider`

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

What supplies flag values. Metadata and four resolvers is a working provider; hooks, events,
lifecycle and tracking are each opt-in. A resolver is handed the key, the default value and
the merged context, and answers with a details structure rather than throwing. `domainScoped`
declares that the instance keys state on the one domain it is bound to, so the API refuses to
bind it to a second.

#### `resolved<T>(value: T, details?: ResolvedDetails<T>): ResolutionDetails<T>`

Answers with a value the provider actually resolved, plus the variant, reason and flag metadata
that go with it. The error fields are not accepted here at all, which is how normal execution
stays free of them.

```typescript
return resolved(rule.value, { variant: rule.variant, reason: "STATIC" });
```

#### `failed<T>(defaultValue: T, errorCode: ErrorCode, errorMessage?: string): ResolutionDetails<T>`

Answers with the default value the resolver was handed, and says why it could not do better.
The reason is always `ERROR`, so a caller reading reasons and one reading codes reach the same
conclusion.

```typescript
return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named ${key}`);
```

#### `ProviderEvents`

The typed emitter a provider holds as a field and announces its status transitions on, with
`emit(event, details?)`, `on(event, handler)` and `off(event, handler)`. A listener that throws
is on its own: the remaining listeners still run.

```typescript
this.events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL", message });
```

#### `ProviderError`

An `Error` carrying an `ErrorCode` as `code`. Resolvers answer with a details structure
instead, so this is for `initialize`, which signals failure by rejecting, and for a provider
written elsewhere that throws from a resolver: the client reads `code` off it rather than
reporting `GENERAL`.

```typescript
throw new ProviderError("PROVIDER_FATAL", "The flag service refused the key.");
```

#### `ResolvedDetails<T>` and `ProviderEventHandler`

```typescript
type ResolvedDetails<T extends FlagValue> = Omit<
	ResolutionDetails<T>,
	"value" | "errorCode" | "errorMessage"
>;

type ProviderEventHandler = (details: ProviderEventDetails) => void;
```

What a successful resolution may say about itself beyond the value it found, and what an
emitter calls when an event it declared occurs.

### `@sdxc/flags/provider/noop`

#### `NoopProvider`

Answers every evaluation with the default value it was given, saying so with
`reason: "DEFAULT"`. It is what an instance evaluates through before a provider is set and
after `shutdown`, so registering nothing is a working instance rather than a broken one, and
naming it explicitly is how an application turns evaluation off.

```typescript
let flags = createFlags({ provider: () => new NoopProvider() });
```

### `@sdxc/flags/provider/memory`

#### `new InMemoryProvider(flags?: FlagSet)`

A provider that answers from a flag set held in memory, so a test pins a flag the way
production pins one and reads back the same variant, reason and metadata a flag management
system would have sent. It runs the whole lifecycle and passes the same conformance suite as
any other.

#### `provider.putConfiguration(flags: FlagSet): void`

Swaps the flag set for another one and announces it, naming every key that was in the old set
or is in the new one, so a listener caching per key knows which entries to drop.

```typescript
provider.putConfiguration({ "new-checkout": { variants: { on: true }, defaultVariant: "on" } });
```

#### `FlagConfiguration<T>` and `FlagSet`

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

One flag written down: every value it can take, which of them it serves, and the rule that
overrides that choice for a given context. Targeting is a function rather than an expression
language, so a test states the rule in TypeScript and the type checker reads it.

### `@sdxc/flags/conformance`

#### `conformance(name: string, create: () => Provider | Promise<Provider>, options: ConformanceOptions): void`

Registers the suite every provider runs, as Vitest tests: that the metadata names the
implementation, that no resolver throws, that a missing flag is `FLAG_NOT_FOUND` rather than a
default, that a type mismatch is `TYPE_MISMATCH` rather than a coerced value, that `shutdown`
twice is safe, and that `initialize` emits before it returns. `name` labels the generated
`describe` block, `create` builds a fresh provider for each test, and each `options` entry
gates the group that needs it.

```typescript
conformance("my-provider", () => new ServiceProvider(FLAGS), {
	flags: FLAGS,
	lifecycle: true,
	failing: () => new ServiceProvider(UNLOADABLE),
});
```

#### `ConformanceOptions`

```typescript
interface ConformanceOptions {
	flags?: FlagSet;
	lifecycle?: boolean;
	failing?: () => Provider | Promise<Provider>;
	tracking?: boolean;
}
```

Each entry gates a sub-suite that is skipped when it is absent, so a provider owes the suite
only what it claims to implement.

- `flags` — the flag set the provider was built against, so the suite knows which keys to ask
  for. Without it, only the groups that need no fixture run.
- `lifecycle` — the provider implements `initialize` and `shutdown`, so the suite checks that
  it emits before `initialize` returns and that a second `shutdown` is safe.
- `failing` — builds a provider whose `initialize` rejects, so the suite checks that
  `PROVIDER_ERROR` is emitted before the rejection.
- `tracking` — the provider implements `track`, so the suite drives it the way a client does.

### `@sdxc/flags/middleware`

#### `Flags`

```typescript
let Flags: { defaultValue?: Client };
```

The context key both middlewares publish the client to, for code handed a context without the
installed property. It shares its name with the `Flags` instance type from
`@sdxc/flags/client` and is a different thing: that one is the application's API instance, and
this one is a key that reads one request's or one delivery's client off a context.

```typescript
import { Flags } from "@sdxc/flags/middleware";

let client = ctx.get(Flags);
```

### `@sdxc/flags/middleware/router`

#### `featureFlags(flags: Flags, options?: FeatureFlagsOptions): Middleware`

The default export. Publishes the request's client as `ctx.flags`, and augments
`RequestContext` from its own module so the type follows the import. It awaits `flags.ready()`,
so the instance's providers are initialized on the first request an isolate serves and reused
by every request after it, leaving the per-request cost at the `context` callback and nothing
else.

- `flags` — the application's API instance, built once at module scope.
- `options.context` — reads the subject and whatever else targeting is written against off the
  request, as the client-level context every evaluation of this request merges. It runs once
  per request, so per-call context is for the evaluations whose subject differs from the
  request's.
- `options.domain` — evaluates through the provider bound to this domain instead of the default
  one.

### `@sdxc/flags/middleware/dispatcher`

#### `featureFlags(flags: Flags, options?: FeatureFlagsOptions): JobMiddleware`

The default export. Publishes the delivery's client as `ctx.flags`, typed on the handler
through the effect the dispatcher folds out of its chain. It awaits `flags.ready()` the same
way, so providers are initialized on the first delivery an isolate runs.

- `flags` — the application's API instance, built once at module scope.
- `options.context` — reads the subject off the job's context, as the client-level context
  every evaluation of this delivery merges.
- `options.domain` — evaluates through the provider bound to this domain instead of the default
  one.

## Pattern: A provider against a real service

A provider reaches the service over
[`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch) and parses the response
into the details structures, so the application's types never come from somebody else's SDK.
`initialize` is where the expensive work goes, and emitting is what makes the provider `READY`.

```typescript
import type { EvaluationContext, ResolutionDetails } from "@sdxc/flags";
import type { Provider } from "@sdxc/flags/provider";

import { failed, ProviderEvents, ProviderError, resolved } from "@sdxc/flags/provider";
import * as s from "remix/data-schema";

let RuleSchema = s.object({ value: s.boolean(), variant: s.string() });

export class ServiceProvider implements Provider {
	readonly metadata = { name: "service" };
	readonly events = new ProviderEvents();

	#rules = new Map<string, { value: boolean; variant: string }>();

	async initialize(): Promise<void> {
		let response = await fetch("https://flags.example.com/rules");

		if (!response.ok) {
			let message = `The flag service answered ${response.status}.`;
			this.events.emit("PROVIDER_ERROR", { errorCode: "GENERAL", message });
			throw new ProviderError("GENERAL", message);
		}

		for (let [key, rule] of Object.entries(await response.json())) {
			this.#rules.set(key, s.parse(RuleSchema, rule));
		}

		this.events.emit("PROVIDER_READY");
	}

	resolveBoolean(
		key: string,
		defaultValue: boolean,
		context: EvaluationContext,
	): ResolutionDetails<boolean> {
		let rule = this.#rules.get(key);
		if (!rule) return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named "${key}".`);
		return resolved(rule.value, { variant: rule.variant, reason: "TARGETING_MATCH" });
	}
}
```

## Pattern: Pinning a flag in a test

A test builds its own instance, so nothing it sets reaches the next one, and pins the flag
through the in-memory provider rather than mocking the client.

```typescript
import { createFlags } from "@sdxc/flags/client";
import { InMemoryProvider } from "@sdxc/flags/provider/memory";
import { expect, test } from "vitest";

test("renders the new checkout for the enrolled team", async () => {
	let flags = createFlags({
		provider: () =>
			new InMemoryProvider({
				"new-checkout": {
					variants: { on: true, off: false },
					defaultVariant: "off",
					contextEvaluator: (context) => (context.targetingKey === "team-1" ? "on" : undefined),
				},
			}),
	});

	await flags.ready();

	let client = flags.getClient(undefined, { targetingKey: "team-1" });

	expect(await client.boolean("new-checkout", false)).toBe(true);
});
```

## Pattern: Per-call context for a job's subject

A delivery whose subject is not the one the middleware named supplies its own, since
invocation context is a merge level in its own right and wins over the client level.

```typescript
import { createJobHandler } from "@sdxc/jobs";

import jobs from "./jobs.ts";

export default createJobHandler(jobs.sendWeeklyDigest, async (ctx) => {
	for (let member of await members(ctx.input.teamId)) {
		let html = await ctx.flags.boolean("digest-html", false, { targetingKey: member.id });
		await send(member, html ? renderHtml(member) : renderText(member));
	}
});
```

## Pattern: Redacting context before a third-party provider

Registering the hook at the API level covers every evaluation the instance makes, so a field
the provider should never see is stripped once rather than at every call site.

```typescript
import { createFlags, redactHook } from "@sdxc/flags/client";

import { ServiceProvider } from "./service-provider.ts";

export let flags = createFlags({
	provider: () => new ServiceProvider(),
	context: { service: "checkout" },
	hooks: [redactHook(["email", "ip", "phone"])],
});
```

The context a resolver is handed still carries `targetingKey` and everything else, so targeting
on the subject keeps working while the fields that identify a person do not leave the worker.

## Pattern: Reading evaluations off the wide event

Evaluation writes no log lines of its own — a flag on a hot path would produce one per request
— so the record comes from the invocation's wide event instead.

```typescript
import { createFlags, wideEventHook } from "@sdxc/flags/client";
import featureFlags from "@sdxc/flags/middleware/router";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";

import { ServiceProvider } from "./service-provider.ts";

export let flags = createFlags({ provider: () => new ServiceProvider(), hooks: [wideEventHook()] });

let router = createRouter({ middleware: [log(logger), featureFlags(flags)] });
```

The hook's `finally` stage sets `feature_flag.key`, `feature_flag.result.reason`,
`feature_flag.result.variant`, `feature_flag.provider.name`, and `error.type` with
`error.message` when the evaluation failed. Listing `log` before the middleware is what gives
it a record to write to.

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
