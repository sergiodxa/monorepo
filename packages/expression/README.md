# @sdxc/expression

Boolean conditions over a context, stored as typed JSON or written as text, with operators you add.

A language compiles a condition once and evaluates it synchronously against any object. The JSON
form is what you store; the text form, like `ctx.plan.tier == "pro" and ctx.country in ["AR"]`,
is what a person types into a form, a config file or an environment variable.

## Installation

```sh
npm add @sdxc/expression
```

Every step answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
and a custom operator's schema is built with `remix/data-schema` from
[`remix`](https://www.npmjs.com/package/remix).

## Usage

### Compile and evaluate a condition

```typescript
import { createLanguage } from "@sdxc/expression";
import { isSuccess } from "@sdxc/result";

let conditions = createLanguage();

let compiled = conditions.compile({
	op: "all",
	of: [
		{ op: "eq", field: "plan.tier", value: "pro" },
		{ op: "in", field: "country", values: ["AR", "UY"] },
	],
});

if (isSuccess(compiled)) {
	conditions.evaluate(compiled.data, { plan: { tier: "pro" }, country: "AR" }); // true
	conditions.evaluate(compiled.data, { plan: { tier: "pro" } }); // false, no country
}
```

Compile once, when the condition is loaded, and evaluate as often as you like: evaluation is
synchronous and pure. A leaf whose field is missing answers `false`.

### Write it as text

```typescript
let conditions = createLanguage();

conditions.parse(`ctx.plan.tier == "pro" and ctx.country in ["AR", "UY"]`);
// Success: the same JSON form compile() takes

conditions.parse(`ctx.plan.tier == "pro" and`);
// Failure: ExpressionError { line: 1, column: 27, message: "Expected a condition after 'and'" }

conditions.stringify({ op: "not", of: { op: "exists", field: "beta" } }); // "not exists(ctx.beta)"
```

Every path in the text form starts with `ctx.`, and every value is a JSON literal. The JSON form
writes the same path without the root, as `field: "plan.tier"`.

### Compare two values from the context

```typescript
let rules = createLanguage();

rules.parse(`ctx.article.authorId == ctx.actor.id`);
// Success: { op: "eq", field: "article.authorId", path: "actor.id" }
```

Write `path` in place of `value` or `values` and the right-hand side comes from the context too,
so one stored rule serves every caller.

### Share conditions by name

```typescript
let conditions = createLanguage({ reference: "segment" });

let segments = {
	internal: { op: "endsWith", field: "email", value: "@example.com" },
	beta: {
		op: "any",
		of: [
			{ op: "segment", name: "internal" },
			{ op: "eq", field: "beta", value: true },
		],
	},
};

conditions.compile({ op: "segment", name: "beta" }, { references: segments });
conditions.parse(`segment("beta") and ctx.country == "AR"`);
```

Each name compiles once per `references` object, so conditions compiled against the same object
share one tree. An unknown name or a cycle fails the compile.

## API

### `createLanguage(options?: LanguageOptions): Language`

Defines a dialect. Every option is optional:

- `builtins`: the built-in operators kept, all of them by default.
- `reference`: the operator name a reference is written under, as in
  `{ op: "segment", name: "internal" }`. Without it the dialect has no references.
- `operators`: operators made with `defineOperator`. One named like a built-in replaces it.
- `strict`: fails an evaluation on a missing path, a `null` across two paths, or operands of the
  wrong type, instead of answering `false`; `evaluate` then returns `Result<boolean, ExpressionError>`.

It throws a `TypeError` when an operator or the reference is named after a keyword of the text
form: `ctx`, `and`, `or`, `not`, `in`, `true`, `false`, `null`.

### `Language`

- `compile(expression: unknown, { references }?)`: validates the expression, runs every
  operator's compile step and resolves references. Returns `Result<Compiled, ExpressionError>`.
- `evaluate(compiled, context: object)`: whether the expression holds. Nested records, arrays and
  `Date` values are read by path. Returns a `boolean`, or a `Result` in a strict language.
- `paths(compiled): ReadonlySet<string>`: every context path the expression reads, references
  included.
- `parse(text: string)`: the text form read into the JSON form and validated, as
  `Result<Expression, ExpressionError>`.
- `stringify(expression): string`: the canonical text, which `parse` reads back to the same JSON.
- `schema`: a Standard Schema for the dialect's JSON form.
- `Expression`, `Compiled`: type-only members, read as `typeof language.Expression`.

### Built-in operators

| Operator                             | JSON form                       | Holds when the field…                           |
| ------------------------------------ | ------------------------------- | ----------------------------------------------- |
| `eq`, `ne`                           | `{ op, field, value }`          | is, or is not, exactly `value`                  |
| `in`, `notIn`                        | `{ op, field, values }`         | is, or is not, one of `values`                  |
| `lt`, `lte`, `gt`, `gte`             | `{ op, field, value }` (number) | is a number ordered against `value`             |
| `includes`                           | `{ op, field, value }`          | is a list with a member equal to `value`        |
| `intersects`                         | `{ op, field, values }`         | is a list sharing a member with `values`        |
| `subsetOf`                           | `{ op, field, values }`         | is a list whose every member is one of `values` |
| `startsWith`, `endsWith`, `contains` | `{ op, field, value }` (string) | is a string with `value` in place               |
| `matches`                            | `{ op, field, pattern }`        | is a string the pattern matches                 |
| `exists`                             | `{ op, field }`                 | resolves to anything, `null` too                |
| `all`, `any`                         | `{ op, of: [...] }`             | every member, or some member, holds             |
| `not`                                | `{ op, of }`                    | its operand does not hold                       |
| `always`                             | `{ op }`                        | always                                          |

`value` and `values` hold JSON primitives. Operators from `eq` to `subsetOf` take `path` in place
of the literal, and two `Date`s from the context compare by time. `field` is a dotted path:
`roles.0` reads an array element. Comparisons stay within one type, so `eq` between `"5"` and `5`
is false and `ne` is true. `matches` compiles its pattern with the
[`v` flag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/unicodeSets)
at compile time.

### Text form

| Text                                         | JSON form                                                |
| -------------------------------------------- | -------------------------------------------------------- |
| `a and b`, `a or b`, `not a`                 | `all`, `any`, `not`; `not` binds over `and` over `or`    |
| `(a or b)`                                   | grouping, kept as its own node                           |
| `true`                                       | `always`                                                 |
| `ctx.field == v`, `!=`, `<`, `<=`, `>`, `>=` | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`                     |
| `ctx.field in [...]`, `not in [...]`         | `in`, `notIn`                                            |
| `ctx.field == ctx.other`, `in ctx.list`      | the same operators, with `path` in place of the literal  |
| `op(ctx.field, ...args)`                     | any other operator, arguments in the order of its `args` |
| `segment("internal")`                        | a reference, under the dialect's spelling                |
| `all(...)`, `any(...)`                       | a chain of fewer than two members                        |

A path segment a bare word cannot spell is quoted in backticks: `` ctx.headers.`user-agent` ``.

### `defineOperator(definition: OperatorDefinition): Operator`

Declares an operator over one field. `op` names it, `args` lists its fields in call order starting
with `field`, `schema` validates the fields beyond `op` and `field`, and
`test(value, node, prepared)` answers for a value that is present. The optional `compile(node)`
returns a `Result` whose data reaches `test` as `prepared`; a failure fails the compile.

### `ExpressionError`

The failure every step reports. `path` names the failing node in the JSON form, like
`of.1.pattern`. A parse failure adds 1-based `line` and `column`; a strict evaluation failure adds
`missing`, the context path that resolved to nothing, or `mismatch`, the two operand types refused.

### `read(context: object, path: string): ContextValue`

Reads a dotted path exactly as an expression does: `undefined` for a miss, a `Date` kept whole.

### Types

- `Language<E, C, Outcome>`, `LanguageOptions`, `CompileOptions`: a dialect, its options, and the
  options `compile` takes.
- `ExpressionOf<B, R, X>`, `CompiledOf<B, R, X>`: the JSON and compiled forms a dialect derives.
- `AllNode`, `AnyNode`, `NotNode`, `ReferenceNode`, `CompiledReferenceNode`, `BuiltinLeaf`,
  `CompiledBuiltinLeaf`, `BuiltinName`: the node shapes and built-in names.
- `Operator`, `OperatorDefinition`, `AnyOperator`, `FieldNode`, `AnyFieldNode`, `FieldValue`: an
  operator, its definition, and the node and value it reads.
- `Context`, `ContextValue`: a JSON context with `Date` values, and what `read` returns.
- `ExpressionErrorOptions`: the fields `new ExpressionError(message, options)` accepts.

## Pattern: Authorization Rules That Fail Closed

A strict language refuses when the context lacks what a rule reads, so a missing `actor` can never
turn `not` into a grant.

```typescript
import { createLanguage } from "@sdxc/expression";
import { isSuccess, unwrap } from "@sdxc/result";

let rules = createLanguage({ strict: true });

let canEdit = unwrap(rules.compile(unwrap(rules.parse(`ctx.article.authorId == ctx.actor.id`))));

rules.evaluate(canEdit, { article: { authorId: "u_1" } });
// Failure: ExpressionError { path: "path", missing: "actor.id" }

rules.evaluate(canEdit, { article: { authorId: "u_1" }, actor: { id: "u_1" } });
// Success: true

function allowed(context: object) {
	let answer = rules.evaluate(canEdit, context);
	return isSuccess(answer) && answer.data;
}
```

`all`, `any` and `not` combine failures in three-valued logic: `any` is `true` when a member is
`true`, else a failure when a member failed; `all` mirrors it around `false`. Guard an optional
path with `exists(ctx.a) and ctx.a == 1`, since `exists` answers `false` instead of failing.

## Pattern: Loading Only The Facts A Rule Reads

`paths` lists what a compiled rule reads, so you fetch only those values and `read` checks the
same paths the rule will.

```typescript
import { createLanguage, read } from "@sdxc/expression";
import { unwrap } from "@sdxc/result";

declare function loadOrg(): Promise<{ plan: string }>;
declare function loadUser(): Promise<{ verified: boolean }>;

let rules = createLanguage();

let rule = unwrap(
	rules.compile(unwrap(rules.parse(`ctx.org.plan == "pro" and ctx.user.verified == true`))),
);

let roots = new Set([...rules.paths(rule)].map((path) => path.split(".")[0]));
// Set { "org", "user" }

let context: Record<string, unknown> = {};
if (roots.has("org")) context.org = await loadOrg();
if (roots.has("user")) context.user = await loadUser();

read(context, "org.plan"); // the value the rule compares
rules.evaluate(rule, context);
```

## Pattern: A Custom Operator With A Compile Step

The compile step runs once per node, so a failure surfaces when the rule is saved and `test`
receives the prepared value on every evaluation.

```typescript
import { createLanguage, defineOperator } from "@sdxc/expression";
import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

let olderThan = defineOperator({
	op: "olderThan",
	args: ["field", "days"],
	schema: s.object({ days: s.number() }),
	compile: (node) =>
		node.days >= 0 ? success(node.days * 86_400_000) : failure(new Error("Expected days ≥ 0")),
	test: (value, _node, ms) => value instanceof Date && Date.now() - value.getTime() > ms,
});

let accounts = createLanguage({ operators: [olderThan] });

accounts.parse(`olderThan(ctx.createdAt, 30)`);
// Success: { op: "olderThan", field: "createdAt", days: 30 }

accounts.compile({ op: "olderThan", field: "createdAt", days: -1 });
// Failure: ExpressionError { path: "", message: "Expected days ≥ 0" }
```

The language reads the field first and answers `false` when it is missing, so `test` only sees a
value that is there.

## Pattern: A Restricted Dialect For User-Written Rules

Keep only the operators users need and leave out `matches`, so evaluation stays linear in the size
of the context.

```typescript
import { createLanguage } from "@sdxc/expression";

let filters = createLanguage({
	builtins: ["all", "any", "not", "eq", "in", "contains", "exists"],
});

filters.compile({ op: "matches", field: "title", pattern: "(a+)+$" });
// Failure: ExpressionError { path: "op", message: '"matches" is not an operator of this language' }

type Filter = typeof filters.Expression;

let byTitle: Filter = { op: "contains", field: "title", value: "release" };
```

## Pattern: Validating A Rule Before Storing It

Compiling against the shared references catches what a schema alone cannot: an unknown reference,
a cycle, or a pattern that does not compile.

```typescript
import { createLanguage } from "@sdxc/expression";
import { isFailure } from "@sdxc/result";

let conditions = createLanguage({ reference: "segment" });

function saveRule(
	store: Map<string, unknown>,
	segments: Record<string, unknown>,
	name: string,
	text: string,
) {
	let parsed = conditions.parse(text);
	if (isFailure(parsed)) {
		return { error: parsed.error.message, line: parsed.error.line, column: parsed.error.column };
	}

	let compiled = conditions.compile(parsed.data, { references: segments });
	if (isFailure(compiled)) return { error: compiled.error.message, at: compiled.error.path };

	store.set(name, parsed.data);
	return { ok: true };
}
```

## Pattern: A Rule From Configuration

A text rule in an environment variable decides which events to keep, defaulting to every event.

```typescript
import { createLanguage } from "@sdxc/expression";
import { isSuccess } from "@sdxc/result";

let conditions = createLanguage();

function sampler(text = "true") {
	let parsed = conditions.parse(text);
	let compiled = isSuccess(parsed) ? conditions.compile(parsed.data) : parsed;

	return (event: Record<string, string | number | boolean | null>) =>
		isSuccess(compiled) && conditions.evaluate(compiled.data, event);
}

let keep = sampler(`ctx.kind == "job" or ctx.status >= 500 or exists(ctx.error)`);

keep({ kind: "request", status: 503 }); // true
keep({ kind: "request", status: 200 }); // false
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/expression": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
