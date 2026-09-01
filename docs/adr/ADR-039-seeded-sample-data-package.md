# ADR-039: Seeded Sample Data Package And The `sample` Spec Capability

## Status

**Proposed** - 2026-08-31

## Background

A `.spec` suite that exercises a real application has to invent input: a name to
sign up with, an email that is unique per run, a body of text long enough to
trip a length limit. Today every one of those values is a literal typed into the
suite, so two suites sign up as the same person, a uniqueness constraint has to
be worked around by hand, and a test that needs fifty rows cannot have them.

The same gap exists outside `.spec`. Applications need believable rows for local
development, for a demo tenant, and for load checks, and each app grows its own
half-page of hardcoded arrays to produce them.

The obvious answer is Faker.js. It is excluded by decision: this monorepo will
not take the dependency, and the replacement will not be called `faker`. What
follows records what is built instead, why it is a package rather than part of
`@pkg/spec`, and how a generator that is random by definition is made
reproducible enough to live inside a test runner.

## Context

### Current State

| Location                           | How fake data is produced today                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/spec/spec/*.spec`        | String literals typed into each test                                                |
| `packages/spec/examples/**`        | The same, duplicated per example suite                                              |
| Application seeding and demos      | Ad-hoc arrays and `Math.random()` at the call site                                  |
| `packages/uuid`, `packages/typeid` | Real identifiers, unseeded — correct for production, useless for reproducible tests |

### Issues Identified

| Issue                                           | Impact                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| Literal inputs are shared across tests          | Two suites collide on a unique column; the second fails for the wrong reason |
| No way to produce N of something                | Pagination, list ordering, and limits cannot be specified at all             |
| `Math.random()` at a call site                  | A failure cannot be replayed; the value that broke it is gone                |
| Per-app arrays of names and words               | The same list, written four times, drifting                                  |
| Test data can name real people and real domains | A fake email that resolves is an email that can be delivered by accident     |

### Constraints

1. **No Faker.js, and not named `faker`.** Neither the dependency nor the name.
2. **Reproducible by default.** A spec runner may not produce a failure that
   cannot be replayed. Randomness has to be seeded, and the seed has to be
   derivable from the test's identity, not from wall-clock or call ordering.
3. **Concurrency-safe.** Tests run in parallel with bounded concurrency
   ([spec ADR-014](./spec/ADR-014-compiled-binary-and-concurrency.md)), so the
   values a test sees must not depend on how it interleaves with other tests.
4. **Capability, never grammar.** New power in `.spec` arrives as tools in a
   namespace; the language gains no syntax
   ([spec ADR-002](./spec/ADR-002-specification-language-design.md)).
5. **Runs on Workers.** Applications consume this from a Worker, so: no Node
   built-ins, no filesystem, zero runtime dependencies, and locale data small
   enough that importing it is not a bundle decision.

## Decision

Create `@pkg/sample`, a zero-dependency seeded generator of believable values,
and expose it to `.spec` as the built-in `sample` capability. This ADR is the
record for both halves; the `docs/adr/spec` chain links here rather than
restating the capability.

### 1. The Name

The package is `@pkg/sample` and the spec namespace is `sample`. It reads as
what the calls do — draw a value from a set or a range — and it fits the
repository's one-word, descriptive package names.

Two candidates were unavailable. `faker` is excluded by the decision above.
`fixture` is a **reserved word in the `.spec` grammar**
(`packages/spec/src/tokens.ts`), and the lexer rejects a keyword inside a dotted
name, so `fixture.email` could never be written even if the package were named
that.

### 2. Three Layers, Separately Usable

```
Random      seeded 32-bit PRNG: int, float, bool, pick, shuffle, derive
Dataset     plain data: word lists, name lists, per locale
Sample      Faker-shaped modules composed over a Random and a Dataset
```

Splitting them is what lets the spec runtime own the entropy (below) while the
generators stay stateless with respect to the runtime.

#### `Random`

`sfc32` (128 bits of state across four 32-bit words), seeded through a `cyrb128`
string hash so a seed may be a number or a string. Roughly fifteen lines, no
dependency, and good enough statistically that value distributions are not
visibly clumped.

```ts
import { createRandom } from "@pkg/sample";

let random = createRandom("signup-suite");

random.int(1, 10); // inclusive on both ends
random.float(0, 1);
random.bool(0.25); // true a quarter of the time
random.pick(["a", "b", "c"]);
random.shuffle(items); // a copy; the input is not mutated
```

`random.derive(label)` returns an **independent** stream seeded from
`hash(seed, label)`. It deliberately does not draw from its parent, so a derived
stream's values do not move when a call is added upstream:

```ts
let orders = random.derive("orders"); // stable regardless of what the parent did
```

#### `Sample`

```ts
import { createSample } from "@pkg/sample";

let sample = createSample({ seed: 42 });
```

| Option | Type                         | Default      | Meaning                                                |
| ------ | ---------------------------- | ------------ | ------------------------------------------------------ |
| `seed` | `number \| string \| Random` | required     | The stream. No implicit seed, ever.                    |
| `data` | `Dataset`                    | `en`         | The word and name lists to draw from.                  |
| `now`  | `Date`                       | `new Date()` | The reference instant the `date` module measures from. |

`seed` is required because a default seed is the one design mistake that cannot
be corrected later: every caller that forgot to pass one becomes unreproducible.
An application that genuinely wants a fresh stream per process asks for it
(`seed: systemSeed()`, backed by `crypto.getRandomValues`) and can log the
number it got back from `sample.seed`.

### 3. The Module Surface

Faker-shaped: modules on an instance, options as an object argument.

```ts
sample.person.firstName(); // "Marta"
sample.person.lastName();
sample.person.fullName();
sample.person.record(); // { firstName, lastName, fullName, email, username }

sample.internet.email({ firstName: "Marta", lastName: "Ibáñez" });
sample.internet.username();
sample.internet.domain();
sample.internet.url();
sample.internet.password({ length: 16 });

sample.location.city();
sample.location.country();
sample.company.name();

sample.lorem.words(3);
sample.lorem.sentence();
sample.lorem.paragraph({ sentences: 4 });

sample.number.int({ min: 1, max: 100 });
sample.number.float({ min: 0, max: 1, fractionDigits: 2 });

sample.string.uuid();
sample.string.alphanumeric(12);
sample.string.hex(32);

sample.date.past({ days: 30 });
sample.date.future({ days: 30 });
sample.date.between({ from, to });

sample.helpers.pick(items);
sample.helpers.pickMany(items, { count: 3 }); // distinct
sample.helpers.shuffle(items);
sample.helpers.multiple(() => sample.person.record(), { count: 50 });
sample.helpers.maybe(() => sample.internet.url(), { chance: 0.3 }); // value or null
```

`person.record()` exists because the correlated case is the common one: an email
that matches the name it belongs to. Composing it by hand — generate a name,
pass it to `internet.email` — stays available; the record is the shortcut.

Three deliberate differences from Faker:

- **No default exported instance.** Faker ships a module-level `faker` whose
  stream is process-global; a package doing that here would also be doing work
  in Worker global scope. Every consumer constructs its own.
- **`date` measures from an injected `now`.** Reading the clock inside the
  generator would make a seeded run irreproducible on a different day.
- **Locale is a value, not global state.** `data` is passed in, so two instances
  in one process can draw from different datasets.

### 4. Datasets Are Ours, And The Values Are Unroutable

`data/en` is authored in this repository: roughly 100 first names, 100 last
names, 80 cities, 40 countries, 60 company words, and a ~200-word lorem list.
They are written here rather than copied out of another project's data files, so
provenance and licensing are not questions anyone has to answer later. Each
dataset is its own module (`@pkg/sample/data/en`) so a bundle carries only the
one it imports.

Generated values are, by construction, incapable of reaching a real person:

| Kind  | Rule                                                          |
| ----- | ------------------------------------------------------------- |
| Email | `example.com`, `example.org`, `example.net` only (RFC 2606)   |
| URL   | Subdomains of the same reserved domains                       |
| Phone | Reserved `555` ranges                                         |
| Names | Common given and family names, never a specific public figure |

`string.uuid()` draws from the seeded stream, so it is reproducible and
therefore **not** cryptographically random. Its JSDoc says so, and points at
`@pkg/uuid` for anything a real system depends on.

### 5. The Determinism Contract

Stated once, in the README and in this ADR, because everything downstream leans
on it:

- Same seed, same package version, same sequence of calls, same values.
- Adding a call shifts every value after it in that stream. Use `derive(label)`
  for values that must stay put.
- Changing a dataset entry or the PRNG changes outputs for a fixed seed. That is
  a behavior change, noted in the package's release notes, and it is the reason
  a spec should assert the **shape** of a generated value rather than its text.

### 6. The `sample` Spec Capability

A new built-in plugin, registered in `packages/spec/src/builtins.ts` alongside
`url` and `jwt`.

#### Tools

Every tool needs **no permission**: generation is pure computation with no I/O
and no host state.

| Tool                     | Result                                                  |
| ------------------------ | ------------------------------------------------------- |
| `sample.person`          | `{ first_name, last_name, full_name, email, username }` |
| `sample.email`           | A string                                                |
| `sample.uuid`            | A string                                                |
| `sample.int <min> <max>` | A number, inclusive                                     |
| `sample.words <count>`   | A string of `count` lorem words                         |
| `sample.pick <list>`     | One element of a list value                             |

Six tools, because six cover the suites that exist. More are added when a suite
needs them, the same way [spec ADR-016](./spec/ADR-016-oauth-oidc-testing-tools.md)
deferred PKCE helpers until a flow under test used PKCE.

`sample.person` and `sample.email` take no arguments, so
[spec ADR-017](./spec/ADR-017-zero-arg-tool-calls.md)'s rule already makes
`let user = sample.person` bind:

```
use sample
use http

test "signing up creates an account" {
	given {
		let user = sample.person
	}
	when {
		let response = http.post "http://localhost:3000/signup" form {
			email: user.email
			name: user.full_name
		}
	}
	then {
		expect response.status 201
	}
}
```

Every tool is declared `kind: "action"`, not `observable`. A generator advances
its stream, so it is not an observation, and the classification is what stops it
from appearing inside `eventually` or heading the observable form of `expect` —
polling until a random value matches is never what an author meant.

#### Where The Stream Lives

Plugins are constructed **once per run** and shared by every concurrently
executing test, so a generator held inside the plugin would hand values out in
whatever order the tests happened to interleave. The stream therefore lives
where per-test state already lives:

1. `ToolContext` gains `random: Random`, beside `workspace` and `permissions`.
2. `run.ts` creates it per test, next to the workspace, seeded
   `hash(runSeed, file, test.name)`.
3. `ToolContext` also carries the test's frozen `now`, so date values are stable
   within a test.

Deriving the seed from the test's **identity** rather than from a counter is the
part that satisfies constraint 3: a test gets the same values whether it runs
first, last, or in parallel with ten others, and whether or not the tests around
it were filtered out. The plugin itself stays stateless — it reads
`context.random` and returns a value — and any future tool that needs randomness
(a nonce, a PKCE verifier) draws from the same reproducible source for free.

#### The Run Seed

`spec run --seed=<value>` sets the run seed; it defaults to a fixed constant, so
a suite run twice gives identical data with no flag at all. `--seed=random`
draws one and the reporter prints it in the summary, which is how a suite is
shaken for hidden dependence on specific values while keeping any failure
replayable by passing the printed seed back.

### 7. Out Of Scope For v1

Deferred until something asks: `commerce`, `finance`, `image`, `music`, and the
rest of Faker's long tail; locales beyond `en`; Faker's `unique` helper (a
seeded stream can repeat, and the honest fix — a per-instance seen-set — is
state this package currently does not carry); and a `sample.date` spec tool,
which wants a frozen-clock capability decided on its own terms.

## Consequences

### Positive

- **Failures replay.** A spec that fails on generated data fails the same way on
  the next run, without a flag and without recording fixtures.
- **Concurrency changes nothing.** Values follow test identity, so raising
  `--concurrency` or filtering the suite does not move them.
- **One list of names.** Applications, demos, and specs draw from the same
  dataset instead of four private arrays.
- **Nothing reaches a real inbox.** Reserved domains and 555 numbers are
  structural, not a review item.
- **Small on Workers.** Zero dependencies and a per-locale data module, against
  Faker's multi-megabyte install and bundled locale set.
- **The seam generalizes.** `ToolContext.random` gives every present and future
  plugin a reproducible entropy source.

### Negative

- **A dataset we maintain.** Name and word lists are ours to grow, and they
  start smaller and less varied than Faker's.
- **Seeded output is brittle to insertion.** Adding a generator call shifts
  everything after it in that stream; `derive` mitigates it but has to be
  remembered.
- **`ToolContext` grows a field.** Every plugin implementation and every test
  fake that builds a context is touched, even though only one plugin reads it.
- **Not Faker's API.** Anyone carrying Faker habits will reach for
  `faker.datatype.number` and `person.jobTitle` and not find them.
- **Reproducible UUIDs are a trap.** `string.uuid()` looks like a real
  identifier; only its documentation says it must never guard anything.

### Neutral

- **`action`, not `observable`.** A correct classification that also reads as a
  restriction the first time someone tries to poll on a generated value.
- **Seeds are not secrets.** They appear in reporter output by design.
- **`en` only.** The dataset seam exists; the second locale is unwritten until
  something needs it.

## Implementation Plan

### Phase 1: The Package Core

**Priority:** High
**Estimated Effort:** 3 hours

1. `packages/sample` with `createRandom` (sfc32 + cyrb128), `derive`, and unit
   tests asserting: a fixed seed reproduces a fixed sequence, `derive` is
   insertion-independent, `shuffle` does not mutate, ranges are inclusive.
2. `data/en` and the `Dataset` type.
3. `createSample` with `person`, `internet`, `lorem`, `number`, `string`,
   `location`, `company`, `date`, `helpers`.
4. README carrying the determinism contract and the reserved-domain rule.

### Phase 2: The Spec Capability

**Priority:** High
**Estimated Effort:** 2 hours

1. Add `random` and `now` to `ToolContext`; thread them from `run.ts` through
   `ExecutionContext` into the dispatch in `executor.ts`; update test fakes.
2. `packages/spec/src/plugins/sample.ts` with the six tools; register it in
   `builtins.ts`.
3. `--seed=<value>` in `cli.ts`, seed line in the reporter summary.
4. A dogfood `.spec` file proving the same test yields the same values across
   two runs, and different values under two different `--seed` values.

### Phase 3: Adoption

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Convert the example suites' literal inputs to `sample` calls.
2. Replace one application's hand-rolled seed arrays with `@pkg/sample`.
3. Record the capability in `packages/spec/README.md` and `GRAMMAR.md` notes.

## Alternatives Considered

### 1. Depend On `@faker-js/faker`

**Rejected because**: excluded by decision, and independently a poor fit — its
default instance is process-global and unseeded, its locale data dominates a
Worker bundle, and its API surface is far larger than anything here uses.

### 2. Name It `fixture`

**Rejected because**: `fixture` is a reserved keyword in the `.spec` grammar, so
the namespace could never be written.

### 3. Keep Generation Inside `@pkg/spec`

**Rejected because**: applications need the same values for seeding and demos,
and the spec runtime would end up owning name lists that have nothing to do with
running specs.

### 4. A Random Literal In The Grammar

**Rejected because**: capability arrives as tools, never grammar
([spec ADR-002](./spec/ADR-002-specification-language-design.md)). The language
stays declarative.

### 5. Hold The Generator In The Plugin, Keyed By Test

**Rejected because**: plugins are built once per run and shared across
concurrent tests. Keying a map by test identity would work but leaves mutable
run-scoped state in a plugin whose lifetime is the whole run, when the runtime
already creates and discards per-test state for exactly this purpose.

### 6. Pure Tools With An Author-Supplied Label

`sample.email "signup"` hashing `(runSeed, label)` would be stateless and
concurrency-proof with no protocol change.

**Rejected because**: it puts a naming burden on every call, and two calls that
forgot to differ silently return the same value — a uniqueness bug that reads as
a suite bug.

### 7. `Math.random()` Or `crypto.getRandomValues()` Directly

**Rejected because**: a failure that cannot be replayed is the problem this ADR
exists to avoid.

## References

- [spec ADR-002: Specification Language Design](./spec/ADR-002-specification-language-design.md)
- [spec ADR-004: Runtime And Plugin Protocol](./spec/ADR-004-runtime-and-plugin-protocol.md)
- [spec ADR-014: Compiled Binary And Concurrent Execution](./spec/ADR-014-compiled-binary-and-concurrency.md)
- [spec ADR-016: OAuth / OIDC Testing Tools](./spec/ADR-016-oauth-oidc-testing-tools.md)
- [spec ADR-017: Zero-Argument Tool Calls](./spec/ADR-017-zero-arg-tool-calls.md)
- [ADR-017: README As Package Description Source Of Truth](./ADR-017-readme-package-description-source-of-truth.md)
- [RFC 2606: Reserved Top Level DNS Names](https://datatracker.ietf.org/doc/html/rfc2606)

## Notes

- The package is `private: true` like the rest of `packages/*`, and ships
  TypeScript sources with no build step.
- `sfc32` and `cyrb128` are public-domain snippets small enough to be written
  and tested here rather than depended upon; both are covered by unit tests
  pinning a known sequence, which is what makes an accidental change to either
  fail loudly instead of silently reshuffling every suite's data.
- The seed a `--seed=random` run prints is the whole reproduction recipe: same
  seed plus same version reproduces every test's values exactly.
