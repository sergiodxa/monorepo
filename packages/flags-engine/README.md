# @sdxc/flags-engine

Flag evaluation engine: typed targeting rules, percentage splits and pluggable stores.

A flag is a set of named variants plus an ordered list of rules choosing between them. This
package parses a definition set into a snapshot and resolves flags against it with a pure,
synchronous function, so the same call answers a provider, an HTTP endpoint and an admin
preview. Definitions arrive through a one-method `FlagStore`, so where they live is yours to
choose.

## Installation

```sh
npm add @sdxc/flags-engine @sdxc/flags
```

[`@sdxc/flags`](https://www.npmjs.com/package/@sdxc/flags) is what an application evaluates
through, and it supplies the evaluation context, resolution details, reasons and error codes this
package answers in. Loads answer a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). The `./conformance` entry point
needs [`vitest`](https://www.npmjs.com/package/vitest).

## Usage

### Resolve a flag from a set in memory

An engine reads its store once, keeps the parsed snapshot and resolves every later flag against
it.

```typescript
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

### Target subjects with rules and segments

Rules run in order and the first whose condition holds decides the variant. A segment is a
condition declared once and referenced by name from any flag.

```typescript
import { createEngine } from "@sdxc/flags-engine";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";

let engine = createEngine({
	store: new InMemoryFlagStore({
		segments: {
			internal: { op: "endsWith", field: "email", value: "@example.com" },
		},
		flags: {
			"new-checkout": {
				variants: { on: true, off: false },
				defaultVariant: "off",
				targeting: [
					{ when: { op: "segment", name: "internal" }, serve: "on" },
					{
						when: {
							op: "all",
							of: [
								{ op: "eq", field: "plan.tier", value: "pro" },
								{ op: "semver", field: "appVersion", compare: ">=", value: "2.0.0" },
							],
						},
						serve: "on",
					},
				],
			},
		},
	}),
});

await engine.load();

engine.evaluate("new-checkout", false, {
	targetingKey: "user-1",
	plan: { tier: "pro" },
	appVersion: "2.3.0",
});
// { value: true, reason: "TARGETING_MATCH", variant: "on" }

engine.evaluate("new-checkout", false, { targetingKey: "user-2", plan: { tier: "free" } });
// { value: false, reason: "DEFAULT", variant: "off" }
```

### Roll out to a percentage

A rule serving `weights` buckets its subjects among the arms. The subject is hashed with the
flag key, so the same subject lands in the same arm on every request and in every isolate.

```typescript
let engine = createEngine({
	store: new InMemoryFlagStore({
		flags: {
			"new-checkout": {
				variants: { on: true, off: false },
				defaultVariant: "off",
				targeting: [{ when: { op: "always" }, serve: { weights: { on: 10, off: 90 } } }],
			},
		},
	}),
});

await engine.load();

engine.evaluate("new-checkout", false, { targetingKey: "user-1" });
// { value: true or false, reason: "SPLIT", variant: "on" or "off" }, stable for "user-1"
```

### Serve flags through `@sdxc/flags`

`EngineProvider` adapts an engine to the `Provider` an `@sdxc/flags` client evaluates through.
In a Cloudflare Worker, `WorkerKVFlagStore` reads the set from a KV namespace.

```typescript
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";
import { createFlags } from "@sdxc/flags/client";
import { env } from "cloudflare:workers";

export let flags = createFlags({
	provider: () =>
		new EngineProvider(
			createEngine({ store: new WorkerKVFlagStore(env.FLAGS), maxAge: "5 minutes" }),
		),
});

await flags.getClient().boolean("new-checkout", false, { targetingKey: "user-1" });
```

## API

| Entry point                          | Contains                                                        |
| ------------------------------------ | --------------------------------------------------------------- |
| `@sdxc/flags-engine`                 | Definition types, schemas, `flagConditions`, evaluation, engine |
| `@sdxc/flags-engine/store`           | `FlagStore`, `StoredFlagSet`, `FlagStoreError`                  |
| `@sdxc/flags-engine/store/memory`    | `InMemoryFlagStore`                                             |
| `@sdxc/flags-engine/store/worker-kv` | `WorkerKVFlagStore`                                             |
| `@sdxc/flags-engine/conformance`     | `conformance`, the Vitest suite every store passes              |
| `@sdxc/flags-engine/provider`        | `EngineProvider`                                                |

### `createEngine(options: EngineOptions): Engine`

Builds an engine over `options.store`. `options.maxAge` (a duration such as `"5 minutes"`) is
how long a loaded snapshot counts as current; without it a snapshot stays current until the
next load.

### `Engine`

- `load(): MaybePromise<Result<FlagSnapshot, FlagStoreError>>` reads the store, parses the set
  and keeps the snapshot. It is synchronous when the store is, and `await`-able either way.
- `evaluate(key, defaultValue, context?)` resolves one flag against the held snapshot, answering
  the default with `PROVIDER_NOT_READY` until a load succeeds.
- `evaluateAll(context?)` resolves every held flag, and answers `{}` before the first load.
- `snapshot` is the held `FlagSnapshot`, or `undefined` before a load succeeds.
- `failures` lists the definitions the held set carried and the engine refused.
- `stale` is `true` before the first load and once the snapshot has aged past `maxAge`.

The caller decides when to reload: on a request, inside `waitUntil` or from a cron trigger.

### `evaluate(snapshot, key, defaultValue, context?): ResolutionDetails<T>`

Resolves one flag for one context. `defaultValue` is both the fallback and the type every
variant is checked against, so a string variant asked for as a boolean answers the default with
`TYPE_MISMATCH`.

### `evaluateAll(snapshot, context?): Record<string, ResolutionDetails<FlagValue>>`

Resolves every flag in the snapshot, refused ones included. A flag producing no value of its
own reports `value: null` beside its reason.

### `parseFlagSet(stored: StoredFlagSet): FlagSnapshot`

Parses a stored set: segments resolved, patterns compiled, variant names checked. Each flag
parses on its own, so a refused flag lands in `snapshot.failures` and answers `PARSE_ERROR`
while its siblings resolve normally.

### Reasons

| Outcome                                          | `reason`          | `errorCode`             |
| ------------------------------------------------ | ----------------- | ----------------------- |
| No targeting, and a `defaultVariant`             | `STATIC`          |                         |
| A rule matched and named a variant               | `TARGETING_MATCH` |                         |
| A rule matched and bucketed                      | `SPLIT`           |                         |
| No rule matched, or no `defaultVariant`          | `DEFAULT`         |                         |
| `state: "disabled"`                              | `DISABLED`        |                         |
| No flag under that key                           | `ERROR`           | `FLAG_NOT_FOUND`        |
| The definition was refused at parse time         | `ERROR`           | `PARSE_ERROR`           |
| The variant holds another type than the default  | `ERROR`           | `TYPE_MISMATCH`         |
| A split found no value under its bucketing field | `ERROR`           | `TARGETING_KEY_MISSING` |
| The engine has not loaded yet                    | `ERROR`           | `PROVIDER_NOT_READY`    |

Every outcome without a `variant` answers the caller's default. A flag's `metadata` travels on
every resolution as `flagMetadata`.

### Conditions

A `Condition` is a JSON object narrowed on `op`, in the
[`@sdxc/expression`](https://www.npmjs.com/package/@sdxc/expression) language.

| Condition                                              | Holds when                                           |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `{ op: "all" \| "any", of: Condition[] }`              | Every member holds, or some member holds             |
| `{ op: "not", of: Condition }`                         | The member fails                                     |
| `{ op: "eq" \| "ne", field, value }`                   | The field equals, or differs from, a JSON primitive  |
| `{ op: "in" \| "notIn", field, values }`               | The list carries, or omits, the field's value        |
| `{ op: "lt" \| "lte" \| "gt" \| "gte", field, value }` | The field is a number in that relation               |
| `{ op: "startsWith" \| "endsWith", field, value }`     | The field is a string with that prefix or suffix     |
| `{ op: "contains", field, value }`                     | The field is a string carrying that substring        |
| `{ op: "matches", field, pattern }`                    | The field is a string the pattern matches (`v` flag) |
| `{ op: "semver", field, compare, value }`              | The field is a version in that relation              |
| `{ op: "exists", field }`                              | The path resolves to a value                         |
| `{ op: "segment", name }`                              | The named segment's condition holds                  |
| `{ op: "always" }`                                     | Every subject                                        |

`field` is a dotted path into the context (`plan.tier`, `roles.0`). A missing field makes every
operator except `exists` false, and no operator coerces across types. The comparisons from `eq`
to `gte` take `path` in place of `value` or `values` to compare two context fields:
`{ op: "eq", field: "country", path: "billing.country" }`.

### `flagConditions`

The targeting language: `compile(condition, { references: segments })` validates and compiles
one condition, answering a `Result`; `evaluate(compiled, context)` answers whether it holds;
`parse(text)` and `stringify(condition)` convert between the JSON form and a text form such as
`ctx.plan.tier == "pro" and semver(ctx.appVersion, ">=", "2.0.0")`. `schema` validates the JSON
form.

### Schemas

`FLAG_DEFINITION_SCHEMA`, `TARGETING_RULE_SCHEMA`, `CONDITION_SCHEMA`, `SPLIT_SCHEMA` and
`SEGMENT_SET_SCHEMA` are the parsers the engine reads stored JSON with, as
[Standard Schema](https://standardschema.dev) values. Validate an edit against them to refuse
exactly what the engine would.

### `FlagStoreError`

```typescript
new FlagStoreError("KV refused the get", { code: "unavailable", location: "flags", cause });
```

The failure every store read reports. `code` is `"unavailable"` when the storage could not be
reached or refused, and `"invalid_value"` when it held something other than a JSON set;
`location` names where the store looked. An empty store reads as a success holding `{ flags: {} }`.

### `new InMemoryFlagStore(set?: StoredFlagSet)`

Holds one set in memory, empty by default. `read()` answers a copy synchronously and always
succeeds; `write(set)` replaces the whole set.

### `new WorkerKVFlagStore(kv: KVNamespace, options?: { key?: string })`

Keeps the whole set as one JSON value under `options.key` (default `"flags"`, readable as
`store.key`) in a [Cloudflare KV](https://developers.cloudflare.com/kv/) namespace. A key holding
nothing reads as an empty set. `write(set)` replaces the value and answers a
`Result<void, FlagStoreError>`.

### `conformance(options: ConformanceOptions): void`

Registers Vitest tests that check a `FlagStore` behaves as the engine expects.

- `name`: labels the suite.
- `create`: builds an empty store; called per test, so give each one its own location.
- `seed(store, set)`: puts a set where the store reads it from.
- `write(store, set)`: optional; writes through the store and adds the round-trip tests.
- `writeText(store, text)`: optional; puts raw text in storage and adds the tests for values the
  store did not write.

### `new EngineProvider(engine: Engine)`

An `@sdxc/flags` `Provider` over an engine, named `"flags-engine"`. Its resolvers answer
whatever `engine.evaluate` answers.

- `initialize()` loads and emits `PROVIDER_READY`; when the store fails it emits
  `PROVIDER_ERROR` and throws a `ProviderError` (`GENERAL` for `unavailable`, `PARSE_ERROR` for
  `invalid_value`) with the `FlagStoreError` as `cause`.
- `refresh()` loads again, emits `PROVIDER_CONFIGURATION_CHANGED` with every key either snapshot
  answered for, and answers the load's `Result` without throwing. A failed refresh over a stale
  snapshot emits `PROVIDER_STALE` once; the next success emits `PROVIDER_READY`.

### Types

- `FlagSet` is `{ flags: Record<string, FlagDefinition>; segments?: SegmentSet }`, and
  `SegmentSet` is `Record<string, Condition>`; a segment may reference another segment.
- `FlagDefinition` has `variants` (at least one), `defaultVariant?`, `state?: FlagState`
  (`"enabled"` or `"disabled"`), `targeting?: TargetingRule[]` and `metadata?`. Without a
  `defaultVariant`, a flag serves the caller's default to everyone no rule matches.
- `TargetingRule` is `{ when: Condition; serve: string | Split }`.
- `Split` is `{ weights; by?; seed? }`: whole, non-negative weights taken against their sum,
  bucketing on `by` (default `targetingKey`). Two flags sharing a `seed` bucket the same subjects
  together.
- `SemVerComparison` is `"=" | "!=" | "<" | "<=" | ">" | ">=" | "~" | "^"`; `~` matches major
  and minor, `^` matches major.
- `FlagSnapshot` holds `flags` and `failures` maps keyed by flag key, the resolved `segments`,
  the store's `version` and the `createdAt` time. `CompiledFlag`, `CompiledRule`,
  `CompiledCondition` and `CompiledSegments` are its parts; `FlagParseFailure` is
  `{ key, message }`.
- `EngineOptions` and `Engine` are described above.
- From `./store`: `FlagStore` is `{ read(): MaybePromise<Result<StoredFlagSet, FlagStoreError>> }`;
  `StoredFlagSet` is `{ flags: Record<string, unknown>; segments?; version? }`, unvalidated JSON
  the engine parses. `FlagStoreErrorCode` and `FlagStoreErrorOptions` type the error.
- `WorkerKVFlagStoreOptions` from `./store/worker-kv` and `ConformanceOptions` from
  `./conformance` type their options.

## Pattern: Reloading On A Schedule You Own

The engine reports `stale`; reloading behind the response keeps every request on the snapshot in
hand.

```typescript
import { createEngine } from "@sdxc/flags-engine";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";
import { env } from "cloudflare:workers";

let engine = createEngine({ store: new WorkerKVFlagStore(env.FLAGS), maxAge: "5 minutes" });

export default {
	async fetch(request: Request, _env: Env, ctx: ExecutionContext) {
		if (engine.stale) ctx.waitUntil(Promise.resolve(engine.load()));

		let userId = request.headers.get("X-User-Id") ?? "anonymous";
		let checkout = engine.evaluate("new-checkout", false, { targetingKey: userId });

		return new Response(checkout.value ? "new checkout" : "old checkout");
	},

	async scheduled() {
		await engine.load();
	},
};
```

Until the first load finishes, evaluations answer the caller's default with
`PROVIDER_NOT_READY`; await `engine.load()` first where that matters.

## Pattern: Logging Refused Definitions

A refused definition costs only its own flag. Log the refusals once after each load instead of
on every evaluation.

```typescript
import { createEngine } from "@sdxc/flags-engine";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { isFailure } from "@sdxc/result";

let engine = createEngine({
	store: new InMemoryFlagStore({
		flags: {
			beta: { variants: { on: true, off: false }, defaultVariant: "off" },
			broken: { variants: { on: true }, defaultVariant: "missing" },
		},
	}),
});

let loaded = await engine.load();
if (isFailure(loaded)) throw loaded.error;

for (let failure of engine.failures) {
	console.warn(`Flag ${failure.key} refused: ${failure.message}`);
}

engine.evaluate("broken", false); // { value: false, reason: "ERROR", errorCode: "PARSE_ERROR", ... }
engine.evaluate("beta", false); // { value: false, reason: "STATIC", variant: "off" }
```

## Pattern: Multivariate Flags And A Kill Switch

Variants hold any JSON value. `state: "disabled"` serves the caller's default while the rules
stay written down, and `metadata` reaches every resolution for analytics.

```typescript
import { evaluate, parseFlagSet } from "@sdxc/flags-engine";

let snapshot = parseFlagSet({
	flags: {
		"checkout-layout": {
			variants: {
				classic: { columns: 1, upsell: false },
				compact: { columns: 2, upsell: true },
			},
			defaultVariant: "classic",
			targeting: [{ when: { op: "in", field: "country", values: ["US", "CA"] }, serve: "compact" }],
			metadata: { owner: "payments" },
		},
		"holiday-banner": {
			state: "disabled",
			variants: { on: true, off: false },
			targeting: [{ when: { op: "always" }, serve: "on" }],
		},
	},
});

let fallback = { columns: 1, upsell: false };

evaluate(snapshot, "checkout-layout", fallback, { country: "US" });
// { value: { columns: 2, upsell: true }, reason: "TARGETING_MATCH", variant: "compact", flagMetadata: { owner: "payments" } }

evaluate(snapshot, "checkout-layout", "classic"); // reason: "ERROR", errorCode: "TYPE_MISMATCH"
evaluate(snapshot, "holiday-banner", false); // { value: false, reason: "DISABLED" }
```

## Pattern: Publishing Edits From An Admin Endpoint

Validate the edit with the engine's own schema, preview it against a sample context, then write
the whole set and refresh the provider so the new definitions apply at once.

```typescript
import type { EvaluationContext } from "@sdxc/flags";
import type { StoredFlagSet } from "@sdxc/flags-engine/store";

import {
	createEngine,
	evaluateAll,
	FLAG_DEFINITION_SCHEMA,
	parseFlagSet,
} from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

let store = new WorkerKVFlagStore(env.FLAGS);
let provider = new EngineProvider(createEngine({ store }));

function preview(set: StoredFlagSet, context: EvaluationContext) {
	return evaluateAll(parseFlagSet(set), context);
}

async function publish(key: string, draft: unknown) {
	let checked = s.parseSafe(FLAG_DEFINITION_SCHEMA, draft);
	if (!checked.success) return { issues: checked.issues };

	let current = await store.read();
	if (isFailure(current)) return { error: current.error.message };

	let next = { ...current.data, flags: { ...current.data.flags, [key]: checked.value } };
	let sample = preview(next, { targetingKey: "user-1", plan: { tier: "pro" } })[key];

	let written = await store.write(next);
	if (isFailure(written)) return { error: written.error.message };

	await provider.refresh();
	return { sample };
}
```

A second `WorkerKVFlagStore(env.FLAGS, { key: "flags:staging" })` holds a staging set in the
same namespace.

## Pattern: Editing Conditions As Text

`flagConditions` shows a stored condition as text, reads edited text back into JSON with a line
and column on failure, and compiles it against the set's segments to catch an unknown segment,
a segment cycle or a pattern that does not compile.

```typescript
import type { Condition } from "@sdxc/flags-engine";

import { flagConditions } from "@sdxc/flags-engine";
import { isFailure } from "@sdxc/result";

let stored: Condition = {
	op: "any",
	of: [
		{ op: "segment", name: "internal" },
		{ op: "semver", field: "appVersion", compare: ">=", value: "2.0.0" },
	],
};

flagConditions.stringify(stored);
// 'segment("internal") or semver(ctx.appVersion, ">=", "2.0.0")'

function readCondition(text: string, segments: Record<string, unknown>) {
	let parsed = flagConditions.parse(text);
	if (isFailure(parsed)) {
		let { message, line, column } = parsed.error;
		return { error: message, line, column };
	}

	let compiled = flagConditions.compile(parsed.data, { references: segments });
	if (isFailure(compiled)) return { error: compiled.error.message, at: compiled.error.path };

	return {
		when: parsed.data,
		holds: flagConditions.evaluate(compiled.data, { appVersion: "2.1.0" }),
	};
}
```

Every context path in the text form starts with `ctx.`.

## Pattern: A Store Of Your Own

A store is one `read` method answering the whole set, so a store over your own database is a
small class. Scoping lives in the store: one built for a tenant reads that tenant's flags.

```typescript
import type { FlagStore, StoredFlagSet } from "@sdxc/flags-engine/store";
import type { Result } from "@sdxc/result";

import { FlagStoreError } from "@sdxc/flags-engine/store";
import { failure, success } from "@sdxc/result";

import { db } from "./db.js";

export class TenantFlagStore implements FlagStore {
	constructor(readonly tenantId: string) {}

	async read(): Promise<Result<StoredFlagSet, FlagStoreError>> {
		try {
			let row = await db.flagSets.findByTenant(this.tenantId);
			return success(row?.set ?? { flags: {} });
		} catch (cause) {
			return failure(
				new FlagStoreError(`Could not read flags for ${this.tenantId}`, {
					code: "unavailable",
					location: this.tenantId,
					cause,
				}),
			);
		}
	}
}
```

Then run the conformance suite against it, giving each test a tenant of its own:

```typescript
import { conformance } from "@sdxc/flags-engine/conformance";
import { generateUUID } from "@sdxc/uuid/v4";

import { db } from "./db.js";
import { TenantFlagStore } from "./tenant-flag-store.js";

conformance({
	name: "TenantFlagStore",
	create: () => new TenantFlagStore(generateUUID()),
	seed: (store, set) => db.flagSets.upsert(store.tenantId, set),
});
```

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
		"@sdxc/flags-engine": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later
release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
