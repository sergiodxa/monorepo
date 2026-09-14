# ADR-060: Flag Evaluation Engine

## Status

**Implemented** - 2026-09-14

## Background

[ADR-059](./ADR-059-flags-package-implementing-openfeature.md) built `@sdxc/flags`: the
evaluation API an application calls, and the `Provider` interface a flag system implements. It
shipped two providers — one that answers with the caller's default for everything, and one that
answers from an object a test wrote — and said so plainly in its own consequences: nothing
useful resolves flags yet.

What is missing is the half that decides. A flag is not a stored value; it is a set of variants,
a rule about who sees which one, and a percentage. Something has to hold those rules, read the
context a request arrives with, and work out which variant this subject gets. That is an
evaluation engine, and until one exists every provider written here would either call a vendor
over the network or reimplement targeting inside itself.

## Context

### flagd, the reference engine

[flagd](https://flagd.dev) is OpenFeature's own evaluation engine. It is the thing to study
because it is the only implementation whose rules, wire format and edge cases are all published.
It runs two ways: **RPC**, where a provider sends the flag key and context over gRPC or HTTP and
flagd answers, and **in-process**, where a provider streams the whole rule set down and evaluates
locally. The second mode is the one that matters here — it is the mode in which the engine is a
library rather than a service.

#### The flag definition

```json
{
	"$schema": "https://flagd.dev/schema/v0/flags.json",
	"flags": {
		"welcome-banner": {
			"state": "ENABLED",
			"defaultVariant": "off",
			"variants": { "on": true, "off": false },
			"targeting": { "ends_with": [{ "var": "email" }, "@example.com"] },
			"metadata": { "version": "17" }
		}
	},
	"$evaluators": {
		"isInternal": { "ends_with": [{ "var": "email" }, "@example.com"] }
	}
}
```

`state` and `variants` are required; `defaultVariant` may be absent, which means "fall back to
the default the calling code passed". Every variant of one flag holds one type, enforced by the
schema being a union of four per-type flag shapes rather than by a `type` field. Flag-set
`metadata` merges with flag `metadata`, and the flag wins.

#### Targeting

Targeting is a [JsonLogic](https://jsonlogic.com) expression that **evaluates to a variant name**,
not to a boolean. Around twenty standard operators, plus four flagd defines:

| Operator                    | Shape                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `fractional`                | `[bucketExpr?, ["red", 50], ["blue", 50]]` — returns a variant name                     |
| `starts_with` / `ends_with` | `[{ "var": "email" }, "@example.com"]`                                                  |
| `sem_ver`                   | `[{ "var": "version" }, ">=", "1.0.0"]`, with `=`, `!=`, `<`, `<=`, `>`, `>=`, `~`, `^` |

`$evaluators` holds named fragments referenced as `{"$ref": "isInternal"}`. Resolution is a
literal `strings.ReplaceAll` over the normalized JSON document at load time, which is why a
`$ref` inside an `$evaluator` does not work and the documentation says each one must be
self-contained.

The engine injects `$flagd.flagKey` and `$flagd.timestamp` (Unix seconds) into the context, but
only when the flag has non-empty targeting, and overwrites any `$flagd` the caller supplied.
`targetingKey` is otherwise an ordinary context field, read as `{"var": "targetingKey"}`.

#### Bucketing

`fractional` hashes a string with MurmurHash3 x86 32-bit at seed 0, then:

```go
bucket := (uint64(hashValue) * uint64(totalWeight)) >> 32
```

and walks a cumulative prefix sum of the weights. Weights are relative rather than percentages
— they default to `1`, must be whole numbers, and are capped at `MaxInt32` — so `[["a", 1],
["b", 1]]` is a half-and-half split. When the expression does not name its own bucketing string,
the default is `flagKey` concatenated with `targetingKey`, unseparated, which is what stops two
flags at ten percent from selecting the same tenth of subjects.

The published specification page still describes an older algorithm that divided the hash by
`MaxUint32` and mapped it onto `[0, 100]`. The two disagree on some subjects, and the older one
cannot express a bucket below one percent.

#### Resolution

Targeting returns a string, and the string is matched against the variant names:

| Situation                              | `reason`          | Error code       |
| -------------------------------------- | ----------------- | ---------------- |
| No flag under the key                  | `ERROR`           | `FLAG_NOT_FOUND` |
| `state: "DISABLED"`                    | `DISABLED`        |                  |
| Targeting failed to parse or to run    | `ERROR`           | `PARSE_ERROR`    |
| Targeting returned `null`, default set | `DEFAULT`         |                  |
| Targeting returned `null`, no default  | `FALLBACK`        |                  |
| Targeting named a declared variant     | `TARGETING_MATCH` |                  |
| Targeting named an undeclared variant  | `ERROR`           | `GENERAL`        |
| No targeting, default set              | `STATIC`          |                  |
| The variant holds another type         | `ERROR`           | `TYPE_MISMATCH`  |

Three details are worth carrying forward. `FALLBACK` is internal: on the wire it becomes
`DEFAULT` with `value` and `variant` omitted, which is OFREP's way of saying "use the default
your code passed". `SPLIT` is declared and never emitted — a `fractional` match reports
`TARGETING_MATCH`. And the string the expression returned is coerced rather than checked: it is
trimmed, compared against the literal `null`, then stripped of every quote character, so a rule
returning boolean `true` selects a variant literally named `true`.

#### Where definitions come from

A sync source hands flagd the **entire document as a JSON string**, pushed onto a channel; the
arrival of a document is the change notification, and there are no deltas. The built-in sources
are a file, an HTTP endpoint polled with `ETag`, a gRPC stream, a Kubernetes custom resource,
and the three object stores. Several sources merge into one state, keyed by flag-set and flag
key, with declaration order as priority and the last source winning.

Schema validation is advisory — a document that does not conform is logged and used anyway. The
one hard failure is a `defaultVariant` naming a variant that the flag does not declare, which
rejects the whole payload.

#### OFREP

The [OpenFeature Remote Evaluation Protocol](../vendor/openfeature/appendix-c/index.md) is how a
client that is not this repository would ask an engine for a value. It is at `0.3.0`, and it is
two endpoints:

| Endpoint                              | Body                                   | Answers                                          |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------ |
| `POST /ofrep/v1/evaluate/flags/{key}` | `{ "context": { "targetingKey": … } }` | `{ key, value, reason, variant, metadata }`      |
| `POST /ofrep/v1/evaluate/flags`       | The same                               | A mixed array of successes and per-flag failures |

The bulk response is where partial success is normal: a flag that could not be resolved is an
entry carrying `errorCode`, beside the ones that resolved. A resolved entry may also omit
`value` entirely, which is the protocol's way of saying the caller should use its own default.

### What transfers, and what does not

| flagd's decision                               | Taken                                                        |
| ---------------------------------------------- | ------------------------------------------------------------ |
| Variants, a default variant, `state`, metadata | Yes — the names and the semantics                            |
| Targeting resolves to a variant name           | Yes, as the outcome; no, as the expression shape             |
| Relative weights with a prefix-sum walk        | Yes, including the `>> 32` bucketing                         |
| MurmurHash3 x86 32-bit at seed 0               | Yes, so a percentage means the same thing in both            |
| Flag key mixed into the default bucketing      | Yes                                                          |
| A source hands over the whole document         | Yes — snapshots, no deltas                                   |
| JsonLogic as the rule language                 | No — a typed union instead                                   |
| Named fragments inlined by string replacement  | No — named segments resolved when the set is parsed          |
| Stringified, quote-stripped targeting results  | No — a rule names a variant or splits among them             |
| Several sources merged by declaration priority | No — one store, and an application that wants two writes one |
| `$flagd.timestamp` and weights as expressions  | No — a scheduled rollout is a rule on a field the app sends  |
| Advisory schema validation                     | No — a definition that does not parse fails its own flag     |

The two that deserve a sentence each. **JsonLogic** is rejected in decision 5, and the reason is
not that it is a bad language: it is that a targeting rule here is edited in a form, stored in
a store, and read back, so it needs a type an editor can render and a schema a write can be validated
against, and `JSONValue` is neither. **Merging several sources** is a deployment shape — one
process serving flags authored in four places — and there is exactly one authoring surface here.

### Where this runs

Every consumer is a Cloudflare Worker, which rules out the deployment flagd is built for and
constrains what replaces it:

| Constraint                                | Consequence for an engine                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| No container to run beside a worker       | The engine is a library in the isolate, not a service on the network               |
| No work in module scope                   | Definitions are read inside a request, never at import                             |
| No timer outside a request                | Nothing polls a source in the background; a reload is something a caller schedules |
| Isolates start and die on demand          | A cold isolate reads the store once, so that read is on a request's critical path  |
| CPU time is metered per request           | Evaluating a flag walks a structure already in memory                              |
| Storage is D1, KV, R2 or a Durable Object | Where definitions live is a per-application choice, so it is an argument           |

Running flagd itself is not an option worth much discussion: there is nowhere to put a container
next to a Worker, so it would be a network hop to another cloud on the critical path of every
request that reads a flag.

### What the repository already decided

| Existing decision                                                | Bearing on this package                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [ADR-059](./ADR-059-flags-package-implementing-openfeature.md)   | The vocabulary, the `Provider` contract this plugs into, and the naming of satellites |
| [ADR-053](./ADR-053-cache-package-with-adapters.md)              | A contract interface with adapters behind it, and no abstract base                    |
| [ADR-054](./ADR-054-jobs-package-with-queue-adapters.md)         | Flat adapter subpaths beside a contract module, and a conformance suite per adapter   |
| [ADR-043](./ADR-043-billing-package-with-pluggable-providers.md) | A generated conformance suite as the package's export                                 |
| [ADR-033](./ADR-033-wide-events-as-the-logging-contract.md)      | One record per invocation, so evaluation writes no log lines                          |
| `remix/data-schema` for untrusted input                          | A definition set read from a store is validated, not cast                             |

## Decision

Build `@sdxc/flags-engine`, a flag evaluation engine: a definition format, a targeting language,
and a pure function from a definition set plus an evaluation context to a
`ResolutionDetails`. It reads definitions through a `FlagStore` interface, and it is not a
provider.

The decisions run in four groups: the package and its shape (1 - 3), what a flag is (4 - 8),
how it is evaluated (9 - 13), and where the definitions come from (14 - 18).

### 1. One package, named for the capability

`@sdxc/flags` is what an application evaluates through; `@sdxc/flags-engine` is what decides
what a flag evaluates to. The split is the one ADR-059 already anticipated when it named
`@sdxc/flags-ofrep` as the home of the OFREP provider: the root package holds the specification
and everything an application bundles, and a satellite holds a thing built on top of it.

Two facts make the split the right one here rather than a subpath of `@sdxc/flags`:

| Fact                                                  | Consequence                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| An application evaluating flags never runs the engine | The rule language, the hash and the schemas stay out of its bundle  |
| The engine answers to no specification                | It versions on its own definition format, not on OpenFeature `v0.9` |

The engine depends on `@sdxc/flags` for the vocabulary — `EvaluationContext`,
`ResolutionDetails`, `ErrorCode`, `Reason`. That root entry point holds types only and emits no
runtime code (ADR-059 decision 1), so the dependency costs a `package.json` line and nothing at
runtime, and the two halves cannot disagree about what a resolution is.

### 2. The engine is not a provider, and one entry point says how to make it one

The whole point of an engine is that the thing which answers "what is this flag worth" is
separable from the thing which satisfies OpenFeature's `Provider` interface. Three consumers
want the first without the second:

| Consumer                          | Wants                                                                    |
| --------------------------------- | ------------------------------------------------------------------------ |
| A worker evaluating its own flags | A `Provider`, so `@sdxc/flags` can drive it                              |
| An OFREP server                   | Evaluation over HTTP for clients that are not this repository            |
| An admin UI                       | A preview of what a rule would resolve to, for a context typed in a form |

Only the first wants a provider. An engine implemented as a provider would force the other two
to construct one, initialize it, and read back through four typed resolvers to ask a question
that has nothing to do with OpenFeature's lifecycle.

So the engine's surface is evaluation, and one entry point — `@sdxc/flags-engine/provider` —
holds the adapter from it to a `Provider`. That module is the only place in the package that
imports the provider half of `@sdxc/flags`.

### 3. Entry points

| Entry point                          | Contains                                                         |
| ------------------------------------ | ---------------------------------------------------------------- |
| `@sdxc/flags-engine`                 | The definition types, their schema, `evaluate` and `evaluateAll` |
| `@sdxc/flags-engine/store`           | The `FlagStore` interface and `FlagStoreError`                   |
| `@sdxc/flags-engine/store/memory`    | `InMemoryFlagStore`                                              |
| `@sdxc/flags-engine/store/worker-kv` | A store over a Cloudflare KV namespace                           |
| `@sdxc/flags-engine/conformance`     | The suite every store runs                                       |
| `@sdxc/flags-engine/provider`        | `EngineProvider`, the adapter onto `@sdxc/flags`                 |

A path says what a module is. Everything under `/store` is that one contract — the interface, its
error, and the two stores that implement it — so an import line says whether a module supplies
flags or consumes them, and a store an application writes itself sits at the same depth in its own
tree. This is the shape `@sdxc/flags` uses for `/provider` and `/provider/memory`, and the reason
to follow it here rather than the flat `./memory` of `@sdxc/cache` is that a reader moving between
the two packages should not have to learn two layouts for the same idea.

The conformance suite stays outside `/store` because it is not one, and `/provider` sits beside it
rather than under it: it is what consumes an engine, not what supplies it.

### 4. A flag is variants, a default, and an ordered list of rules

```typescript
interface FlagDefinition {
	/** The values this flag can take, by variant name. */
	variants: Record<string, FlagValue>;
	/** The variant served when no rule matches; absent means the caller's own default. */
	defaultVariant?: string;
	/** Serves the caller's default value with `reason: "DISABLED"` instead of evaluating. */
	state?: "enabled" | "disabled";
	/** Tried in order; the first whose condition holds decides the variant. */
	targeting?: TargetingRule[];
	metadata?: FlagMetadata;
}

interface TargetingRule {
	when: Condition;
	serve: string | Split;
}

interface Split {
	/** Weights by variant name, normalized against their own sum. */
	weights: Record<string, number>;
	/** The context field the bucket is drawn from. */
	by?: string;
	/** The string mixed into the hash, so two flags can share or avoid a bucketing. */
	seed?: string;
}
```

A rule list is the shape an operator already thinks in — "internal users get `on`, then EU
traffic gets `control`, then ten percent get `on`" — and it is the shape an admin UI renders as
rows. The first matching rule wins, and a flag whose rules all miss serves `defaultVariant`.

`defaultVariant` is optional, and a flag without one answers with the value the caller passed.
That is the case OFREP encodes by returning an entry with no `value` at all, and it is what
lets a flag exist to target a few subjects without the definition having to restate the default
already written at every call site.

The alternative, which the reference engine takes, is one expression that evaluates to a variant
name, with the split as a function inside it that returns a name. It composes further: a split
can sit inside a branch of a branch. It also means the definition has no list to render, no
position to reorder, and no answer to "which rule matched" beyond "the expression returned
`on`". A rule list answers all three, and the nesting it gives up is nesting inside `when`,
which is still there.

### 5. Conditions are a typed union, not an expression language

```typescript
type Condition =
	| { op: "all"; of: Condition[] }
	| { op: "any"; of: Condition[] }
	| { op: "not"; of: Condition }
	| { op: "eq" | "ne"; field: string; value: JSONPrimitive }
	| { op: "in" | "notIn"; field: string; values: JSONPrimitive[] }
	| { op: "lt" | "lte" | "gt" | "gte"; field: string; value: number }
	| { op: "startsWith" | "endsWith" | "contains"; field: string; value: string }
	| { op: "matches"; field: string; pattern: string }
	| { op: "semver"; field: string; compare: SemVerComparison; value: string }
	| { op: "exists"; field: string }
	| { op: "segment"; name: string }
	| { op: "always" };

/** A matching minor for `~`, a matching major for `^`. */
type SemVerComparison = "=" | "!=" | "<" | "<=" | ">" | ">=" | "~" | "^";
```

`field` is a dotted path into the merged evaluation context, so `plan.tier` reads a nested
structure and `country` reads a scalar. A path that resolves to nothing makes every operator
except `exists` and `not` false, which is what keeps a rule about a field the caller did not
send from matching everyone.

Every operator compares within one type. `eq` on a string field against a number is false rather
than coerced; `lt` against a value that is not a number is false. This is the one place where a
general expression language and a targeting language genuinely differ: an expression language
has to decide what `1 == "1"` means, and a targeting language does not have to be asked.

`segment` names a condition declared once at the top of the definition set, so "is an internal
user" is written in one place and referenced from twenty flags. Segments may reference segments;
a cycle is a definition error, caught when the set is parsed rather than on the request that
first walks it.

`matches` compiles its pattern with the `v` flag and no backreferences, and an expression that
does not compile fails the flag it belongs to at parse time.

`semver` takes the eight comparisons the reference engine defines — `=`, `!=`, `<`, `<=`, `>`,
`>=`, `~` for a matching minor and `^` for a matching major — as a field rather than as a range
string, so the set is closed, an editor offers it as a list, and nothing has to parse a range
mini-language. A field holding something that is not a version makes the condition false.

### 6. A split buckets on a hash of the subject

```typescript
{ when: { op: "always" }, serve: { weights: { on: 10, off: 90 } } }
```

The subject string is `${seed ?? flagKey}${context[by ?? "targetingKey"]}`. It is hashed with
MurmurHash3 x86 32-bit at seed 0, and the bucket is that hash scaled onto the weights' own sum by
a fixed-point multiply-high, then matched against a cumulative prefix sum:

```typescript
let bucket = Number((BigInt(hash) * BigInt(total)) >> 32n);
```

That is the reference engine's current algorithm rather than the one its specification page still
describes, which divided the hash by `MaxUint32` onto `[0, 100]` and so could not express a
bucket below one percent. Three properties follow, and each of them is the reason for a field
above:

| Property                                                | Comes from                                   |
| ------------------------------------------------------- | -------------------------------------------- |
| The same subject gets the same variant on every request | The hash is of the subject, and nothing else |
| Two flags at ten percent hit different tenths           | The flag key is in the hash by default       |
| Two flags can be made to hit the same tenth             | Both name the same `seed`                    |

Weights are whole numbers taken against their own sum rather than required to reach 100, so
`{ a: 1, b: 1 }` is a half-and-half split and a weight can be raised without rebalancing the
rest. MurmurHash3 is a non-cryptographic 32-bit hash: it is synchronous, which WebCrypto's
digest is not, it distributes evenly enough that a ten percent bucket is ten percent, and it is
what the reference engine uses, so a rollout percentage means the same thing in both.

A split evaluates against the field named by `by`, defaulting to `targetingKey`. When that field
is absent, the evaluation fails with `TARGETING_KEY_MISSING` and the caller's default value. A
split that quietly sent every anonymous request to one arm would report a rollout that never
happened, so the absence is reported where it can be fixed — by passing a session identifier, or
by bucketing on a field the application does have.

### 7. Values are checked against the type the caller asked for

Evaluation is generic over the four OpenFeature types. A variant holding a string, resolved
through `evaluate<boolean>`, is `TYPE_MISMATCH` with the caller's default — the same rule the
in-memory provider already applies, and the reason the engine takes the requested type rather
than reading whatever the variant holds.

### 8. Reasons are the specification's, and each one has exactly one cause

| Outcome                                               | `reason`          | `errorCode`             |
| ----------------------------------------------------- | ----------------- | ----------------------- |
| No targeting, and a `defaultVariant`                  | `STATIC`          |                         |
| A rule matched and named a variant                    | `TARGETING_MATCH` |                         |
| A rule matched and bucketed                           | `SPLIT`           |                         |
| Targeting ran and no rule matched                     | `DEFAULT`         |                         |
| No `defaultVariant` to fall back to                   | `DEFAULT`         |                         |
| `state: "disabled"`                                   | `DISABLED`        |                         |
| No flag under that key                                | `ERROR`           | `FLAG_NOT_FOUND`        |
| The definition did not parse                          | `ERROR`           | `PARSE_ERROR`           |
| The variant holds another type                        | `ERROR`           | `TYPE_MISMATCH`         |
| A split found no value under its bucketing field      | `ERROR`           | `TARGETING_KEY_MISSING` |
| `defaultVariant` names a variant that is not declared | `ERROR`           | `PARSE_ERROR`           |

`@sdxc/flags` already names all of these (ADR-059 decision 2), `SPLIT` and `PARSE_ERROR`
included, so the engine adds no vocabulary. A consumer reading `reason` alone can tell a flag
that is off from a flag system that is broken, which is the distinction that decides whether
people trust flags.

`SPLIT` is emitted where the reference engine reports `TARGETING_MATCH`, because the two answer
different questions: one says a rule selected this subject, the other says a rule put this
subject in a bucket, and telling them apart is what makes a rollout readable in the wide event.
`STALE` is not a reason here — an aged snapshot still resolves the variant it resolves, and
staleness is reported once on the provider's status rather than on every evaluation.

### 9. Evaluation is a pure, synchronous function

```typescript
export function evaluate<T extends FlagValue>(
	snapshot: FlagSnapshot,
	key: string,
	defaultValue: T,
	context?: EvaluationContext,
): ResolutionDetails<T>;

export function evaluateAll(
	snapshot: FlagSnapshot,
	context?: EvaluationContext,
): Record<string, ResolutionDetails<FlagValue>>;
```

No I/O, no clock beyond the one the snapshot was stamped with, no state. A snapshot and a
context in, a details structure out. That is what lets the same function serve a provider, an
HTTP endpoint and an admin preview, and it is what makes the targeting tests a table of inputs
and expected variants rather than a fixture with a store in it.

It is synchronous because it has nothing to await. A provider holding a loaded snapshot resolves
a flag without allocating a promise, which is exactly the case `Provider`'s `MaybePromise`
return was written for (ADR-059 decision 14).

`evaluateAll` exists for the bulk shape OFREP serves, where the caller has no per-flag default
value to fall back on. It reports the resolved value for every flag that resolves and an error
entry for every flag that does not, rather than dropping either.

### 10. The engine object owns the snapshot, and when to reload it

```typescript
let engine = createEngine({
	store: new WorkerKVFlagStore(env.FLAGS),
	maxAge: "5 minutes",
});

await engine.load(); // Result<FlagSnapshot, FlagStoreError>
engine.evaluate("new-checkout", false, { targetingKey: "user-1" });
```

The pure function needs a snapshot; something has to go and get one. The engine is that
something, and it is the whole of what the store interface is for:

- `load()` reads the store, parses the definitions once, and keeps the snapshot. It answers with
  a `Result`, because a store that cannot be reached is a legitimate configuration failure —
  the same split ADR-059 decision 20 draws between the evaluation path and the setup path.
- `evaluate` and `evaluateAll` delegate to the pure functions against the held snapshot, and
  report `PROVIDER_NOT_READY` before the first successful load.
- `stale` says whether the snapshot has passed `maxAge`. It is what `EngineProvider` reads to
  emit `PROVIDER_STALE`, so an application learns the definitions are aging from the status
  channel the specification already gives it. The engine does not refresh itself: a Worker has
  no timer outside a request, so reloading is something a caller schedules — on the next
  request, inside `waitUntil`, or from a cron trigger.

Parsing once per load rather than once per evaluation is the reason the snapshot exists as a
type of its own. A rule set is validated, its segments resolved and its patterns compiled when
it arrives; evaluating a flag then walks a structure that is already known to be well formed.

### 11. A definition that does not parse fails only itself

A flag set is parsed per flag. A flag whose targeting references an undeclared segment, whose
`defaultVariant` is not among its variants, or whose regular expression does not compile becomes
a parse failure recorded under its own key, and every other flag in the set resolves normally.
Evaluating the broken one answers with the caller's default and `PARSE_ERROR` carrying the
reason it failed.

The alternative is to reject the whole set, which turns one mistyped rule into every flag in the
application falling back at once. Per-flag isolation keeps the blast radius at the flag someone
just edited, and the failure is still loud: it is an error code on every evaluation of that key,
and the snapshot carries the list so a caller can log it once at load.

### 12. Definitions are parsed with `remix/data-schema`

The definition set arrives as JSON from a store the engine does not control, which is exactly
the boundary the repository validates at. The schema is the package's published contract for what
a flag is, and an admin UI writing definitions validates against the same schema before it writes
— so a rule that the engine would refuse cannot be saved in the first place.

### 13. Evaluation never throws, and never logs

Same rule as the client it feeds: every path answers with a details structure, a broken
definition included. Nothing on the evaluation path writes to the log either — the wide event
already carries one record per invocation with the flag key, reason and variant on it (ADR-033,
ADR-059 decision 9), and an engine that logged per evaluation would produce a line per flag per
request.

### 14. `FlagStore` reads, and the engine asks for everything

```typescript
export interface FlagStore {
	/** Every flag definition the engine may evaluate, as the store holds them. */
	read(): MaybePromise<Result<StoredFlagSet, FlagStoreError>>;
}

export interface StoredFlagSet {
	flags: Record<string, unknown>;
	segments?: Record<string, unknown>;
	/** What the store calls this revision, for a caller that caches snapshots. */
	version?: string;
}
```

One method, and it returns the whole set. A per-key read would be a smaller query for the common
case, and it is the wrong interface for three reasons: segments are shared, so resolving one
flag can need definitions the key does not name; `evaluateAll` would become one round trip per
flag; and a store is read once per snapshot, not once per evaluation, so the query that matters
is the one that fills the snapshot.

`read` may answer synchronously, so a store that already holds its set in memory answers without
allocating a promise, and a store over a synchronous API — a Durable Object's `SqlStorage`, say —
does not have to pretend otherwise.

Values arrive as `unknown` rather than as parsed definitions. A store's job is to produce the
JSON it holds; deciding whether that JSON is a valid flag is the engine's, in one place, with one
schema.

### 15. Writing is the store's own business, not the interface's

`FlagStore` has no `write`. Everything that reads flags — a provider, an OFREP server, a preview
— reads them, and an application that edits flags is an admin UI, which is one writer against one
store rather than a capability every store owes.

Each shipped store still exposes a `write` of its own, because a store that can only be read
leaves every application to invent the key names an admin writes back to:

```typescript
let store = new WorkerKVFlagStore(env.FLAGS);
await store.write({ flags: { "new-checkout": definition } }); // the store's method
await engine.load(); // the interface's method
```

So the capability exists where it is used and stays out of the contract the engine depends on. A
store that is genuinely read-only — a JSON file bundled with the worker, a remote endpoint — is a
complete implementation of `FlagStore` with nothing stubbed.

### 16. Two stores ship

| Store               | Holds                                                     |
| ------------------- | --------------------------------------------------------- |
| `InMemoryFlagStore` | An object, for tests and for flags compiled into a worker |
| `WorkerKVFlagStore` | One JSON value under one key in a KV namespace            |

KV holds the whole set as one value under one key, which is the read shape KV is good at: a
snapshot is one `get`, the read is served from the edge cache, and writes are rare enough that
rewriting the value costs nothing worth optimizing.

A SQL store — a row per flag in D1, or the same table inside a Durable Object — deliberately does
not ship. A row per flag is a schema, and what that row holds is the application's question, not
the package's: a multi-tenant flag service keys every flag by the tenant it belongs to, and a
single-tenant application does not. A shipped store would have to pick one, which makes it wrong
for the other, or take the tenancy as options until it is a small ORM.

Shipping one also means shipping what a schema drags behind it: a `remix/data-table` dependency
on a package that otherwise has none, a migration to create the table, and a way for a consumer
to find that migration and apply it on its own schedule. `@sdxc/blog-engine` carries that weight
because it owns an application's whole schema; an evaluation engine reading a rule set has no
business acquiring a database.

The interface is one method, so the application writes that store as a file of its own, against
its own tables and its own migrations, and runs the same conformance suite the two shipped ones
do. Scoping is where it belongs while it is there: a store constructed for one tenant reads that
tenant's flags, and the engine never learns a tenant exists.

### 17. Stores run a conformance suite

```typescript
import { conformance } from "@sdxc/flags-engine/conformance";

conformance("worker-kv", () => new WorkerKVFlagStore(env.FLAGS));
```

The assertions are the same for every store and are the ones a store's own tests tend to skip:
that an empty store reads as an empty set rather than a failure, that a value that is not JSON
is a `FlagStoreError` rather than a throw, that reading twice gives the same set, and that a
store which also writes reads back exactly what it wrote. The shape ADR-043, ADR-053 and
ADR-054 all use.

The KV run goes in a `*.workers.test.ts`, against a real binding, for the reason the repository
already keeps binding tests there — and it is what a store written in an application runs too.

### 18. The provider is a wrapper, and it is small

```typescript
import { createFlags } from "@sdxc/flags/client";
import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { WorkerKVFlagStore } from "@sdxc/flags-engine/store/worker-kv";

export const flags = createFlags({
	provider: () => new EngineProvider(createEngine({ store: new WorkerKVFlagStore(env.FLAGS) })),
});
```

`EngineProvider` implements `Provider` over an engine and nothing else: `initialize` calls
`load` and emits `PROVIDER_READY` or `PROVIDER_ERROR`, the four resolvers call `evaluate` with
their type, and `refresh` reloads and emits `PROVIDER_CONFIGURATION_CHANGED`. It holds no rules,
no hash and no schema, which is the demonstration that the engine is usable without it.

An OFREP server is the other wrapper, and it is a route rather than a class: a handler that
parses the body, calls `evaluateAll` or `evaluate`, and writes the protocol's response shape. It
ships when something needs it — the same deferral ADR-059 made for the OFREP client — and the
engine owes it nothing beyond the two functions it already exports.

## Consequences

### Positive

- **A flag can be evaluated without an OpenFeature runtime.** An admin preview, a test and an
  HTTP endpoint call the same function the provider calls, with no lifecycle to satisfy.
- **The first useful provider exists.** `@sdxc/flags` ships two providers that answer with
  defaults and with what a test put in them; this is the one that resolves real flags.
- **Where flags are stored is a constructor argument.** A KV namespace, an object literal, or a
  store an application wrote itself are the same engine with a different constructor argument.
- **Targeting is typed.** A rule is a discriminated union, so an editor completes the operators,
  the type checker rejects a comparison that cannot hold, and an admin UI can be generated from
  the schema rather than hand-kept in step with it.
- **A rollout is reproducible.** The same subject lands in the same bucket on every request and
  in every worker, and two flags at the same percentage cover different subjects unless they are
  told to share.
- **A broken rule breaks one flag.** Per-flag parsing keeps a bad edit off every other flag in
  the application.
- **Evaluation is synchronous.** A resolver over a loaded snapshot costs a function call.

### Negative

- **The definition format is ours.** A definition written for another engine does not load here
  without translation, and a definition written here means nothing to another engine's tooling.
- **The rule language will be asked to grow.** Every targeting language accretes operators, and
  each one added here is a schema change, a conformance case, and an admin UI control.
- **Nothing refreshes on its own.** A Worker has no background timer, so a definition changed in
  KV reaches an isolate when something reloads the engine, and "something" is the application's
  decision rather than the package's.
- **Snapshots are per isolate.** Every isolate reads the store once and holds its own copy, so
  two requests seconds apart can see different definitions while a rollout propagates.
- **Scoping a store means an engine per scope.** A store built for one tenant carries one tenant's
  flags, so a multi-tenant service holds an engine per tenant and decides itself how many of them
  an isolate keeps.
- **A split needs a stable subject.** Anonymous traffic gets `TARGETING_KEY_MISSING` until the
  application passes a session identifier, which is one more thing a middleware has to supply.
- **A SQL store is the application's to write.** An application that wants a row per flag writes
  that store, its table and its migration itself. That is the right owner for a schema whose
  columns depend on whether the application is multi-tenant, and it keeps the package free of
  `remix/data-table` and of a migration consumers would have to find and apply — but it is still
  a file two applications could end up writing twice.
- **A scheduled rollout is the application's clock.** Without expression-valued weights, widening
  a rollout on a date means two rules and a context field carrying the current time, rather than
  one rule that knows what day it is.
- **Two packages to keep in step.** A reason or error code added to `@sdxc/flags` is one the
  engine has to decide whether to emit.

### Neutral

- **The bucketing hash is a compatibility choice.** MurmurHash3 is here because a percentage
  should mean the same thing as elsewhere; nothing in the design depends on which hash it is.
- **No consumer is migrated by this ADR.** Adoption is per app, one flag at a time, the same way
  ADR-059 left it.
- **The OFREP server stays deferred.** The engine makes it a route; writing it waits for a
  consumer outside this repository.
- **`evaluateAll` ships before the endpoint that needs it**, because the bulk shape is what
  proves the engine does not depend on a caller-supplied default.

## Implementation Plan

### Phase 1: The Definition And Its Schema

**Priority:** High
**Estimated Effort:** 4 hours

1. `FlagDefinition`, `TargetingRule`, `Condition`, `Split`, `FlagSnapshot` at the root.
2. The `remix/data-schema` schemas that parse a stored set into them.
3. Per-flag parse isolation, segment resolution and cycle detection.

### Phase 2: Evaluation

**Priority:** High
**Estimated Effort:** 5 hours

1. Condition evaluation over a dotted-path context reader, one operator at a time.
2. MurmurHash3 and the split bucketing, with a distribution test over a large sample.
3. `evaluate` and `evaluateAll`, including the type check and the reason table of decision 8.
4. A table-driven test per operator and per reason.

### Phase 3: The Store Contract And The Engine

**Priority:** High
**Estimated Effort:** 4 hours

1. `FlagStore`, `FlagStoreError` and `InMemoryFlagStore`.
2. `createEngine`: `load`, `stale`, the held snapshot, and the not-ready path.
3. The conformance suite, run against the in-memory store.

### Phase 4: The KV Store

**Priority:** High
**Estimated Effort:** 2 hours

1. `WorkerKVFlagStore`, with its `write`.
2. A `*.workers.test.ts` conformance run against a real binding.

### Phase 5: The Provider

**Priority:** High
**Estimated Effort:** 3 hours

1. `EngineProvider`, its lifecycle and its events.
2. Run `@sdxc/flags`'s provider conformance suite against it.
3. Package README per the package documentation guide.

### Phase 6: Adoption

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Put one real flag behind the engine in one app, over KV.
2. A minimal admin route that writes a definition, to prove the write path outside the package.

## Alternatives Considered

### 1. Run flagd

Deploy the reference engine as a container and point providers at it over gRPC or OFREP.
Rejected because every consumer here is a Cloudflare Worker: there is nowhere to run a container
next to one, so the engine would be a network hop to another cloud on the critical path of every
request that reads a flag, with its own availability and its own bill. The point of an engine
that is a library is that a Worker evaluates in the isolate, against a snapshot it already
holds.

### 2. JsonLogic as the targeting language

Adopt the reference engine's rule language, so definitions are portable and its editors and
validators work. Genuinely tempting, and rejected on three counts. Its comparison operators
coerce across types, which puts `1 == "1"` into a language whose whole job is deciding who sees
what. Its rules are arbitrary nested JSON, so a rule set has no type beyond `JSONValue` and an
admin UI cannot be generated from it or validated against it before saving. And the evaluator is
around twenty operators of loosely specified semantics, which is more code than the typed union
and harder to test, for a portability nothing here is asking for.

### 3. Adopt the reference engine's definition format, with our own rule language

Keep `flags`, `variants`, `defaultVariant`, `state` and `metadata` exactly, and swap only
targeting. Partly taken: those field names are the ones in decision 4, because they are good
names and the familiarity is free. Full compatibility was rejected because the format's targeting
is its interesting half, so a set that shares everything but that would claim a portability it
does not have.

### 4. The engine is a `Provider`

The obvious shape, and what every other flag system's SDK does. Rejected for the reason this ADR
exists: an OFREP server, an admin preview and a test would each have to construct a provider and
read through four typed resolvers to ask a question OpenFeature has nothing to do with. The
provider is fifty lines on top, and putting it on top costs the engine nothing.

### 5. A `FlagStore` with `read(key)` instead of `read()`

One flag per query, which is the smaller read for a single evaluation. Rejected because segments
are shared across flags, so resolving one key can need definitions the key does not name;
because `evaluateAll` would be a round trip per flag; and because the read that actually happens
is one per snapshot, not one per evaluation.

### 6. `write` on the `FlagStore` interface

What the interface would look like if the admin UI were in scope. Rejected because it would make
every read-only source — a bundled JSON file, an HTTP endpoint — implement a method that throws,
which is the stub the interface exists to avoid. The shipped stores have their own `write`, so
nothing is lost except the obligation.

### 7. The engine caches and refreshes itself

A TTL, a refresh on read, and a stale-while-revalidate. Rejected because a Worker has no
scheduler outside a request: a background refresh has to be attached to something's
`waitUntil`, and the engine does not have one. `maxAge` and `stale` give a caller what it needs
to decide, and `@sdxc/cache` already exists for a caller that wants the snapshot cached across
isolates.

### 8. Boolean targeting with a separate rollout percentage

`{ when, serve }` where `when` is a condition and rollouts are a `percentage` field beside it,
rather than a split among weighted variants. Rejected because it only expresses two arms: a
three-way experiment needs weighted variants anyway, and a percentage field would then be a
special case of the split that also exists.

### 9. Several stores merged by declaration priority

What the reference engine does: read a file, an HTTP endpoint and a Kubernetes resource at once,
key flags by flag set, and let the last-declared source win on a duplicate. Rejected because it
answers a deployment question that does not arise here — one process serving flags authored in
four places by four teams. There is one authoring surface per application, so the merge would be
a code path with no caller, and an application that later grows a second source composes the two
inside a `FlagStore` of its own, which is one method.

### 10. Weights that are expressions, over an injected timestamp

The reference engine lets a weight be a rule and injects `$flagd.timestamp`, which together
express a rollout that widens on a schedule with no redeploy and no edit. Rejected because it
makes every weight a rule to evaluate, parse and render, and the same rollout is two rules over a
field the application already sends: one matching before the cutover date with the old weights,
one after it with the new ones. The weights stay integers, and the clock stays the caller's.

### 11. Targeting as a JavaScript function, as the in-memory provider takes

`contextEvaluator: (context) => string | undefined` is what `InMemoryProvider` already uses and
it is the most expressive option there is. Rejected because a rule has to survive a round trip
through a store as data. A function cannot be stored, edited in a form, or reviewed; the in-memory
provider can take one precisely because its flag set is written in a test file.

## References

- [ADR-059: Flags Package Implementing OpenFeature](./ADR-059-flags-package-implementing-openfeature.md) — the client and provider halves this builds on
- [ADR-043: Billing Package With Pluggable Providers](./ADR-043-billing-package-with-pluggable-providers.md) — contract plus adapters, and the generated conformance suite
- [ADR-053: Cache Package With Adapters](./ADR-053-cache-package-with-adapters.md) — the interface-not-base-class shape
- [ADR-054: Jobs Package With Queue Adapters](./ADR-054-jobs-package-with-queue-adapters.md) — flat adapter subpaths beside a contract module
- [ADR-033: Wide Events As The Logging Contract](./ADR-033-wide-events-as-the-logging-contract.md) — why evaluation does not log
- [Section 2: Provider](../vendor/openfeature/sections/02-providers.md) — what `EngineProvider` satisfies
- [Appendix C: OFREP](../vendor/openfeature/appendix-c/index.md) — the protocol the bulk shape serves
