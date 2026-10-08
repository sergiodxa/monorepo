# ADR-118: Expression Context Paths

## Status

**Accepted** - 2026-10-07

## Background

`@sdxc/expression` ([ADR-105](./ADR-105-expression-package.md)) compares one context field
against a literal written in the expression: `plan.tier == "pro"`. That covers feature-flag
targeting and log sampling, where the right-hand side is always a constant an author typed.

An authorization rule compares things the caller provides: "the article's author is the actor" is
`article.authorId == actor.id`, and neither side is known when the rule is written. The
authorization package proposed in [ADR-119](./ADR-119-authz-package.md) depends on that, on list
membership tests over supplied facts, on a strict answer for a context that lacks or mistypes a
field a rule reads, and on knowing which paths a compiled expression reads.

## Context

### What the language does today

| Behavior                         | Where                                      | Effect                                                                         |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| A comparison's right-hand side   | `src/builtins.ts`                          | A JSON literal (`value`) or a literal array (`values`)                         |
| Built-in and extension operators | `src/builtins.ts`, `src/grammar.ts:54`     | Both are `Operator`s in one `fields` map; an extension can replace a built-in  |
| An operator's input              | `src/operator.ts:53`, `src/evaluate.ts:42` | `test(value, node)`: the value at its own `field`, never the context           |
| A path that resolves to nothing  | `src/evaluate.ts`                          | Every operator except `exists` answers `false`                                 |
| A type mismatch                  | `src/builtins.ts:164-202`                  | `false`; so `ne` and `notIn` answer `true` against a mistyped field            |
| `all`, `any`                     | `src/evaluate.ts:28-30`                    | Short-circuit on the first deciding member                                     |
| A path in the text form          | `src/tokenize.ts`, `src/parse.ts`          | A bare dotted word, or a whole path quoted in backticks                        |
| The evaluated context            | `src/read.ts:16-21`                        | `Date \| JSONValue` values, so an `interface`-typed record does not type-check |

### Why "missing is false" is wrong for authorization

The rule is right for flags: a targeting rule about a field the caller did not send must not
match everyone, so it answers `false` and the flag falls through to its default. In an
authorization rule the same answer opens holes:

- `not (article.authorId == actor.id)` holds when `actor` is missing, because the inner
  comparison is `false` and `not` flips it.
- A deny `article.published == true` does not apply when `article` lacks `published`, or when D1
  returns `published` as `1`, so incomplete or mistyped data turns a refusal into a permission.
- `article.authorId == actor.id` holds when both are `null`, so an orphaned record belongs to
  every actor without an id.

Other systems disagree on this. In Rego an expression over an undefined value is undefined and
`not` over it holds; Cedar skips a policy whose evaluation errors. For authorization this ADR
takes the fail-closed side: a context that lacks or mistypes what a rule reads is a bug in the
caller, reported as a failure the check refuses on.

## Decision

Six changes to `@sdxc/expression`:

1. Built-in comparisons accept a context path on the right-hand side.
2. Three array operators: `includes`, `intersects` and `subsetOf`.
3. The text form writes every path under a `ctx.` root.
4. A language may be strict: a missing, `null` or mistyped operand fails the expression, and
   `all`, `any` and `not` combine failures in three-valued logic.
5. `language.paths(compiled)` reports every context path an expression reads.
6. `evaluate` accepts any object as its context, interfaces and nested `Date`s included.

### Comparing two paths

The comparison built-ins take `path` in place of `value` (or `values`):

```typescript
{ op: "eq", field: "article.authorId", path: "actor.id" }
{ op: "in", field: "article.teamId", path: "actor.teamIds" }
{ op: "gte", field: "actor.level", path: "article.requiredLevel" }
```

| Operators                | Right-hand path must resolve to        | Otherwise         |
| ------------------------ | -------------------------------------- | ----------------- |
| `eq`, `ne`               | a JSON primitive or a `Date`           | `false`           |
| `lt`, `lte`, `gt`, `gte` | a number, or a `Date` against a `Date` | `false`           |
| `in`, `notIn`            | an array; members compared with `eq`   | `false`, for both |

- **Evaluation resolves the path, not the operator.** `evaluate.ts` reads `node.path` for a
  built-in comparison (recognized as `operator === FIELD_BUILTINS.get(node.op)`, as `exists` is
  today), applies the missing-path rule to both sides, then calls the built-in's two-value
  comparison. Extension operators keep `test(value, node)` with one input, and an extension node
  with its own field called `path` keeps it.
- **`null` never matches across two paths.** A path comparison with `null` on either side is
  `false` (a failure in a strict language). A literal `null` still compares as written:
  `eq(field, null)` holds for a field holding `null`.
- **Dates compare by time value.** Two `Date`s are `eq` when `getTime()` agrees, and the
  orderings compare them the same way. A `Date` against a number is a type mismatch. Time facts a
  rule compares against a literal are supplied as epoch milliseconds.
- **`notIn` against a non-array is `false`**, so `notIn` is not `not in` for a mistyped list. An
  "allow unless blocked" rule cannot open because a blocklist fact has the wrong type.
- **The JSON form carries one or the other.** Each comparison leaf is
  `{ value: X; path?: never } | { path: string; value?: never }`, which keeps narrowing on `op`
  and refuses both at the type level. The schema enforces the same at runtime with an explicit
  exclusivity check (the object schema strips unknown keys, so this is not free), and `path`
  uses the non-empty schema `field` uses. Tests cover both present and neither present.

### Array operators

`in` asks whether a scalar is one of a list. Facts usually arrive the other way round: a list
(`billing.features`, `actor.teamIds`, `folder.ancestorIds`) that must contain a value, share one
with another list, or fit inside it.

```typescript
{ op: "includes", field: "billing.features", value: "reports" }
{ op: "includes", field: "folder.ancestorIds", path: "actor.rootFolderId" }
{ op: "intersects", field: "article.teamIds", path: "actor.teamIds" }
{ op: "subsetOf", field: "requested.scopes", path: "actor.scopes" }
```

| Operator     | Right-hand side    | Holds when the field is an array                         |
| ------------ | ------------------ | -------------------------------------------------------- |
| `includes`   | `value` or `path`  | with a member `eq` to the value                          |
| `intersects` | `values` or `path` | sharing a member, by `eq`, with the other list           |
| `subsetOf`   | `values` or `path` | whose every member is `eq` to a member of the other list |

- A field or right-hand side that is not an array makes all three `false`. An empty field is a
  subset of anything and intersects nothing.
- `contains` stays a substring test; `includes` is list membership. `ctx.x in ctx.list` and
  `includes(ctx.list, ctx.x)` ask the same question from opposite sides.
- Hierarchies reduce to these: an app keeping a closure table supplies `ancestorIds`, and "inside
  this folder or any folder under it" is one `includes`. `subsetOf` is how a rule keeps a minted
  credential within the scopes of the one minting it.
- `@sdxc/flags-engine` pins its `builtins` to the operators it has today, so its published
  `CONDITION_SCHEMA` does not widen mid-rollout; it opts into the new operators with its own
  change.

### The `ctx.` root in the text form

Every path in the text form starts with `ctx.`, and everything else is a JSON literal, so the two
sides of a comparison read the same way:

```text
ctx.article.authorId == ctx.actor.id
ctx.article.teamId in ctx.actor.teamIds and not ctx.article.locked == true
includes(ctx.billing.features, "reports")
ctx.plan.tier == "pro" and semver(ctx.appVersion, ">=", "2.0.0")
exists(ctx.headers.`user-agent`)
```

- **Grammar.** `ctx` is a keyword. A path is `ctx` followed by one or more `.segment`s, where a
  segment is a bare word or a backtick-quoted string. A quoted segment cannot contain `.`,
  because `read` splits on every dot. Bare `ctx` is an error.
- **Sides.** The left of an infix comparison must be a path (`1 < ctx.x` is refused). The right
  is a literal or a path; a path fills `path`.
- **Calls.** In call syntax a `ctx.` argument in the right-hand position of a built-in that takes
  a path fills `path`, as in `includes(ctx.list, ctx.x)`. A `ctx.` argument anywhere else fails
  with a message naming the operator, as in `semver(ctx.v, ">=", ctx.min)`.
- **Names.** `createLanguage` refuses an operator or reference named `ctx` or any other keyword.
- **Old text.** A bare path such as `plan.tier == "pro"` fails with "paths start with `ctx.`",
  and `ctx.a` can no longer mean a field named `ctx`. Only tests and documentation hold text
  today; no stored data, configuration or environment variable does.
- **Printing.** `stringify` prints `ctx.` before every path, in both the infix and the call
  printer, including a `path` in the right-hand position, so `parse` reads it back to the same
  JSON. Today the printers would emit `a == null` for a path node; every operator gains a
  round-trip test with a path.
- The JSON form keeps `field: "plan.tier"`; the root exists in the text form only, so every stored
  flag set and logger configuration parses unchanged.

### Strict languages

`createLanguage` takes `strict`:

```typescript
let rules = createLanguage({ strict: true, reference: "condition" });

let parsed = rules.parse(`ctx.article.authorId == ctx.actor.id`);
// …compile as before

rules.evaluate(compiled, { article: { authorId: "u_1" } });
// Failure: ExpressionError { path: "path", missing: "actor.id", message: 'Context has no "actor.id"' }

rules.evaluate(compiled, { article: { authorId: "u_1" }, actor: { id: "u_1" } });
// Success: true
```

A strict language fails a leaf, instead of answering `false`, when:

- a path it reads resolves to nothing (`exists` excepted);
- a path comparison has `null` on either side;
- an operand has the wrong type for the operator: `eq` between `1` and `true`, `lt` on a string,
  `includes` on a non-array.

Failures combine in three-valued (Kleene) logic, which keeps the answer independent of operand
order:

| Node  | Answers                                                                            |
| ----- | ---------------------------------------------------------------------------------- |
| `any` | `true` if any member is `true`; else a failure if any member failed; else `false`  |
| `all` | `false` if any member is `false`; else a failure if any member failed; else `true` |
| `not` | the negation of a boolean; a failure stays a failure                               |

- Evaluation still stops at a deciding member, so the cost is the same as today.
  `exists(ctx.a) and ctx.a == 1` guards the comparison: `exists` answers `false` for a missing
  `a`, and `false` decides the `all`.
- A boolean answer holds for every context that agrees on the paths that were present. `exists`
  is the one operator that reads absence itself.
- `evaluate` returns `Result<boolean, ExpressionError>` in a strict language and `boolean` in a
  lenient one. The error names the failing node's path in the JSON form, carries the context
  path in `missing` or the operands' types in `mismatch`, and reports a failure inside a
  reference at the reference node with the inner failure as its cause, as `compile` does.
- A lenient language (the default, used by flags and the logger) behaves exactly as today.

### Reading what an expression reads

```typescript
rules.paths(compiled); // ReadonlySet<string>: "article.authorId", "actor.id"
```

`paths` walks a compiled expression, references included, and returns every `field` and `path`
it reads, extension operators' `field` included. A consumer uses it to load only the facts a
policy reads and to reject a rule reading a root its caller never supplies.

### Context and language types

```typescript
interface Language<E, C, Outcome = boolean> {
	evaluate(compiled: C, context: object): Outcome;
	paths(compiled: C): ReadonlySet<string>;
	// schema, compile, parse and stringify unchanged
}

function createLanguage<
	const B extends BuiltinName = BuiltinName,
	const R extends string = never,
	const O extends readonly AnyOperator[] = [],
	const S extends boolean = false,
>(options?: LanguageOptions<B, R, O, S>): Language<…, S extends true ? Result<boolean, ExpressionError> : boolean>;
```

- `Outcome` defaults to `boolean`, so `Language<E, C>` keeps compiling; flags-engine and the
  logger compile unchanged.
- `evaluate` takes any `object`, so a context of `interface`-typed records with nested `Date`s
  and optional fields type-checks; `read` already walks plain objects and keeps a `Date` whole.

## Consequences

### Positive

- **Rules that compare caller data**: a rule set can be one document for every actor.
- **Fail-closed and order-independent strict evaluation**: a context that lacks or mistypes a
  field refuses instead of answering a boolean nobody intended, and swapping operands never
  changes the answer.
- **Introspection**: a consumer knows which facts a rule reads without walking the tree itself.
- **One path syntax**: `ctx.` marks every path, so a reader never works out whether a word is a
  field.

### Negative

- **Text form breaks**: every text-form expression gains `ctx.`. That reaches this package's
  README and tests, the flags-engine README, and the conditions and feature-flags guides in
  `apps/sdxc`, each its own commit, and the docs site needs a deploy.
- **Two evaluation outcomes**: code generic over any language handles a boolean and a `Result`.
- **Strict mode demands typed data**: a D1 row whose booleans arrive as `0` and `1` fails a strict
  comparison against `true` until the caller maps it.

### Neutral

- **Extension operators keep one input**: a path argument for `defineOperator` can follow when a
  consumer needs one.
- **SQL translation is later work**: a future partial evaluator into SQL maps "missing" and
  `NULL` explicitly, and the array operators have no portable SQL (SQLite needs `json_each`).

## Implementation Plan

### Phase 1: Path comparisons

**Priority:** High
**Estimated Effort:** 3 hours

1. Leaf types with the `value`/`path` exclusivity, schemas with the runtime check, compiled
   forms.
2. Path resolution in `evaluate.ts` for built-ins, `null` and `Date` rules, `notIn` on a
   non-array.
3. Tests per operator: both sides missing, `null`, mistyped, `Date`s, both keys, neither key.

### Phase 2: Array operators

**Priority:** High
**Estimated Effort:** 1 hour

`includes` (`value` or `path`), `intersects` and `subsetOf` (`values` or `path`), with tests for
non-arrays, empty arrays and member typing. Pin flags-engine's `builtins` in the same phase, as
its own commit.

### Phase 3: The `ctx.` root

**Priority:** High
**Estimated Effort:** 3 hours

1. Tokenizer and parser: `ctx` keyword, segment quoting, path arguments in calls, the old-text
   message, reserved names in `createLanguage`.
2. Both printers in `stringify`; a round-trip test for every operator with and without a path.
3. Update the text form in this package's README, the flags-engine README, and the `apps/sdxc`
   guides (one commit per workspace, then deploy sdxc), and add a note to ADR-105's text-form
   section pointing here.

### Phase 4: Strict languages and introspection

**Priority:** High
**Estimated Effort:** 3 hours

1. `strict` in `LanguageOptions`, the outcome type parameter, Kleene `all`/`any`/`not`, failures
   for missing, `null` and mistyped operands, error paths through references.
2. `paths(compiled)`, and `evaluate` over any `object`.
3. Tests: `not` over a missing path, guards with `exists`, swapped operands answering alike,
   failures inside references, interface-typed contexts, and `expectTypeOf` for both outcomes.

## Alternatives Considered

### 1. Write the caller's values into each rule

Build rules per actor, with `value: actor.id` filled in at request time.

**Rejected because**: rules stop being shareable data. A role's rules differ for every actor and
rules stored in a database need placeholder templates substituted before compiling.

### 2. Make every language strict

**Rejected because**: feature-flag targeting relies on "missing is false" to fall through to a
default; reporting a partial context as an error would mark every such flag evaluation.

### 3. Short-circuit strictly, failing on the first missing path reached

**Rejected because**: the answer would depend on operand order: `isAdmin == true or authorId ==
actor.id` would fail with `isAdmin` absent while its mirror answered `true`.

### 4. Separate operators for path comparisons

Add `eqPath`, `inPath` and so on.

**Rejected because**: it doubles the operator table for one difference in where the right-hand
value comes from, and the text form already tells the two apart by the `ctx.` root.

## References

- [ADR-105: Expression Package](./ADR-105-expression-package.md)
- [ADR-119: Authorization Package](./ADR-119-authz-package.md)
- [OPA: `not` over undefined](https://www.openpolicyagent.org/docs/policy-reference/keywords/not)
- [Cedar: authorization semantics](https://docs.cedarpolicy.com/auth/authorization.html)

## Current Progress

- [x] Phase 1: Path comparisons
- [x] Phase 2: Array operators
- [x] Phase 3: The `ctx.` root
- [x] Phase 4: Strict languages and introspection
