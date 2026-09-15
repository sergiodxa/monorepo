---
name: sdxc-flags
description: "@sdxc/flags is an OpenFeature v0.9.0 feature flag API: `createFlags()` builds an instance you own, `client.boolean`/`string`/`number`/`object` and their `*Details` forms never throw, `defineFlags`/`flag.*` declare a typed catalog, and router and dispatcher middleware publish the client as `ctx.flags`. Use when flagging a request or job handler, writing a `Provider`, pinning a flag in a test with `InMemoryProvider`, or running the provider conformance suite."
---

# @sdxc/flags

The API is [OpenFeature](https://openfeature.dev) `v0.9.0`, so the flag system is a constructor argument rather than a name in your call sites. `createFlags()` builds an instance the application owns — there is no singleton — and `flags.getClient()` returns what code evaluates through. Nothing on the evaluation path throws: an evaluation that cannot resolve returns the default it was handed and carries the `reason` and `errorCode` on its detailed form. Evaluation is dynamic-context, so the subject travels with the call. The package splits across entry points so an application that only evaluates ships none of the authoring kit, the test provider or the conformance suite. Any fetch runtime; `remix`, `@sdxc/jobs` and `vitest` are optional peers.

Full API, options and examples: [packages/flags/README.md](packages/flags/README.md)

## When to reach for it

- A request or job handler has to branch on a flag, with the subject read off the request or the delivery once rather than at every call site.
- Flag keys, types and defaults are being restated at call sites and a misspelled key should not be expressible.
- A flag service has to be integrated without its SDK's types leaking into the application.
- A test has to pin a flag to a variant and read back the same reason and metadata production would have sent.
- Something has to distinguish "this flag is off" from "the flag system is down".

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/flags": "workspace:*" } }
```

```ts
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

### Entry points

- `@sdxc/flags` — the shared vocabulary as types only: `EvaluationContext`, `ResolutionDetails`, `EvaluationDetails`, `Reason`, `ErrorCode`, `Client`, `Flag`, `Hook`
- `@sdxc/flags/client` — `createFlags`, the `Flags` instance, `wideEventHook`, `redactHook`, `asyncLocalStoragePropagator`
- `@sdxc/flags/catalog` — `defineFlags` and the `flag.boolean`/`string`/`number`/`object` handles
- `@sdxc/flags/provider` — the `Provider` interface plus `resolved`, `failed`, `ProviderEvents`, `ProviderError`
- `@sdxc/flags/provider/noop` — `NoopProvider`, which answers every evaluation with its default
- `@sdxc/flags/provider/memory` — `InMemoryProvider` and `putConfiguration`, for tests and local flag sets
- `@sdxc/flags/conformance` — the Vitest suite every provider runs
- `@sdxc/flags/middleware` — the `Flags` context key both middlewares publish to
- `@sdxc/flags/middleware/router` — the middleware for a fetch router
- `@sdxc/flags/middleware/dispatcher` — the middleware for a job dispatcher

## Suggestions

- Build the instance once at module scope and hand it to the middleware; an instance created inside a request would re-initialize its provider on every one. The middleware awaits `flags.ready()`, so providers are initialized on the isolate's first request and reused after it.
- Importing the router middleware is what types `ctx.flags` — it augments `RequestContext` from its own module rather than from an ambient declaration. The dispatcher middleware types it through the effect the dispatcher folds out of its chain.
- Declare a catalog with `defineFlags` and evaluate with `client.get(features.newCheckout)`, so the key, type and default are written down once.
- A structure evaluation requires a Standard Schema in its `options`, and `client.object` takes those options third, ahead of the optional context — an unchecked cast on a value that arrived over a network is exactly what the check exists to prevent. `flag.object(key, schema, defaultValue)` puts the schema before the default so a default the schema would reject is a compile error.
- Branch on `reason`: `DEFAULT` means nothing resolved the flag, `ERROR` means something tried and failed. Provider status is read from what a provider announces, never inferred from a lifecycle call, so a provider that implements `initialize` without emitting `PROVIDER_READY` stays `NOT_READY`.
- Nothing on the evaluation path returns a `Result`, because nothing there fails; `setProvider` and `shutdown()` do, since those can. `shutdown()` returns an instance to how it started, which is what makes one reusable between tests.
- Evaluation writes no log lines of its own; `wideEventHook()` attaches the key, reason, variant and provider to the invocation's wide event instead. Register the logging middleware before the flags middleware so there is a record to write to.
- Run `conformance()` against any provider you write. Each `ConformanceOptions` entry gates a sub-suite, so a provider owes the suite only what it claims to implement.

## Related

- `@sdxc/flags-engine` — typed targeting rules, percentage splits and pluggable stores behind a `Provider`; skill `sdxc-flags-engine`
- `@sdxc/jobs` — the optional peer behind the dispatcher middleware; skill `sdxc-jobs`
- `@sdxc/logger` — supplies the wide event `wideEventHook` writes to; skill `sdxc-logger`
