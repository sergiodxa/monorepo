# @sdxc/expression

Boolean conditions over a context, stored as typed JSON or written as text, with operators you add.

## Installation

```bash
npm add @sdxc/expression
```

`compile()` reports failures as a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and a dialect's schema is built with [`remix/data-schema`](https://www.npmjs.com/package/remix); both install alongside this package.

## Usage

### Evaluating a stored condition

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
	conditions.evaluate(compiled.data, { plan: { tier: "pro" } }); // false — no country
}
```

Compile once, when the condition is loaded, and evaluate as often as you like: evaluation is synchronous and pure.

### Writing a condition as text

```typescript
let conditions = createLanguage({ reference: "segment" });

let parsed = conditions.parse(
	`ctx.plan.tier == "pro" and (ctx.country in ["AR", "UY"] or segment("internal"))`,
);
// Success: the same JSON form compile() takes

conditions.parse(`ctx.plan.tier == "pro" and`);
// Failure: ExpressionError { line: 1, column: 27, message: "Expected a condition after 'and'" }

conditions.stringify({ op: "not", of: { op: "exists", field: "beta" } }); // "not exists(ctx.beta)"
```

Every path in the text form starts with `ctx.`, and everything else is a JSON literal. The JSON form stays the one to store, with `field: "plan.tier"` and no root; the text form is for people typing a rule into a form, a config file or an environment variable.

### Comparing two facts

```typescript
let rules = createLanguage();

let parsed = rules.parse(`ctx.article.authorId == ctx.actor.id`);
// Success: { op: "eq", field: "article.authorId", path: "actor.id" }

rules.parse(`intersects(ctx.article.teamIds, ctx.actor.teamIds)`);
// Success: { op: "intersects", field: "article.teamIds", path: "actor.teamIds" }
```

A rule that compares two values the caller supplies stays one document for every caller, instead of a copy per caller with its values written in.

### Failing closed with a strict language

```typescript
import { unwrap } from "@sdxc/result";

let rules = createLanguage({ strict: true, reference: "condition" });

let compiled = unwrap(rules.compile(unwrap(rules.parse(`ctx.article.authorId == ctx.actor.id`))));

rules.evaluate(compiled, { article: { authorId: "u_1" } });
// Failure: ExpressionError { path: "path", missing: "actor.id", message: 'Context has no "actor.id"' }

rules.evaluate(compiled, { article: { authorId: "u_1" }, actor: { id: "u_1" } });
// Success: true

rules.paths(compiled); // Set { "article.authorId", "actor.id" }
```

A lenient language, the default, answers `false` for a leaf whose path is missing, so a targeting rule about a field the caller left out falls through to its default. A strict one fails the leaf instead, and also fails a comparison holding `null` across two paths or operands of the wrong type, such as `1 == true` or `lt` on a string. That is the answer an authorization rule needs: `not ctx.article.authorId == ctx.actor.id` refuses when `actor` is missing, where a lenient language would answer `true`.

`all`, `any` and `not` combine failures in three-valued logic, so swapping operands never changes the answer: `any` is `true` when a member is `true`, a failure when a member failed, `false` otherwise; `all` mirrors it around `false`; `not` keeps a failure a failure. Evaluation still stops at the first deciding member, and `exists(ctx.a) and ctx.a == 1` guards the comparison, since `exists` answers `false` for a missing path.

### Sharing conditions by name

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

let compiled = conditions.compile({ op: "segment", name: "beta" }, { references: segments });
```

A reference resolves once per `references` object, so many conditions compiled against the same object share one compiled tree. A name nobody declared, or a cycle, fails the compile.

### Adding an operator

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

accounts.compile({ op: "olderThan", field: "createdAt", days: 30 });
```

The language reads the field before `test` runs and answers `false` when it is missing, so an operator only ever sees a value that is there.

### Leaving operators out

```typescript
let rules = createLanguage({ builtins: ["all", "any", "not", "contains"] });

rules.compile({ op: "matches", field: "title", pattern: "(a+)+$" });
// failure: ExpressionError { path: "op", message: '"matches" is not an operator of this language' }
```

A dialect evaluating conditions written by untrusted users can leave out `matches` and keep evaluation linear in the size of the context.

## API

### `createLanguage(options?)`

Defines a dialect and returns a `Language`. Every option is optional:

- `builtins`: the built-in operators kept, all of them by default.
- `reference`: the operator name a reference is written under, as in `{ op: "segment", name: "internal" }`. Without it the dialect has no references.
- `operators`: field operators made with `defineOperator`. One named like a built-in replaces it.
- `strict`: fails an evaluation on a missing, `null` or mistyped operand instead of answering `false`. `evaluate` then returns `Result<boolean, ExpressionError>`.

### `Language`

- `schema`: a Standard Schema for the dialect's JSON form, to validate an expression before storing it.
- `compile(expression, { references }?)`: validates an expression, runs every operator's compile step and resolves references. Returns `Result<Compiled, ExpressionError>`.
- `evaluate(compiled, context)`: whether a compiled expression holds for a context. The context is any object: nested records, arrays and `Date` values are read by path. A lenient language returns a `boolean`, a strict one a `Result<boolean, ExpressionError>`.
- `paths(compiled)`: every context path a compiled expression reads, through references, as a `ReadonlySet<string>`; each `field`, and each `path` a comparison reads.
- `parse(text)`: reads the text form into the JSON form, validated against the schema. Returns `Result<Expression, ExpressionError>`, the error carrying the `line` and `column` the text broke at.
- `stringify(expression)`: prints the canonical text, which `parse` reads back to the same JSON.
- `Expression` and `Compiled`: type-only members; write `typeof language.Expression` for the JSON form's type and `typeof language.Compiled` for the compiled one.

### Built-in operators

| Operator                             | JSON form                                 | Holds when the field…                           |
| ------------------------------------ | ----------------------------------------- | ----------------------------------------------- |
| `eq`, `ne`                           | `{ op, field, value }` (a JSON primitive) | is, or is not, exactly `value`                  |
| `in`, `notIn`                        | `{ op, field, values }`                   | is, or is not, one of `values`                  |
| `lt`, `lte`, `gt`, `gte`             | `{ op, field, value }` (a number)         | is a number ordered against `value`             |
| `includes`                           | `{ op, field, value }` (a JSON primitive) | is a list with a member equal to `value`        |
| `intersects`                         | `{ op, field, values }`                   | is a list sharing a member with `values`        |
| `subsetOf`                           | `{ op, field, values }`                   | is a list whose every member is one of `values` |
| `startsWith`, `endsWith`, `contains` | `{ op, field, value }` (a string)         | is a string with `value` in place               |
| `matches`                            | `{ op, field, pattern }`                  | is a string the pattern matches                 |
| `exists`                             | `{ op, field }`                           | resolves to anything, `null` too                |
| `all`, `any`                         | `{ op, of: [...] }`                       | —                                               |
| `not`                                | `{ op, of }`                              | —                                               |
| `always`                             | `{ op }`                                  | —                                               |

Every operator from `eq` to `subsetOf` also takes its right-hand side from the context: write `path` in place of `value` or `values`, as in `{ op: "eq", field: "article.authorId", path: "actor.id" }`. A node carries one or the other, never both. A comparison between two paths is false when either holds `null`, and two `Date`s compare by time value.

`field` is a dotted path: `plan.tier` reads a nested object and `roles.0` an array element. A path that resolves to nothing makes every operator except `exists` false. Every comparison stays within one type, so `eq` between `"5"` and `5` is false and `lt` on a string is false. `matches` compiles its pattern with the [`v` flag](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/unicodeSets) at compile time, so a bad pattern fails the compile.

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

Values are JSON literals, written exactly as they are stored. A path is `ctx` followed by one or more segments, such as `ctx.plan.tier` or `ctx.roles.0`; a segment a bare word cannot spell, such as `user-agent`, is quoted in backticks: ``ctx.headers.`user-agent` == "bot"``. The left of a comparison is always a path. Its right is a literal or, for the operators from `eq` to `subsetOf`, a path, as in `includes(ctx.list, ctx.x)`; a path anywhere else fails naming the operator. `ctx` and the other keywords (`and`, `or`, `not`, `in`, `true`, `false`, `null`) cannot name an operator or a reference, and `createLanguage` throws a `TypeError` for one that does.

### `defineOperator(definition)`

Declares a field operator. `op` is its name, `args` lists its fields in call order starting with `field`, `schema` validates the fields beyond `op` and `field`, and `test(value, node, prepared)` answers for a value that is there. The optional `compile(node)` returns a `Result`; what it prepares is kept on the compiled node as `prepared` and passed to `test`.

### `ExpressionError`

The failure every step reports. `path` names the failing node in the JSON form, like `of.1.pattern`, and is empty for the root. A `parse` failure also sets `line` and `column`, both 1-based. A strict `evaluate` failure sets `missing` to the context path that resolved to nothing, or `mismatch` to the two operand types it refused, like `["string", "null"]`; one inside a reference is reported at the reference node with the inner failure as its `cause`.

### `read(context, path)`

Reads a dotted path out of a context exactly as an expression does, returning `undefined` for a miss and keeping a `Date` whole. Use it when code beside an expression reads the same fields.

## Pattern: A sampling exemption from an environment variable

```typescript
import { createLanguage } from "@sdxc/expression";
import { isSuccess } from "@sdxc/result";

let conditions = createLanguage();

// KEEP_WHEN = `ctx.kind == "job" or ctx.status >= 500 or exists(ctx.error)`
let parsed = conditions.parse(process.env.KEEP_WHEN ?? "true");
let compiled = isSuccess(parsed) ? conditions.compile(parsed.data) : parsed;

function keep(fields: Record<string, string | number | boolean | null>) {
	return isSuccess(compiled) && conditions.evaluate(compiled.data, fields);
}
```

## Pattern: Validating a rule before storing it

```typescript
import { createLanguage } from "@sdxc/expression";
import { isFailure } from "@sdxc/result";

let conditions = createLanguage({ reference: "segment" });

async function saveRule(
	store: Map<string, unknown>,
	segments: Record<string, unknown>,
	input: unknown,
) {
	let compiled = conditions.compile(input, { references: segments });
	if (isFailure(compiled)) {
		return { error: compiled.error.message, at: compiled.error.path };
	}

	store.set("rule", input);
	return { ok: true };
}
```

Compiling before writing catches what a schema alone cannot: an unknown reference, a reference cycle, or a pattern that does not compile.

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
