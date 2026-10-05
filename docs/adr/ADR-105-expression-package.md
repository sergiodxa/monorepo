# ADR-105: Expression Package

## Status

**Accepted** - 2026-10-05

## Background

`@sdxc/flags-engine` describes who sees a flag variant with a condition language: a typed JSON
union (`{ op: "eq", field: "plan.tier", value: "pro" }`) composed with `all`, `any` and `not`,
read through dotted paths, compiled once per snapshot and evaluated as a pure function. That
language is not specific to feature flags. Anything that stores a rule as data and asks whether
it holds for a context needs the same pieces: a schema to validate the stored rule, a compile
step that catches bad patterns and reference cycles, and evaluation semantics that never coerce
across types.

Today that language is private to `@sdxc/flags-engine`, and the only way to write a condition is
as JSON. That fits a store but not a person typing a rule into an admin form or a config file.

## Context

### What the flags engine owns today

| Piece                                                                | Location                                                 | Specific to flags? |
| -------------------------------------------------------------------- | -------------------------------------------------------- | ------------------ |
| `Condition` union and `CONDITION_SCHEMA`                             | `src/definition.ts`, `src/schema.ts`                     | No                 |
| Dotted path reading (`plan.tier`, `roles.0`)                         | `src/lib/path.ts`                                        | No                 |
| Operator semantics (`matchesCondition`)                              | `src/lib/condition.ts`                                   | No                 |
| Compiling: `v`-flag regexes, segment resolution with cycle detection | `src/parse.ts` (`compileCondition`, `resolveSegment`)    | No                 |
| `semver` operator                                                    | `src/lib/condition.ts`, via `@sdxc/semver`               | Mostly             |
| Segments as named, shared conditions                                 | `src/parse.ts`                                           | The name is        |
| Rules, variants, splits, MurmurHash3 bucketing, reasons              | `src/evaluate.ts`, `src/lib/split.ts`, `src/lib/hash.ts` | Yes                |

### Semantics worth keeping

These are documented in the flags-engine README and covered by its tests:

- A path that resolves to nothing makes every operator except `exists` false, so a rule about
  a field the caller left out never matches everyone.
- Every operator compares within one type. `eq` between a string and a number is false, and
  `lt` on a non-number is false.
- `matches` compiles with the `v` flag at compile time, so a bad pattern fails the definition,
  not a request.
- A `Date` in the context is a value, not a structure to walk into.
- A reference to a named condition resolves once, is memoized, and a cycle fails compilation.

### Other condition-shaped code in the repo

| Location                            | What it does                                                                          | Fit                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/logger/src/sample.ts`     | `keep?: (fields) => boolean` exempts logs from sampling                               | Good: a function is code-only, and an expression lets the exemption come from config or env                                        |
| `apps/reader/app/lib/rule-match.ts` | A reader's filter rule: one field, case-insensitive substring, guaranteed linear time | Later: a language limited to `contains` over folded text keeps the guarantee and allows compound rules                             |
| `packages/scim/src/lib/filter/*`    | RFC 7644 filter grammar compiled to `remix/data-table` queries                        | No: the grammar is fixed by the RFC, matching is case-insensitive per attribute, and it compiles to a query, not an in-memory test |
| `packages/result/src/retry.ts`      | The `when` predicate over errors                                                      | No: a predicate over a thrown value is code, never stored data                                                                     |

The principle that separates these: an expression is for a condition that is **data**
(stored, edited, configured, sent over the wire). A condition that only ever exists in source
stays a function.

## Decision

Add `@sdxc/expression`: the condition language extracted from `@sdxc/flags-engine`, extended
through operator definitions, and written either as the JSON form or as a text form that parses
to the same tree. `@sdxc/flags-engine` is its first consumer, and its stored JSON contract does
not change.

### Scope

An expression is a boolean condition over a context. Value expressions (arithmetic,
assignment) are out of scope until a consumer needs them, since they change the missing-field
and no-coercion rules every current consumer relies on.

### Languages

A consumer defines its dialect once with `createLanguage`, and the result carries everything
typed to that dialect: the schema, compile, evaluate, parse and stringify.

```typescript
import { createLanguage, defineOperator } from "@sdxc/expression";
import { satisfies } from "@sdxc/semver";
import * as s from "remix/data-schema";

export let flagConditions = createLanguage({
	reference: "segment",
	operators: [
		defineOperator({
			op: "semver",
			args: ["field", "compare", "value"],
			schema: s.object({ compare: SEMVER_COMPARISON_SCHEMA, value: s.string() }),
			test: (value, node) =>
				typeof value === "string" && satisfies(value, node.compare, node.value),
		}),
	],
});

type FlagCondition = typeof flagConditions.Expression;
```

- **Built-in operators** are the ones the flags engine has now except `semver` and `segment`:
  `all`, `any`, `not`, `eq`, `ne`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte`, `startsWith`,
  `endsWith`, `contains`, `matches`, `exists` and `always`. A language may restrict them with
  `builtins: [...]`, which is how a consumer guaranteeing linear time leaves out `matches`.
- **Field operators** declared with `defineOperator` receive the value already read from the
  path. The language answers `false` for a missing field before `test` runs, so an extension
  cannot break that rule. A `compile` hook (`Result`-returning) prepares work once, the way
  `matches` builds its `RegExp`, and `test` receives what it prepared as a third argument.
- **References** name shared conditions. `reference` sets the operator's spelling, so the flags
  engine keeps `{ op: "segment", name }` in stored sets. A language without `reference` has no
  reference operator.

### Compiling and evaluating

```typescript
let compiled = flagConditions.compile(definition.when, { references: segments });
// Result<Compiled, ExpressionError>

if (isSuccess(compiled)) {
	flagConditions.evaluate(compiled.data, context); // boolean
}

flagConditions.schema; // Standard Schema for the JSON form, as CONDITION_SCHEMA is today
```

- `compile` validates against the schema, compiles patterns, resolves references with memoizing
  and cycle detection, and runs each operator's `compile` hook. An `ExpressionError` carries the
  path of the failing node (`of.1.pattern`) and a message.
- `evaluate` is synchronous and pure. The context is any JSON object, with `Date` values allowed.
- `read(context, path)` is exported for consumers that read a field the same way outside an
  expression. The flags engine's split reads its bucketing field through it.

### Text form

The JSON form stays canonical for storage. The text form is for people: admin forms, config
files, logs and error messages.

```typescript
let parsed = flagConditions.parse(
	`plan.tier == "pro" and (country in ["AR", "UY"] or segment("internal"))
	 and semver(appVersion, ">=", "2.0.0")`,
);
// Result<FlagCondition, ExpressionError>, the error pointing at a line and column

flagConditions.stringify(parsed.data); // the canonical text, round-tripping through parse
```

- `and`, `or` and `not` compose, with `not` over `and` over `or` and parentheses for grouping.
- Comparisons are infix: `==`, `!=`, `<`, `<=`, `>`, `>=`, `in` and `not in`.
- Every other operator, extensions included, uses call form `op(field, ...args)`, with the
  arguments mapped to the fields named in `args`. That covers `exists(beta)`,
  `matches(email, "@acme\\.com$")` and a reference like `segment("internal")`.
- `true` is `always`.
- Literals are JSON literals, so a value in text is written exactly as it is stored.

### Flags engine changes

| File                                      | Change                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/conditions.ts`                       | New: defines `flagConditions` with `semver` and `reference: "segment"`                                          |
| `src/definition.ts`                       | `Condition` becomes `typeof flagConditions.Expression`                                                          |
| `src/schema.ts`                           | `CONDITION_SCHEMA` becomes `flagConditions.schema`                                                              |
| `src/parse.ts`                            | `compileCondition` and `resolveSegment` give way to `flagConditions.compile` with the segment map as references |
| `src/snapshot.ts`                         | `CompiledCondition` becomes the language's compiled type                                                        |
| `src/evaluate.ts`                         | Calls `flagConditions.evaluate`                                                                                 |
| `src/lib/condition.ts`, `src/lib/path.ts` | Removed, along with their tests, which move to `@sdxc/expression`                                               |
| `src/lib/split.ts`                        | Reads the bucketing field with `read` from `@sdxc/expression`                                                   |
| `README.md`                               | The targeting section keeps the operator table and adds the text form for previews and admin UIs                |

Rules, variants, splits, hashing, reasons, stores and the provider stay in the flags engine.
A stored set that parses today parses identically afterwards, which the existing parse,
evaluate and conformance tests verify unchanged.

### Logger change

`Sample.Options.keep` accepts an expression in the JSON form as well as a function, so a
sampling exemption can live in configuration:

```typescript
createLogger({
	sample: {
		rate: 0.1,
		keep: {
			op: "any",
			of: [
				{ op: "eq", field: "kind", value: "job" },
				{ op: "gte", field: "status", value: 500 },
			],
		},
	},
});
```

The logger compiles it once at `createLogger`, against its own language with no extensions.

## Usage Examples

### Feature flags: the stored set is unchanged

A flag set in KV keeps the JSON it has today, segments included:

```json
{
	"segments": {
		"internal": { "op": "endsWith", "field": "email", "value": "@sergiodxa.com" }
	},
	"flags": {
		"new-checkout": {
			"variants": { "on": true, "off": false },
			"defaultVariant": "off",
			"targeting": [
				{
					"when": {
						"op": "any",
						"of": [
							{ "op": "segment", "name": "internal" },
							{ "op": "semver", "field": "appVersion", "compare": ">=", "value": "2.0.0" }
						]
					},
					"serve": "on"
				}
			]
		}
	}
}
```

Inside the flags engine, compiling a rule is one call against its dialect:

```typescript
let when = flagConditions.compile(rule.when, { references: segments });
if (isFailure(when)) return failure(when.error);

flagConditions.evaluate(when.data, { email: "ada@sergiodxa.com", appVersion: "1.4.0" }); // true
```

### An admin form that edits rules as text

The form shows each stored rule as text, and turns what the person typed back into the JSON
the store holds. A parse error points at the character that broke it:

```typescript
let text = flagConditions.stringify(rule.when);
// `segment("internal") or semver(appVersion, ">=", "2.0.0")`

let parsed = flagConditions.parse(form.get("when"));
if (isFailure(parsed)) {
	return render({
		error: parsed.error.message,
		line: parsed.error.line,
		column: parsed.error.column,
	});
}

let compiled = flagConditions.compile(parsed.data, { references: segments });
if (isFailure(compiled)) return render({ error: compiled.error.message, at: compiled.error.path });

await store.write(withRule(set, key, { when: parsed.data, serve: "on" }));
```

Compiling before writing catches what the schema cannot: an unknown segment, a segment cycle,
or a pattern that does not compile with the `v` flag.

### Writing a condition in code

The JSON form is a typed union, so a condition built in TypeScript narrows on `op` and an
editor completes the fields each operator needs:

```typescript
type FlagCondition = typeof flagConditions.Expression;

let proInArgentina: FlagCondition = {
	op: "all",
	of: [
		{ op: "eq", field: "plan.tier", value: "pro" },
		{ op: "in", field: "country", values: ["AR"] },
	],
};
```

### Log sampling from configuration

A plain language has the built-in operators and nothing else, which is enough for the
logger's exemptions. The rule can live in an environment variable as text:

```typescript
import { createLanguage } from "@sdxc/expression";

let conditions = createLanguage();

// LOG_KEEP = `kind == "job" or status >= 500 or exists(error)`
let keep = conditions.parse(env.LOG_KEEP);

let logger = createLogger({
	sample: { rate: 0.1, keep: isSuccess(keep) ? keep.data : undefined },
});
```

### A restricted dialect

A consumer that evaluates rules from untrusted users inside a request leaves out the
operators it cannot afford. A dialect for reader filter rules allows composition and
substring tests only, so evaluation stays linear in the size of the post:

```typescript
let ruleConditions = createLanguage({ builtins: ["all", "any", "not", "contains"] });

let rule = ruleConditions.parse(`contains(title, "sponsored") and not contains(author, "staff")`);
// matches(title, "…") fails to parse: "matches" is not an operator of this language

if (isSuccess(rule)) {
	let compiled = ruleConditions.compile(rule.data);
	if (isSuccess(compiled)) {
		ruleConditions.evaluate(compiled.data, {
			title: foldRuleText(post.title),
			author: post.author === null ? null : foldRuleText(post.author),
		});
	}
}
```

### An operator with its own compile step

An operator whose argument is expensive to prepare does it once in `compile`. A CIDR test
parses the range when the rule is compiled, not on every evaluation:

```typescript
let networkConditions = createLanguage({
	operators: [
		defineOperator({
			op: "cidr",
			args: ["field", "range"],
			schema: s.object({ range: s.string() }),
			compile: (node) => parseCidr(node.range), // Result<Cidr, Error>
			test: (value, node, range) => typeof value === "string" && range.contains(value),
		}),
	],
});

let blocked = networkConditions.parse(`cidr(ip, "10.0.0.0/8") or country in ["XX"]`);
```

A missing `ip` never reaches `test`: the language answers `false` for it, as it does for every
field operator.

### Errors

Both failure kinds are values, and each names where the problem is:

```typescript
flagConditions.compile({ op: "matches", field: "email", pattern: "(" }, { references: segments });
// failure: ExpressionError { path: "pattern", message: 'Pattern "(" does not compile' }

flagConditions.compile(
	{ op: "segment", name: "staff" },
	{ references: { staff: { op: "segment", name: "staff" } } },
);
// failure: ExpressionError { path: "", message: 'Segment "staff" takes part in a reference cycle' }

flagConditions.parse(`plan.tier == "pro" and`);
// failure: ExpressionError { line: 1, column: 23, message: "Expected a condition after 'and'" }
```

## Consequences

### Positive

- **One condition language:** a rule is validated, compiled and evaluated the same way wherever
  it is stored, and the missing-field and no-coercion rules are tested in one place.
- **A text form:** admin UIs, config files and error messages show `plan.tier == "pro"`
  instead of nested JSON, with a parse error pointing at a column.
- **Extensible without forking:** a consumer adds an operator through `defineOperator`, and
  the language enforces the field rules around it.
- **A smaller flags engine:** it keeps only what is about flags.
- **Unchanged stored data:** existing flag sets in KV keep parsing with no migration.

### Negative

- **A second package to version:** `@sdxc/flags-engine` is public, so `@sdxc/expression` must
  be public before the flags engine can publish with it.
- **Type complexity:** typing a language from its operator list makes `createLanguage`'s
  generics the hardest part of the package to get right.
- **Two forms to keep aligned:** every operator needs a JSON shape and a text shape, and a
  round-trip test per operator to keep them in sync.

### Neutral

- **`semver` moves into the flags engine's dialect,** so `@sdxc/expression` does not depend on
  `@sdxc/semver`. A future consumer wanting it declares the same operator.

## Implementation Plan

### Phase 1: The package, JSON form

**Priority:** High
**Estimated Effort:** 4 hours

1. Create `packages/expression`, public, with `createLanguage`, `defineOperator`, `read`,
   `ExpressionError` and the built-in operators.
2. Move the condition, path and compile tests from `@sdxc/flags-engine`, and add tests for
   extension operators, `builtins` restriction and references under a custom spelling.
3. Add `expectTypeOf` tests for the expression type a language derives.
4. Write the README.

### Phase 2: Flags engine

**Priority:** High
**Estimated Effort:** 2 hours

1. Define `flagConditions`, switch the definition, schema, parse, snapshot and evaluate modules
   to it, and delete `lib/condition.ts` and `lib/path.ts`.
2. Run the existing parse, evaluate, engine and conformance suites unchanged.

### Phase 3: Text form

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Add `parse` and `stringify` to every language, with line and column in errors.
2. Add round-trip tests for every built-in operator and for an extension operator.
3. Add the text form to the flags engine README's preview pattern.

### Phase 4: Logger

**Priority:** Low
**Estimated Effort:** 1 hour

1. Accept an expression for `keep`, compiled at `createLogger`.

## Alternatives Considered

### 1. Keep the language inside the flags engine

Other consumers would import `CONDITION_SCHEMA` and `matchesCondition` from
`@sdxc/flags-engine`.

**Rejected because**: a log sampler or a reader rule would depend on flag stores, OpenFeature
types and a KV binding to evaluate `kind == "job"`.

### 2. An existing expression language (CEL, JSONLogic, Filtrex)

**Rejected because**: none of them keeps the flags engine's stored JSON contract, so adopting
one migrates every stored flag set. JSONLogic also coerces across types, which contradicts the
semantics the flags engine documents, and CEL brings a type system and a runtime far larger
than the conditions any consumer here writes.

### 3. The text form only

Store conditions as text and parse them at compile time.

**Rejected because**: the typed JSON union is what lets an editor complete an operator and a
definition narrow on `op`, and it is the format already in every flag store.

## References

- [ADR-104: Random Package](./ADR-104-random-package.md)
- [`@sdxc/flags-engine` README](../../packages/flags-engine/README.md)
- [RFC 7644 §3.4.2.2: SCIM filtering](https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.2)

## Current Progress

- [x] Phase 1: The package, JSON form
- [x] Phase 2: Flags engine
- [x] Phase 3: Text form
- [x] Phase 4: Logger

## Notes

- A language also exposes `typeof language.Compiled`, the compiled form, which the flags
  engine's `CompiledCondition` is.
- References memoize per `references` object: compiling many expressions against the same
  object shares each resolved tree, which is how every flag in a set shares its segments.
- A `keep` condition that does not compile keeps every log, so a broken exemption costs
  volume and never the logs it was written to keep. The logger evaluates it against its
  fields with their dotted keys nested again, so `tenant.id` reads as a path.

- Each phase is its own commit, in its own workspace: `feat(expression): …`,
  `refactor(flags-engine): …`, `feat(logger): …`.
- Field-type checking at compile time (refusing `eq` with a string against a field declared
  numeric) needs a declared context shape, which the flags engine does not have. It is a
  candidate once a consumer with a fixed context exists.
