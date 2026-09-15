---
name: sdxc-flags-engine
description: "@sdxc/flags-engine is a feature-flag evaluation engine: typed targeting rules, percentage splits, and pluggable stores behind a one-method `FlagStore`. Use when defining flags as JSON (`FlagSet`, `FlagDefinition`, `TargetingRule`, `Condition`, `Split`, segments), evaluating with `createEngine`/`evaluate`/`evaluateAll`, reading reasons like `TARGETING_MATCH` or `TYPE_MISMATCH`, keeping definitions in Cloudflare KV, or writing a `FlagStore` of your own."
---

# @sdxc/flags-engine

A flag here is a set of variants, an ordered list of targeting rules, and optional percentage weights. This package holds that definition format and resolves it: `parseFlagSet` turns stored JSON into a `FlagSnapshot`, `evaluate` and `evaluateAll` resolve against that snapshot as pure synchronous functions, and `createEngine` wraps a `FlagStore` so a snapshot is loaded once and reused. `EngineProvider` adapts an engine onto the `Provider` interface of `@sdxc/flags`. It runs on any JavaScript runtime; the shipped `WorkerKVFlagStore` is the one piece that assumes Cloudflare Workers.

Full API, options and examples: [packages/flags-engine/README.md](packages/flags-engine/README.md)

## When to reach for it

- Rolling a change out to a percentage of users, with the same subject landing in the same arm on every request and in every isolate.
- Targeting a flag at a plan tier, a country, a semver version or a named segment, without shipping an expression language.
- Answering "who would this rule serve" in an admin preview, before the edited definitions are stored anywhere.
- Telling a flag that is switched off from a flag system that is broken — the `reason` and `errorCode` on the resolution say which.
- Keeping flag definitions somewhere of your own (a table, a bundled JSON file, a remote endpoint) behind one `read` method.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/flags-engine": "workspace:*" } }
```

```ts
import { createEngine } from "@sdxc/flags-engine";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";

let engine = createEngine({
	store: new InMemoryFlagStore({
		flags: {
			"new-checkout": { variants: { on: true, off: false }, defaultVariant: "off" },
		},
	}),
});

await engine.load();

engine.evaluate("new-checkout", false);
// { value: false, reason: "STATIC", variant: "off" }
```

### Entry points

- `@sdxc/flags-engine` — the definition types, their schemas, `parseFlagSet`, `evaluate`, `evaluateAll` and `createEngine`.
- `@sdxc/flags-engine/store` — the `FlagStore` interface, `StoredFlagSet` and `FlagStoreError`.
- `@sdxc/flags-engine/store/memory` — `InMemoryFlagStore`, a set held in an object.
- `@sdxc/flags-engine/store/worker-kv` — `WorkerKVFlagStore`, the whole set as one JSON value under one Cloudflare KV key.
- `@sdxc/flags-engine/conformance` — the Vitest suite every store runs.
- `@sdxc/flags-engine/provider` — `EngineProvider`, the adapter onto `@sdxc/flags`.

## Suggestions

- Reloading is the caller's to schedule. The engine exposes `stale` and holds its snapshot; put `engine.load()` where the runtime gives you time for it — inside `waitUntil` behind the response, or on a cron trigger — because a Worker has a timer only while a request is in flight.
- `defaultValue` is both the fallback and the type every variant is checked against, so a string variant asked for as a boolean resolves as `TYPE_MISMATCH` rather than coercing.
- A split needs a subject to hash: when the field named by `by` (defaulting to `targetingKey`) carries nothing, the evaluation reports `TARGETING_KEY_MISSING` with the caller's default, so a rollout that reached nobody reads as one.
- A refused definition costs only its own flag — it lands in `snapshot.failures` under its key while siblings resolve. Log `engine.failures` once after a load rather than once per evaluation.
- `FLAG_DEFINITION_SCHEMA` and its siblings are Standard Schemas, so an editor validates a draft rule against exactly what the engine would refuse.
- Writing a store of your own is one `read` method; point `conformance` at it to find out whether it is a store.
- `vitest` is an optional peer dependency, needed by the conformance entry alone.

## Related

- `@sdxc/flags` — supplies the vocabulary this package answers in: the evaluation context, the resolution details, the reasons and error codes, and the `Provider` interface `EngineProvider` implements; skill `sdxc-flags`
- `@sdxc/result` — `load` and a store's `read` answer with a `Result`; skill `sdxc-result`
- `@sdxc/duration` — `maxAge` is written as a duration string such as `"5 minutes"`; skill `sdxc-duration`
