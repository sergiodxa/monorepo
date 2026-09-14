# ADR-059: Flags Package Implementing OpenFeature

## Status

**Proposed** - 2026-09-13

## Background

Nothing in this repository can turn a behavior on for some requests and off for others without
deploying. The closest thing to a flag today is an environment variable read through
`cloudflare:workers`, which is per-worker, per-deploy, and invisible to anything but the code
that reads it — there is no targeting, no reason for the value, no way to roll a change out to
a tenth of traffic, and no record in telemetry of which branch a request took.

The usual answer is a vendor SDK, which puts the flag system's client library in the hot path of
every application and makes the choice of vendor a rewrite. OpenFeature exists to avoid exactly
that: it specifies the evaluation API an application calls and the provider interface a flag
system implements, so the application depends on the specification and the vendor is a
constructor argument. The specification reached `v0.9.0` with both of those sections marked
`Stable`, so the contract is worth building against now.

Those two halves are one contract. They share the context, the details structures, the error
codes and the events, and a version of one that disagrees with the other is broken — so this
ADR decides both, and they ship in one package.

## Context

### The specification

The full text is vendored at [`docs/vendor/openfeature`](../vendor/openfeature), at the `v0.9.0`
tag. It is six sections plus five appendices, and its own conformance clause says what
compliance means:

> An implementation is not compliant if it fails to satisfy one or more of the "MUST",
> "MUST NOT", "REQUIRED", "SHALL", or "SHALL NOT" requirements defined in the normative sections

Three things follow from that clause, and they shape every decision below:

1. A `SHOULD` can be declined. It costs nothing in compliance, and the declining is what has to
   be written down.
2. A `Condition` gates the requirements nested under it. An implementation that does not meet
   the condition does not owe the requirements — the static-context paradigm, a language where
   `finally` is reserved, a language without generics.
3. The normative statements are enumerable. `specification.json` is the specification's own
   extraction of them: 135 rules, each with its id and RFC 2119 keyword.

| Section                                                                          | Status       | Decides                               |
| -------------------------------------------------------------------------------- | ------------ | ------------------------------------- |
| [1. Flag Evaluation API](../vendor/openfeature/sections/01-flag-evaluation.md)   | Stable       | What application code calls           |
| [2. Provider](../vendor/openfeature/sections/02-providers.md)                    | Stable       | What a flag system implements         |
| [3. Evaluation Context](../vendor/openfeature/sections/03-evaluation-context.md) | Hardening    | What targeting reads                  |
| [4. Hooks](../vendor/openfeature/sections/04-hooks.md)                           | Hardening    | Where telemetry and validation attach |
| [5. Events](../vendor/openfeature/sections/05-events.md)                         | Hardening    | How status reaches the application    |
| [6. Tracking](../vendor/openfeature/sections/06-tracking.md)                     | Experimental | How outcomes attach to evaluations    |

### The two paradigms

The specification is written for two kinds of SDK at once, and most of its conditional
requirements exist to separate them:

| Paradigm            | Context lives           | Written for                                                      |
| ------------------- | ----------------------- | ---------------------------------------------------------------- |
| **Dynamic-context** | Per evaluation          | Servers, where one process evaluates for many different subjects |
| **Static-context**  | Globally, set on change | Browsers and mobile apps, where the subject is the one user      |

The static-context paradigm is where `RECONCILING`, `on context changed`, per-domain context
setters and the prohibition on invocation-level context come from. Every consumer here is a
Cloudflare Worker serving many subjects per isolate.

### What a provider owes

[Section 2](../vendor/openfeature/sections/02-providers.md) divides into one mandatory core and
several optional capabilities:

| Part                                   | Status in the specification            | Requirements   |
| -------------------------------------- | -------------------------------------- | -------------- |
| Metadata with a `name`                 | Required                               | 2.1.1          |
| Four typed resolvers                   | Required                               | 2.2.1 - 2.2.10 |
| Provider hooks                         | Optional (`MUST` define the mechanism) | 2.3.1          |
| `initialize`                           | Optional (`MAY`)                       | 2.4.1 - 2.4.4  |
| `shutdown`                             | Optional (`MAY`)                       | 2.5.1 - 2.5.3  |
| `on context changed`                   | Static-context only                    | 2.6.1          |
| `track`                                | Optional, experimental                 | 2.7.1          |
| Event emission for every status change | Required once lifecycle exists         | 2.8.1 - 2.8.5  |

The part that is easy to get wrong is the last row. Requirement 2.8.1 is recent — Appendix E
exists to migrate providers onto it — and the rule is that the provider signals every status
transition by emitting an event, while the SDK never infers status from a lifecycle method
returning:

> Providers must not rely on the SDK to infer status from lifecycle method return values.

A provider that initializes successfully and emits nothing is not `READY`, and no amount of
correct resolving will make it so.

### Where this runs

Every consumer is a Cloudflare Worker. That constrains the design more than the specification
does:

| Constraint                                        | Consequence                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| No work in module scope                           | Everything expensive happens in `initialize`, inside a request              |
| Isolates start and die on the platform's schedule | `initialize` runs often; it cannot assume it is rare                        |
| No threads, no timers outside a request           | A provider cannot poll a remote service in the background                   |
| CPU time is metered per request                   | A resolver is a lookup against state already in memory, or an awaited fetch |
| Module-level state is shared across concurrency   | A global registry is shared by every in-flight request in the isolate       |

### What the repository already decided

| Existing decision                                                      | Bearing on this package                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [ADR-057](./ADR-057-request-context-instead-of-a-service-container.md) | Services reach handlers on the request context, published by middleware                     |
| [ADR-033](./ADR-033-wide-events-as-the-logging-contract.md)            | One wide event per invocation; `currentLog()` is the ambient handle, on `AsyncLocalStorage` |
| `@sdxc/result` for error handling                                      | Collides with a specification that forbids throwing and specifies its own error channel     |
| [ADR-043](./ADR-043-billing-package-with-pluggable-providers.md)       | The contract-plus-adapters shape, a generated conformance suite, and no vendor SDK          |
| [ADR-053](./ADR-053-cache-package-with-adapters.md)                    | An unchecked `as T` at a package boundary is the thing to design out, and no abstract base  |

## Decision

Build `@sdxc/flags`, an implementation of the OpenFeature specification for the dynamic-context
paradigm, and adopt it wherever a behavior needs to change without a deploy.

The decisions below run in five groups: the package itself (1 - 3), the evaluation API an
application calls (4 - 12), the contract a flag system implements (13 - 19), what holds across
both (20 - 22), and one layer built on top of all of it (23).

### 1. One package named `@sdxc/flags`, one entry point per job

The package is named for the capability, not for the specification it implements. An
application asks "is this flag on"; that OpenFeature is the shape of the answer is an
implementation detail of this package, the same way `@sdxc/cache` does not name the store
behind it (ADR-032, ADR-053) and `@sdxc/billing` does not name Polar (ADR-043). A consumer
that has to learn a foundation's name before it can read an import line is paying for
something it does not use.

| Entry point                         | Contains                                                      | Imported by         |
| ----------------------------------- | ------------------------------------------------------------- | ------------------- |
| `@sdxc/flags`                       | The shared vocabulary: context, details, error codes, reasons | Everyone            |
| `@sdxc/flags/client`                | `createFlags`, the client, hooks, events, the shipped hooks   | Application code    |
| `@sdxc/flags/catalog`               | `defineFlags` and the `flag.*` handles of decision 23         | Application code    |
| `@sdxc/flags/provider`              | The `Provider` interface and the kit for writing one          | Provider authors    |
| `@sdxc/flags/provider/noop`         | `NoopProvider`                                                | Apps turning it off |
| `@sdxc/flags/provider/memory`       | `InMemoryProvider`                                            | Tests               |
| `@sdxc/flags/conformance`           | The suite every provider runs                                 | Provider tests      |
| `@sdxc/flags/middleware`            | The `Flags` context key both middlewares publish to           | Both of the below   |
| `@sdxc/flags/middleware/router`     | The middleware for a `remix/router` fetch router              | `bootstrap/app.tsx` |
| `@sdxc/flags/middleware/dispatcher` | The middleware for an `@sdxc/jobs` dispatcher                 | The job dispatcher  |

A path says what a module is. Everything under `/provider` is that contract — the interface, the
kit for writing one, and the two the package ships — and everything under `/middleware` installs
a client into a runtime. `@sdxc/cache` and `@sdxc/jobs` keep their adapters flat instead
(`./memory`, `./worker-kv`), which works because each has one plugin point; this package has
two, and a flat `./memory` beside a flat `./router` would say nothing about which is which. The
conformance suite stays outside `/provider` because it is not one.

Each middleware is named for the thing it is installed into, so the import line says where it
goes and neither runtime is the default the other is an exception to. The two share the one
context key, which is why it has a module above them rather than a home inside either.

The root holds types only and emits no runtime code, so importing the vocabulary to type a
function costs nothing at runtime. An application that only evaluates flags imports `/client`
and one middleware, so nothing it ships includes the authoring kit, the test provider or the
suite.

### 2. The shared vocabulary

```typescript
type FlagValue = boolean | string | number | JSONValue;

/** Every reason the specification enumerates, without closing the set. */
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

interface EvaluationContext {
	targetingKey?: string;
	[field: string]: boolean | string | number | Date | JSONValue | undefined;
}

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

`ResolutionDetails` is what a provider answers with and `EvaluationDetails` is what an
application reads, which is why one extends the other: the client adds the flag key it was
asked for and fills in the metadata the provider left out.

`Reason` is a union with `(string & {})` because Requirement 2.2.5 lets a provider answer with
"some other string": the enumerated members still complete in an editor, and a provider-specific
reason still type-checks. `EvaluationDetails` narrows `flagMetadata` to required, which is
Requirement 1.4.14 — an empty record when the provider set none — expressed in the type rather
than in prose.

### 3. Dynamic-context only

Conditions 1.3.2, 1.4.2, 3.2.2, 3.2.4, 3.3.2, 4.3.3, 5.3.4 and 6.1.2 gate the static-context
paradigm, and this package does not meet them. That removes from the surface: the `RECONCILING`
status, `PROVIDER_RECONCILING` and `PROVIDER_CONTEXT_CHANGED`, the provider's
`on context changed` function, per-domain context setters, and the rule that clients and
invocations must not accept context.

This is not a partial implementation. A conditional requirement whose condition does not hold is
not owed, so the package is compliant without a line of it. A browser-side sibling would be a
different package, because the two paradigms disagree about where context lives rather than
about how much of it there is.

### 4. No global singleton; `createFlags()` is the only way in

Requirement 1.1.1 says the API `SHOULD` exist as a global singleton. This package declines it
and implements Requirement 1.8 — isolated API instances — as the only shape there is.

```typescript
export const flags = createFlags({
	provider: () => new MyProvider(),
	context: { service: "uptime", release: env.CF_VERSION_METADATA?.id },
	hooks: [wideEventHook()],
	handlers: { PROVIDER_ERROR: (details) => currentLog()?.warn("flags.provider_error", details) },
	propagator: asyncLocalStoragePropagator(),
});
```

One option per kind of API state, each seeding a mutator the specification requires to exist
anyway, so an app that never changes one after startup says so once instead of making five
calls:

| Option       | Seeds                              | Mutator                                     |
| ------------ | ---------------------------------- | ------------------------------------------- |
| `provider`   | The default provider               | `setProvider` (Requirement 1.1.2.1)         |
| `context`    | The global evaluation context      | `setContext` (Requirement 3.2.1.1)          |
| `hooks`      | The API-level hooks                | `addHooks` (Requirement 1.1.4)              |
| `handlers`   | API-level event handlers           | `addHandler` (Requirement 5.2.2)            |
| `propagator` | The transaction context propagator | `setTransactionContextPropagator` (3.3.1.1) |

`provider` is a callback so nothing is constructed until the first evaluation asks for it.
Binding one to a `domain` stays a call, since a domain map in the options would grow a second
shape for the common case of one provider.

A global registry would be the service container ADR-057 removed with a flag system's name on
it: a per-isolate lifetime the platform decides, state shared by every in-flight request, and a
test that sets a provider leaking into the next one. Requirement 1.8 is the specification's own
answer — 1.8.1 requires this factory, 1.8.2 makes its instances equivalent to the singleton, and
1.8.3's advice to keep the factory obscure is moot where there is no singleton to confuse it
with.

The registry is the application's value rather than a middleware's state because two runtimes
install it: `fetch` runs the router's chain, `scheduled` and `queue` run the dispatcher's
(decision 5). One registry feeds both only if it belongs to neither — the shape `@sdxc/logger`
already uses, with one `createLogger()` attached at the router and handed to the dispatcher. An
app that builds its router per request settles it anyway: a registry created inside that chain
would be new every request, re-running `initialize` each time.

### 5. The client arrives as `ctx.flags`, in both runtimes

```typescript
import featureFlags from "@sdxc/flags/middleware/router";

let router = createRouter({
	middleware: [
		log(logger),
		featureFlags(flags, {
			context(ctx) {
				return { targetingKey: ctx.session.get("userId"), country: ctx.request.cf?.country };
			},
		}),
	],
});
```

The middleware does per-request work only: it awaits the registry's initialization on the first
request an isolate serves, evaluates the `context` callback, and publishes a client carrying
that context as `ctx.flags`. Handlers evaluate through it:

```typescript
if (await ctx.flags.boolean("new-checkout", false)) {
	return ctx.render(NewCheckoutView, {});
}
```

`RequestContext` is augmented from the middleware module, not an ambient declaration, so the
type follows the import.

The job dispatcher installs the same thing from its own subpath, so a job handler reads
`ctx.flags` exactly as a route handler does, and imports the registry no more than one does:

```typescript
import featureFlags from "@sdxc/flags/middleware/dispatcher";

export const dispatcher = createJobDispatcher({
	logger,
	middleware: [
		database(),
		featureFlags(flags, { context: (ctx) => ({ targetingKey: ctx.get(Team).id }) }),
	],
});
```

```typescript
export default createJobHandler(jobs.sendWeeklyDigest, async (ctx) => {
	if (await ctx.flags.boolean("weekly-digest-v2", false)) return sendV2(ctx);
	return sendV1(ctx);
});
```

Both middlewares publish to the one `Flags` context key exported by `@sdxc/flags/middleware`,
which is what makes those two handlers identical: job context keys come from `remix/router` too,
so a single key serves an HTTP middleware and a job middleware alike. Each middleware is its
module's default export, so an app names it at the import — `featureFlags` in both examples
above, since `flags` is the registry. The HTTP side augments `RequestContext` to type
`ctx.flags`; the job side carries the property in the middleware's declared effect, so the
dispatcher types it from the chain.

A handler whose subject is not on the context supplies one per call instead —
`boolean(key, false, { targetingKey: team.id })` — since invocation context is a merge
level in its own right (decision 8).

### 6. Four types, two shapes, always async

```typescript
interface Client {
	readonly metadata: ClientMetadata;
	readonly providerStatus: ProviderStatus;

	boolean(
		key: string,
		defaultValue: boolean,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<boolean>;
	string(
		key: string,
		defaultValue: string,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<string>;
	number(
		key: string,
		defaultValue: number,
		context?: EvaluationContext,
		options?: EvaluationOptions,
	): Promise<number>;
	object<T extends JSONValue>(
		key: string,
		defaultValue: T,
		options: ObjectEvaluationOptions<T>,
	): Promise<T>;

	booleanDetails(/* … */): Promise<EvaluationDetails<boolean>>;
	/* … string, number, object … */

	addHooks(...hooks: Hook[]): void;
	addHandler(event: ProviderEvent, handler: EventHandler): void;
	removeHandler(event: ProviderEvent, handler: EventHandler): void;
	track(name: string, context?: EvaluationContext, details?: TrackingEventDetails): void;
}
```

The names are ours: no normative statement names a method, and `getBooleanValue` and its
siblings appear only in non-normative examples. What 1.3.1.1 binds is the set, the parameters
and the return, all of which a method per type satisfies. Providers keep `resolveBoolean` and
its siblings, since the glossary draws a real distinction between a client _evaluating_ and a
provider _resolving_, and an author reads those once rather than at every call site.

Eight methods is a large surface for "is this flag on", and Conditional Requirement 1.3.1.1
makes all four types a `MUST` under a condition that holds here. They are worth their keep on
their own terms. A boolean cannot hold a three-armed experiment without two booleans that can
contradict each other; a threshold is a number; copy and configuration are strings and
structures. Providers owe four resolvers under Conditional Requirement 2.2.2.1 regardless, so a
one-type client could not consume a provider somebody else wrote — which is the whole premise
of decision 1.

The surface is also wider than the code. All eight are wrappers over one internal evaluation
that merges context, runs the hook stages, calls the resolver and type-checks the result; a type
adds a line, not an implementation.

Every evaluation returns a promise, whether or not the provider behind it needed to await
anything. Condition 1.3.3 — a language that distinguishes integers from floats — does not hold,
so there is one `number` and no `int`. Requirement 1.4.12 asks for non-blocking
evaluation, and a provider that reads from KV or a remote service has to be awaited anyway; a
synchronous overload for the providers that could answer immediately would be a second surface
to test for the sake of a microtask.

### 7. An object flag is validated, not cast

Requirement 1.3.4 says the client `SHOULD` guarantee the returned value matches the expected
type, and treat a mismatch as abnormal execution. For booleans, strings and numbers that is a
`typeof` check. For structures it cannot be done without knowing the structure, which is why
every other SDK's `getObjectValue<T>` is an unchecked cast on a value that arrived over a
network from a system the application does not control.

Object evaluation takes a schema, and the default value is typed by it:

```typescript
let copy = await ctx.flags.object(
	"checkout-copy",
	{ title: "Checkout", cta: "Pay" },
	{
		schema: s.object({ title: s.string(), cta: s.string() }),
	},
);
```

The schema is `remix/data-schema` through `@sdxc/validate`, which is already the rule for
external data. A value that fails it is abnormal execution: `errorCode: "TYPE_MISMATCH"`,
`reason: "ERROR"`, and the default value returned, exactly as Requirement 1.3.4 describes. The
schema is required rather than optional, because an optional check is one nobody adds.

### 8. Context merges in one order, and the transaction level is real

Requirement 3.2.3, with the transaction level present and the static-context levels absent:

```
API (global)  ->  transaction  ->  client  ->  invocation  ->  before hooks
   lowest                                                        highest
```

A field set at a later level overwrites the same field from an earlier one. `targetingKey` is a
field like any other and follows the same rule.

Condition 3.3.1 holds — this is a dynamic-context implementation — so the API provides a
transaction context propagator, and the package ships the one backed by `AsyncLocalStorage`:

```typescript
flags.setTransactionContext({ targetingKey: user.id }, () => next());
```

`AsyncLocalStorage` is already how `currentLog()` reaches code that was never handed a context
(ADR-033), every app already runs with `nodejs_compat`, and the alternative — only the context
the middleware could name at the top of the request — leaves code that learns something about
the subject halfway through with nowhere to put it. The propagator is also what the
specification's `contextMerging.feature` scenarios tagged `@transaction` exercise, so declining
it would mean skipping a third of the suite this package promises to pass.

### 9. Hooks, and the two this package ships

The four stages are `before`, `after`, `error` and `finally`. Condition 4.3.9 — `finally` is a
reserved word — does not hold: property names have been allowed to be reserved words since ES5,
so the stage keeps the name the specification gives it and there is no `finallyAfter`.

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

Ordering is Requirement 4.4.2: `before` runs API, then client, then invocation, then provider,
each in the order added; `after`, `error` and `finally` run in the exact reverse. `hookData` is
created per hook per evaluation and shared between that hook's stages only (Requirement 4.3.2).

Two hooks ship with the package:

- `wideEventHook()` — attaches the evaluation to the invocation's wide event in its `finally`
  stage, under the attribute names Appendix D maps to the OpenTelemetry feature-flag record:
  `feature_flag.key`, `feature_flag.result.reason`, `feature_flag.result.variant`,
  `feature_flag.provider.name`, and `error.type` / `error.message` when the evaluation failed.
  Reasons and error codes are lowercased to snake_case on the way, as Appendix D requires. It
  reads `currentLog()` and does nothing outside an invocation.
- `redactHook(fields)` — strips named fields from the context before it reaches the provider, so
  a provider that ships context to a third party cannot be handed something it should not see.

Appendix A's logging hook is deliberately not one of them. Requirement 1.4.11 says evaluation
should not write log messages, for the reason ADR-033 exists: a flag that does not exist yet
would produce one line per evaluation per request. The wide event carries the same information
at one record per invocation.

### 10. Status is read, never inferred

Requirement 2.8.1 makes the provider the source of every status transition, and Requirement
5.3.5 fixes the mapping and the ordering — the SDK updates status before running handlers, so a
handler never observes a status that disagrees with the event that woke it.

| Event                            | Status after                             |
| -------------------------------- | ---------------------------------------- |
| `PROVIDER_READY`                 | `READY`                                  |
| `PROVIDER_STALE`                 | `STALE`                                  |
| `PROVIDER_ERROR`                 | `ERROR`, or `FATAL` for `PROVIDER_FATAL` |
| `PROVIDER_CONFIGURATION_CHANGED` | unchanged                                |

Shutdown is the exception: the SDK calls it, so it infers `NOT_READY` itself (Requirement
1.7.6). Handlers persist across provider changes (Requirement 5.2.6) and run immediately when
attached after the state they wait for has already been reached (Requirement 5.3.3).

This is what makes a flag service outage distinguishable from every flag being off, which is the
failure mode that otherwise teaches people to distrust flags.

### 11. Tracking is present and no-ops

`client.track` is on the surface from the first release, and does nothing when the provider does
not implement tracking (Requirement 6.1.4). Section 6 is `Experimental`, but the method is a
handful of lines over the same merged context the resolvers get, and adding it later would move
the client interface for every consumer at once.

### 12. `shutdown` resets the instance

Requirement 1.6.1 propagates shutdown to every registered provider; 1.6.2 then resets the
instance — hooks, handlers, context, propagator and providers all gone, a no-op provider back in
place. That is what makes an instance reusable between tests without reconstructing it.

### 13. `/provider` holds the contract and the kit

| Export                | What it is                                                             |
| --------------------- | ---------------------------------------------------------------------- |
| `Provider`            | The interface a flag system implements                                 |
| `ProviderEvents`      | The typed emitter a provider assigns to its `events` field             |
| `ProviderError`       | An error carrying an `ErrorCode`, for the abnormal paths that do throw |
| `resolved` / `failed` | Two helpers that build a `ResolutionDetails` with the right fields set |

The interface sits with the things that exist to implement it rather than with the shared
vocabulary at the root, so `/provider` answers one question — how do I supply flags — and the
root answers the other. The client names `Provider` through a type-only import, which erases, so
`/client` carries none of this module's runtime.

### 14. Resolvers answer with details, and do not throw

```typescript
interface Provider {
	readonly metadata: ProviderMetadata;
	readonly hooks?: Hook[];
	readonly events?: ProviderEvents;
	readonly domainScoped?: boolean;

	resolveBoolean(
		key: string,
		defaultValue: boolean,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<boolean>>;
	resolveString(
		key: string,
		defaultValue: string,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<string>>;
	resolveNumber(
		key: string,
		defaultValue: number,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<number>>;
	resolveObject(
		key: string,
		defaultValue: JSONValue,
		context: EvaluationContext,
	): MaybePromise<ResolutionDetails<JSONValue>>;

	initialize?(context: EvaluationContext, domain?: string): Promise<void>;
	shutdown?(): Promise<void>;
	track?(name: string, context: EvaluationContext, details?: TrackingEventDetails): void;
}
```

Requirement 2.2.7 lets a provider indicate an error "using the idioms of the implementation
language" — throwing, returning an error, or populating `error code` on the returned details.
This package picks the third and makes it the documented path: a provider that cannot resolve a
flag returns the details structure with `errorCode`, `errorMessage` and `reason: "ERROR"` set,
and puts the `default value` it was handed in the required `value` field.

That is what the `default value` parameter is for. A resolver is not expected to use it when
things go well, and the specification still requires it, because `value` is a required field on
a structure the provider must return even when it has nothing to resolve.

```typescript
resolveBoolean(key, defaultValue) {
	let flag = this.flags.get(key);
	if (!flag) return failed(defaultValue, "FLAG_NOT_FOUND", `No flag named ${key}`);
	if (typeof flag.value !== "boolean") return failed(defaultValue, "TYPE_MISMATCH");
	return resolved(flag.value, { variant: flag.variant, reason: "STATIC" });
}
```

The client still guards against a provider that throws anyway — a third-party provider is
untrusted code in the hot path — and converts anything thrown into `GENERAL`, or into its own
code when it is a `ProviderError`. `ProviderError` exists for that case and for `initialize`,
which does signal failure by rejecting.

A resolver may also be synchronous. `MaybePromise` is in the signature because the in-memory
provider answers from a `Map`, and a provider that has already loaded its rule set answers
without a network call; requiring `async` would make every trivial provider allocate a promise
to say what it already knows. The client awaits regardless, so its own methods stay asynchronous
in all cases (decision 6).

### 15. Lifecycle is optional, and events are the only status channel

```typescript
class MyProvider implements Provider {
	readonly metadata = { name: "my-provider" };
	readonly events = new ProviderEvents();

	async initialize(context: EvaluationContext, domain?: string) {
		try {
			this.flags = await this.load(context);
			this.events.emit("PROVIDER_READY");
		} catch (error) {
			this.events.emit("PROVIDER_ERROR", { errorCode: "PROVIDER_FATAL", message: String(error) });
			throw error;
		}
	}
}
```

`ProviderEvents` is a class a provider holds as a field, not a base class it extends. ADR-053
removed an abstract base whose only purpose was sharing one method; this would be the same
mistake, and composition leaves a provider free to extend `APIClient` instead.

Emitting is the whole of the contract. `initialize` rejecting tells the client when to stop
waiting; the `PROVIDER_ERROR` event is what sets the status and runs the handlers
(Requirements 2.8.1 - 2.8.3, 5.3.5). A provider with no `initialize` needs no emitter and no
event: the client treats it as `READY` from registration and runs `PROVIDER_READY` handlers on
its behalf (Conditional Requirement 2.8.5.1).

A provider may also emit spontaneously — `PROVIDER_ERROR` when a backend it polls goes away,
`PROVIDER_STALE` when its cache passes its horizon, `PROVIDER_CONFIGURATION_CHANGED` when flags
change underneath it.

`shutdown` is idempotent and returns the provider to its uninitialized state (Requirements 2.5.2
and 2.5.3). Calling it twice without an intervening `initialize` does nothing, and a provider
still initializing aborts. This is the one transition a provider does not announce, because the
client called it and infers `NOT_READY` when the call terminates.

### 16. `domainScoped` is a declaration, not an enforcement

A provider bound to two domains is initialized once, with whichever domain registered it first
(Requirement 2.4.1). A provider that keys state on its domain — a cache partition, a namespace
prefix — cannot live with that ambiguity, so it sets `domainScoped: true` and the API rejects a
second binding (Conditional Requirement 1.1.8.1).

Requirement 2.4.4 then says such a provider `MUST` accept the bound domain during
initialization, and the specification is candid that this cannot be checked:

> This is a contract on the provider; implementations may not be able to detect or reject a
> violation automatically

So it is checked where it can be: the conformance suite initializes a `domainScoped` provider
under two domains and asserts the second binding is refused.

### 17. Flag metadata is passed through, never invented

Requirement 2.2.9 asks a provider to populate `flag metadata`, and Appendix D names three keys
integrations read: `contextId`, `flagSetId`, `version`. A provider sets those when its backend
has them and sets nothing otherwise. The client never fills them in — an invented `version`
would be worse than an absent one — and passes through whatever arrives, as Requirement 1.4.14
requires.

### 18. Two providers ship, and the in-memory one is real

```typescript
import { InMemoryProvider } from "@sdxc/flags/provider/memory";
import { NoopProvider } from "@sdxc/flags/provider/noop";
```

- **`NoopProvider`** returns the `default value` for every resolver with `reason: "DEFAULT"`. It
  is what an API instance evaluates through before a provider is set and after `shutdown`, which
  is what keeps flag evaluation from being a failure mode during startup.
- **`InMemoryProvider`** takes a flag set — variants, a default variant, and an optional
  targeting function over the context — and resolves against it. It is Appendix A's provider,
  it is what the Gherkin suites evaluate against, and it is what an application's own tests use
  to pin a flag on without reaching for a mock.

The in-memory provider implements `initialize`, emits its events, supports
`PROVIDER_CONFIGURATION_CHANGED` when its flag set is replaced, and passes the same conformance
suite as any other. A testing provider that skipped the lifecycle would let a test pass against
a provider that behaves differently from the one production runs.

### 19. No vendor SDKs, and the conformance suite is an export

A provider that talks to a flag service extends `APIClient` from `@sdxc/api-client` and calls the
service's endpoints; on Workers, a service binding is the same provider with the binding's
`fetch` in place of the global one. ADR-043 made this call for billing and the reasoning carries:
a vendor SDK costs Worker bundle and isolate startup for schemas that get re-validated on the way
into our own types, and it goes stale in ways that throw where a raw client would have degraded.
Responses are parsed with `remix/data-schema` into the details structures.

A provider is correct in ways its own unit tests rarely check: that it never throws from a
resolver, that a missing flag is `FLAG_NOT_FOUND` rather than a default, that a type mismatch is
`TYPE_MISMATCH` rather than a coerced value, that `shutdown` twice is safe, that `initialize`
emits before it returns. Those assertions are identical for every provider, so they ship as a
function that generates the suite:

```typescript
import { conformance } from "@sdxc/flags/conformance";

conformance("my-provider", () => new MyProvider(FLAGS), { flags: FLAGS });
```

A provider written in an app, or in another repository, runs the same suite as the two in the
box — the shape ADR-043 uses for billing providers and ADR-053 for cache adapters.

### 20. Nothing on the evaluation path returns a `Result`

Requirement 1.4.10 is a `MUST NOT`: no method on the client throws or otherwise abnormally
terminates, and every evaluation answers with the default value when something goes wrong. The
repository's rule to use `@sdxc/result` instead of exceptions points at the same problem, and
the specification has already solved it — `ResolutionDetails` and `EvaluationDetails` carry
`errorCode`, `errorMessage` and `reason: "ERROR"` beside a value that is always present.

A `Result` on top of that would be a second error channel for information the first one already
carries, with an error branch that is unreachable because there is always a default value to
answer with. On the provider side it would be worse: the client would have to reconcile two
representations of one failure, and a third-party author would have two shapes to choose
between, which means the client has to handle both anyway.

| Surface                              | Answers with                  | Because                                    |
| ------------------------------------ | ----------------------------- | ------------------------------------------ |
| `boolean` and the other three        | The value                     | Requirement 1.4.10                         |
| `booleanDetails` and the other three | `EvaluationDetails<T>`        | The details structure is the error channel |
| `resolveBoolean` and the other three | `ResolutionDetails<T>`        | Requirement 2.2.7, third option            |
| `client.track`                       | Nothing                       | Requirement 6.1.1.1                        |
| `flags.setProvider`, `shutdown`      | `Result<void, ProviderError>` | Configuration may legitimately fail        |

The split is the specification's own: Requirement 1.4.10 exempts "functions or methods for the
purposes for configuration or setup", and Requirement 2.4.2.1 wants a provider that cannot start
to say so. Those are the calls that return a `Result`. The rule's purpose is served throughout:
nothing on these paths throws, and a failure is a value.

### 21. Conformance is a ledger, not a claim

The vendored `specification.json` is the input to a test:

```typescript
/** Every MUST-class rule is either covered by a named test or declined with a reason. */
test("every normative requirement is accounted for", () => {
	/* … */
});
```

Each conformance test is named by the requirement id it covers (`Requirement 1.4.14`), and the
ledger test asserts that every rule in `specification.json` whose keyword is `MUST`, `MUST NOT`,
`REQUIRED`, `SHALL` or `SHALL NOT` is either named by such a test or listed in a `DECLINED` map
with the condition that excuses it — the static-context paradigm, a condition about integers, a
condition about reserved words. A specification bump then fails loudly with the list of new
requirements rather than quietly leaving them unimplemented. This is the shape
`packages/markdown/src/conformance/spec.test.ts` already runs for CommonMark.

The Gherkin suites are vendored beside it and transcribed into Vitest tests, scenario by
scenario, against the in-memory provider and the specification's own `test-flags.json`.

### 22. What this package deliberately does not do

| Not implemented                 | Why                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| The static-context paradigm     | Its conditions do not hold; it belongs to a browser-side package                                     |
| Appendix A's multi-provider     | Needs a second real provider to be worth a strategy; nothing is asking for it                        |
| Appendix A's logging hook       | Requirement 1.4.11 and ADR-033; the wide event carries it                                            |
| Appendix D's OpenTelemetry hook | Nothing here exports OTel; the attribute names are honored by `wideEventHook` instead                |
| Appendix C's OFREP provider     | Versions separately from this specification; it ships as `@sdxc/flags-ofrep` when something needs it |

### 23. A typed catalog, layered over the client

A flag is a client-side contract before it is anything else: `flags.boolean("new-checkout", false)`
fixes the key, the type and the default at every call site, and a flag the client never names is
one the application cannot use. A catalog moves that commitment into one place rather than adding
a new one.

```typescript
export const catalog = defineFlags({
	newCheckout: flag.boolean("new-checkout", false),
	digestBatch: flag.number("digest-batch-size", 50),
	checkoutCopy: flag.object("checkout-copy", CopySchema, { title: "Checkout", cta: "Pay" }),
});
```

Each entry is a `Flag<T>` handle carrying the key, the type, the default, and for a structure the
schema of decision 7. Because the handle carries the type, the call site does not restate it, and
the client gains two methods rather than four overloads:

```typescript
interface Client {
	get<T extends FlagValue>(flag: Flag<T>, options?: FlagOptions<T>): Promise<T>;
	details<T extends FlagValue>(
		flag: Flag<T>,
		options?: FlagOptions<T>,
	): Promise<EvaluationDetails<T>>;
}

interface FlagOptions<T> extends EvaluationOptions {
	/** Overrides the catalog's default for this one call. */
	defaultValue?: T;
	context?: EvaluationContext;
}
```

```typescript
await ctx.flags.get(catalog.newCheckout); // Promise<boolean>
await ctx.flags.get(catalog.digestBatch, { context: { targetingKey: team.id } }); // Promise<number>
await ctx.flags.get(catalog.newCheckout, { defaultValue: true }); // a safer fallback here only
```

`T` comes from the handle, so `get(catalog.checkoutCopy)` returns the copy structure and
`{ defaultValue: "yes" }` against a boolean flag does not compile. A misspelled key is not
expressible at all.

The options are one named bag rather than the positional `(key, default, context, options)` of
the conformant methods, because per-call context is the common case — a job supplying its
subject, per decision 5 — and a positional default override would force an `undefined`
placeholder in front of it. This does not conflict with decision 6's refusal to fold context into
`evaluation options`: that structure is specified, and `FlagOptions` is a type of our own on a
method the specification does not describe.

Nothing about it reaches the provider. The client unpacks a handle into the key and default it
would otherwise have been handed, so a resolver sees the same two arguments either way, and a
flag created in the management system stays invisible here until someone adds a line — which is
true today and is the point: the catalog is where a flag becomes real for the application.

The conformant four stay exactly as Requirement 1.3.1.1 requires them, for a dynamic key and for
anything outside a catalog. `get` and `details` are additions beside them, so the ledger has
nothing new to judge, and decision 7 is paid off along the way: a structure's schema is written
once in the catalog rather than at every call site.

Built after adoption, against flags that exist.

## Consequences

### Positive

- **A flag change stops being a deploy.** Behavior can be turned on for a targeting key, a
  country, or a fraction of traffic, and turned off again without a build.
- **The vendor is a constructor argument.** Applications import this package; a flag system is
  one object passed to `setProvider`, and replacing it touches one line per app.
- **A flag system is one class.** Metadata and four functions is a working provider; lifecycle,
  events, hooks and tracking are each opt-in.
- **A provider failure is visible as a failure.** `FLAG_NOT_FOUND` and a backend outage are
  different codes, both distinct from a flag that is genuinely off.
- **Every evaluation lands in the wide event.** `feature_flag.key` and the reason are on the
  same record as the request, so which branch a request took is answerable after the fact.
- **Object flags cannot be cast.** A structure arrives validated or it does not arrive.
- **Compliance is checkable, and portable.** The ledger names every requirement that is neither
  covered nor consciously declined, and any provider, wherever it is written, runs the same
  suite as the shipped ones.
- **Tests get an isolated instance and a real provider.** No global registry to reset, and
  `InMemoryProvider` exercises the same lifecycle production does.

### Negative

- **A specification-shaped surface is large.** Four value methods, four details methods, hooks
  with four stages and three registration levels, six events and a status machine is a lot of
  code for "is this flag on", and all of it exists before the first useful provider does.
- **The event contract is easy to violate quietly.** A provider that initializes and forgets to
  emit resolves flags perfectly and is never `READY`. The suite catches it; an author who does
  not run the suite gets no warning.
- **Object evaluation needs a schema.** A caller who would have accepted the cast now writes a
  schema, and a flag whose shape changes needs the schema changed with it.
- **`AsyncLocalStorage` is a second ambient channel.** The repository now has two — the current
  log and the transaction context — and both are invisible at the call site.
- **The declined `SHOULD` has to be explained.** Anyone arriving from another OpenFeature SDK
  looks for `OpenFeature.setProvider` at module scope and does not find it.
- **`Result` is absent from the surface most code touches**, against the repository's general
  rule, and the reason lives in this ADR rather than in the signature.
- **`domainScoped` is trust.** The API can refuse a second binding; it cannot verify that a
  provider claiming to be domain-scoped actually uses the domain it is handed.
- **Nothing useful resolves flags yet.** The two shipped providers answer with defaults and with
  what a test put in them; the first provider against a real system is still to be written.

### Neutral

- **Section 1.8 is experimental**, so the shape this package builds on may change before it
  stabilizes; the requirements at risk are the ones already deviating from 1.1.1.
- **No consumer is migrated by this ADR.** Adoption is per app, one flag at a time.
- **Tracking ships unused** until a provider implements it.
- **Sync-or-async resolvers mean two paths** through the client's evaluation code, and a provider
  that returns a promise from one resolver and a value from another is legal.

## Implementation Plan

### Phase 1: Vocabulary And Conformance Ledger

**Priority:** High
**Estimated Effort:** 4 hours

1. Root entry point: context, details, error codes, reasons, flag metadata, provider status.
2. The `Provider` interface, `ProviderError`, `resolved`, `failed` and `ProviderEvents` at
   `/provider`.
3. The ledger test over `specification.json`, with every requirement declined at first.
4. Wire the package's tests into the root Vitest project run.

### Phase 2: The Evaluation Path

**Priority:** High
**Estimated Effort:** 7 hours

1. `createFlags`, the provider registry, domains, and `NoopProvider`.
2. Client creation, the four typed methods and their details variants.
3. Context merging, including the transaction propagator.
4. Schema validation for object flags.
5. Move the requirements these cover out of the declined map.

### Phase 3: Hooks, Events And Lifecycle

**Priority:** High
**Estimated Effort:** 6 hours

1. The four stages, registration at all levels, ordering, hook data, hook hints.
2. The event emitter, handler registration, status derivation, immediate replay.
3. `initialize` and `shutdown` across the registry, and instance reset.

### Phase 4: Providers And Their Suite

**Priority:** High
**Estimated Effort:** 5 hours

1. `InMemoryProvider` over Appendix A's flag-set shape, with lifecycle and events.
2. The `conformance` suite: resolver behavior, lifecycle emission, idempotent shutdown, the
   domain-scoped rejection. Run it against both shipped providers.
3. Load the vendored `test-flags.json` into the in-memory provider.

### Phase 5: Specification Suites

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Transcribe `evaluation_v2.feature`, `contextMerging.feature`, `hooks.feature` and
   `metadata.feature`.
2. Close the declined map down to the conditions that genuinely do not hold.

### Phase 6: Middleware And Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Both middleware subpaths and their shared context key, the `RequestContext` augmentation,
   `wideEventHook`, `redactHook`.
2. Package README per the package documentation guide.
3. Adopt in one app, behind one real flag, with a provider against something real.

### Phase 7: The Catalog

**Priority:** Low
**Estimated Effort:** 3 hours

1. `defineFlags` and the `flag.*` handle constructors at `@sdxc/flags/catalog`.
2. `get` and `details` on the client, inferring from the handle.
3. Move the adopting app's flags into a catalog.

## Alternatives Considered

### 1. A vendor SDK

Take the flag system's own client library and call it from the apps. Rejected because it puts a
third-party client in the hot path of every request and makes the choice of vendor structural:
the call sites name the vendor's types, so changing vendor is a rewrite rather than a
constructor argument. It is the situation ADR-043 was written to get out of for billing.

### 2. Environment variables and a deploy

What happens today. Rejected because it cannot target: a flag is on for everyone or no one, the
granularity of a change is a deploy, and nothing records which value a given request saw.

### 3. A small first-party `isEnabled(key, ctx)` and nothing else

Roughly thirty lines, no specification, no hooks, no events. Genuinely tempting, and rejected
for one reason: the moment a real flag system is behind it, that function grows a reason, a
variant, a default, a context, and a way to know whether the backend is reachable — which is the
specification, arrived at by accident and without its conformance suite. The specification also
buys providers other people wrote.

### 4. Two packages, one per half

`@sdxc/flags` for the evaluation API and `@sdxc/flags-provider` for the contract. Rejected
because the two halves share the whole vocabulary, so the split would mean either duplicating
the types or making one package depend on the other for them — and a version pair that can
disagree about what `ResolutionDetails` is. The subpath exports give the separation that
actually matters: what an application bundles.

### 5. A module-level global singleton, as Requirement 1.1.1 suggests

Every other SDK's default, and familiar to anyone arriving from one — including the variant
where a provider module registers itself on import. Rejected because a global in a Worker
isolate is shared state across concurrent requests with a platform-decided lifetime, because it
is the service container ADR-057 removed, because self-registration makes which provider is
active depend on import order, and because it makes test isolation a matter of remembering to
reset. The specification rates it a `SHOULD` and provides the factory this package uses instead.

### 6. Both paradigms in one package

Implement static-context too, behind a flag or a second client type. Rejected because the two
disagree about where context lives, not about how much surface they have: supporting both means
every context path has two behaviors and every conditional requirement is live in both
directions. A browser-side implementation is a different package with a different conformance
run.

### 7. `Result` on the evaluation methods and the resolvers

The repository rule applied literally. Rejected because Requirement 1.4.10 requires the default
value to be returned on abnormal execution — so the error branch is unreachable, every call site
unwraps a `Result` that is always `ok`, and the actual error information is in the details
structure either way. The rule exists to stop exceptions being the error channel; here the
specification has already stopped them.

### 8. Providers throw `ProviderError` on failure

The path most of the reference SDKs take, and explicitly allowed by Requirement 2.2.7. Rejected
as the documented path because it makes the common failure — a flag that does not exist — an
exception in the hot path of every request, and because the client must guard against throws
regardless, so choosing them as the norm gains nothing. It stays supported for providers written
elsewhere.

### 9. An abstract base class providers extend

`abstract class BaseProvider` supplying the emitter, default metadata and unimplemented
resolvers. Rejected: it buys one field and a constructor, it makes every provider a subclass of
this package's class, and it takes the one `extends` slot a provider needs for `APIClient`.
ADR-053 removed an abstract base for the same reason.

### 10. One `resolve` method with a type argument

`resolve<T>(key, defaultValue, context, type)` instead of four methods. Rejected: Conditional
Requirement 2.2.2.1 requires the four typed methods where the language distinguishes the types,
and TypeScript does. A single method would also return `ResolutionDetails<FlagValue>` and make
every caller narrow.

### 11. Ship an OFREP provider in this package

It is the provider most likely to be used, and putting it here would make the package
immediately useful. Rejected because OFREP versions separately from the OpenFeature
specification, so one package version would answer to two documents; because it would put an
HTTP client and its schemas into a bundle that today has neither; and because nothing is asking
for it yet.

### 12. Skip the shipped providers and let apps write their own

Smaller package. Rejected because the no-op provider is required by the specification's own
model of an unconfigured API, and because without an in-memory provider there is nothing to run
the Gherkin suites against — the conformance story disappears with it.

### 13. A Gherkin parser, so the suites run as published

Parse the `.feature` files at test time instead of transcribing them, so a specification bump is
a file refresh. Deferred. Per the repository's rule that a format capability gets its own
package, this would be `@sdxc/gherkin` rather than a helper hidden in this package's test
folder — worth doing when transcription drift is real, not before the first transcription
exists.

## References

- [OpenFeature Specification `v0.9.0`](../vendor/openfeature) — vendored in full
- [Conformance clause](../vendor/openfeature/README.md) — what compliance means
- [Section 1: Flag Evaluation API](../vendor/openfeature/sections/01-flag-evaluation.md)
- [Section 2: Provider](../vendor/openfeature/sections/02-providers.md)
- [Section 3: Evaluation Context](../vendor/openfeature/sections/03-evaluation-context.md)
- [Section 4: Hooks](../vendor/openfeature/sections/04-hooks.md)
- [Section 5: Events](../vendor/openfeature/sections/05-events.md)
- [Appendix A: Included Utilities](../vendor/openfeature/appendix-a-included-utilities.md) — the in-memory provider
- [Appendix C: OFREP](../vendor/openfeature/appendix-c/index.md) — the deferred remote provider
- [Appendix D: Observability](../vendor/openfeature/appendix-d-observability.md) — the attribute names `wideEventHook` writes
- [Appendix E: Migrations](../vendor/openfeature/appendix-e-migrations.md) — why status is event-driven
- [ADR-057](./ADR-057-request-context-instead-of-a-service-container.md) — why there is no global registry
- [ADR-033](./ADR-033-wide-events-as-the-logging-contract.md) — why evaluations reach the wide event instead of the log
- [ADR-043](./ADR-043-billing-package-with-pluggable-providers.md) — generated conformance suites, and no vendor SDK
- [ADR-053](./ADR-053-cache-package-with-adapters.md) — the interface-not-base-class shape, and the cast this avoids

## Current Progress

- [ ] Phase 1: Vocabulary And Conformance Ledger
- [ ] Phase 2: The Evaluation Path
- [ ] Phase 3: Hooks, Events And Lifecycle
- [ ] Phase 4: Providers And Their Suite
- [ ] Phase 5: Specification Suites
- [ ] Phase 6: Middleware And Adoption
- [ ] Phase 7: The Catalog

## Notes

- The specification numbers `Requirement 1.5.1` under a heading called "Evaluation Options" that
  sits outside the `1.4` block, and Requirements 2.3.2 and 2.3.3 concern the `error message`
  field while sitting under "Provider hooks". The ids in `specification.json` are authoritative,
  and the ledger test keys on those rather than on heading order.
- `log.set` flattens one level of nesting into dotted keys, so the wide-event hook passes
  `feature_flag.result.reason` as a flat key rather than as a nested object.
- Requirement 1.1.2.4's `setProviderAndWait` has no counterpart here: `setProvider` always
  awaits initialization. The two-function split exists for languages where fire-and-forget is
  the ergonomic default.
- A provider bound to several domains is initialized once, and shut down only when the last
  binding goes away (Requirements 1.1.2.2 and 1.1.2.3).
- Requirement 2.2.5 lets `reason` be any string. The enumerated values are what the wide-event
  hook knows how to lowercase; an unrecognized reason passes through unchanged.
- An event handler may log, and the one in decision 4 does: Requirement 1.4.11 asks evaluation
  not to write log messages, and says the opposite about configuration and initialization.
- `Flags`, the exported context key, needs its type written out rather than inferred from
  `createContextKey`, or the publish build fails on TS2883 where `typecheck` and `test` pass.
- A provider cannot poll in the background on Workers. Keeping a rule set fresh means refreshing
  during a request — a provider hook in the `before` stage is the place for it — or reading from
  a Durable Object alarm that does the refreshing.
