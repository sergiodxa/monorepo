# JSON Schema support for `remix/data-schema`

Acceptance criteria for adding JSON Schema emission to `remix/data-schema`, written so the
result is usable by an MCP server. Hand this to the implementer; the checklist in
"Acceptance criteria" is the contract.

Measured against `@remix-run/data-schema@0.3.0`.

## Why this is needed

The Model Context Protocol publishes each tool's argument schema as JSON Schema on the
wire. A client reads it, a model reads it to decide what to pass, and a strict client
validates against it. So a JSON Schema object has to exist for every tool, whatever the
server used to validate with.

Today that means a server cannot use `remix/data-schema` for tool arguments at all. It has
to either write JSON Schema by hand and validate with it, or write the contract twice, once
as JSON Schema for the wire and once as data-schema for validation. The second option is
worse than it sounds: nothing keeps the two in step, and when they drift the failure is
silent and in the dangerous direction, where a client is told about a constraint the server
does not enforce, or is refused for one it was never told about.

Zod v4 solved this with `z.toJSONSchema()`. Valibot solved it with
`@valibot/to-json-schema`. Both work because their schema objects carry structure. This
proposal is about giving data-schema the same property.

## What exists today

A schema value carries no description of itself. Measured at runtime:

```
s.object({ ... })     own props: ~standard, ~run, pipe, refine, transform
s.string()            own props: ~standard, ~run, pipe, refine, transform
s.enum_(["a", "b"])   own props: ~standard, ~run, pipe, refine, transform
~standard             keys:      version, vendor, validate
```

An object, a string and an enum are indistinguishable. No type tag, no entries, no enum
values, no symbols, nothing under `~standard` but a validate function. This is not an
oversight in data-schema; Standard Schema v1 deliberately specifies a validator and no
introspection, and `createSchema(validator)` is the documented way to build one.

Checks are the exception. They already carry everything an emitter needs:

| Check          | `code`              | `values`     |
| -------------- | ------------------- | ------------ |
| `minLength(1)` | `string.min_length` | `{ min: 1 }` |
| `maxLength(5)` | `string.max_length` | `{ max: 5 }` |
| `min(1)`       | `number.min`        | `{ min: 1 }` |
| `max(9)`       | `number.max`        | `{ max: 9 }` |
| `url()`        | `string.url`        | none         |
| `email()`      | `string.email`      | none         |

Those six are the complete set exported from `remix/data-schema/checks`. The problem is
that `.pipe()` returns a new opaque schema, so a check is unreachable the moment it is
attached to the thing it constrains.

## Scope

The 22 schema constructors exported from `remix/data-schema`:

```
any, array, bigint, boolean, defaulted, enum_, instanceof_, literal, map, null_,
nullable, number, object, optional, record, set, string, symbol, tuple, undefined_,
union, variant
```

Not every one has a JSON Schema equivalent, and the criteria below say what happens to the
ones that do not.

## Acceptance criteria

Each item is a statement that should become a test.

### A. Introspection

The emitter is the easy half. Introspection is the part that has to exist first, and it is
worth exposing on its own so consumers can build things this proposal does not anticipate.

1. **Every schema reports its own kind.** Given any value built by any of the 22
   constructors, a consumer can determine which constructor built it, without calling
   `validate`.
2. **Object schemas expose their entries.** For `s.object({ a, b })`, a consumer can read
   the property names and reach each property's schema.
3. **Object schemas expose which properties are required.** `s.optional(x)` as a property
   value must be distinguishable from a bare `x`.
4. **Array, set and record schemas expose their element schema.** For `s.array(s.string())`
   a consumer reaches the inner `s.string()`.
5. **Tuple schemas expose their positional schemas, in order.**
6. **Enum and literal schemas expose their values.** For `s.enum_(["a", "b"])` a consumer
   reads `["a", "b"]`; for `s.literal(3)` it reads `3`.
7. **Union and variant schemas expose their members.** A variant additionally exposes its
   discriminator key.
8. **Modifier schemas expose what they wrap.** `s.optional`, `s.nullable` and `s.defaulted`
   each expose the inner schema, and `s.defaulted` additionally exposes the default value
   itself, not merely the fact that one exists.
9. **Checks survive `.pipe()`.** For `s.string().pipe(checks.minLength(1), checks.url())` a
   consumer can read both checks, in order, with the `code` and `values` they already
   carry.
10. **`.refine()` and `.transform()` are detectable.** A consumer can tell that a schema
    carries a refinement or a transform, even though it cannot describe what either does.

Introspection must not require calling the validator, must not throw on any schema the
library can construct, and must be stable across `.pipe()`, `.refine()` and `.transform()`
so a wrapped schema still reports the kind underneath.

### B. Description and metadata

11. **A schema can carry a description.** MCP puts a `description` on every property, and
    that description is the prompt: it is the only thing a model reads when deciding what
    to pass. Without this the emitter produces schemas with no prose, which for tool
    arguments is close to useless.
12. **A description survives `.pipe()`, `.refine()` and `.transform()`,** and is readable
    through introspection.
13. **A title can be carried the same way.** Optional, but it maps directly to JSON Schema
    `title` and clients render it.

Shape is the implementer's call. `s.string().describe("What to search for")` reads well and
matches Zod. A `meta({ description, title })` combinator would also work. What matters is
that the text reaches the emitted JSON Schema.

### C. Emission

14. **`toJSONSchema(schema)` returns a JSON Schema 2020-12 object** for every schema built
    from the mapping table below.
15. **The mapping table below holds exactly.** Each row is a test.
16. **Checks become constraints,** not lost information: `minLength` becomes `minLength`,
    `url()` becomes `format: "uri"`, and so on per the table.
17. **`defaulted` emits `default` with the value,** and the property is not listed in
    `required`.
18. **`optional` omits the property from `required`;** `nullable` emits a type union with
    `"null"`.
19. **Descriptions and titles are emitted** as `description` and `title` on the node that
    carries them.
20. **A schema that cannot be represented fails loudly.** Emitting must throw, or return an
    explicit failure, naming the schema and the path at which it was found. It must never
    silently drop a constraint. This applies at minimum to `.refine()`, `.transform()`,
    `instanceof_`, `symbol`, `map` and `set` with non-string keys, and `bigint`.
21. **There is an escape hatch for the un-emittable.** A way to attach an explicit JSON
    Schema fragment to a node, so a schema using `.refine()` can still be emitted by
    stating what that refinement means. Without this, criterion 20 makes any schema with a
    custom rule permanently un-emittable.
22. **Emission is pure and side-effect free,** so a server can call it once at startup or
    per request without difference.

### D. Round trip

23. **A schema's emitted JSON Schema accepts exactly what the schema accepts,** for the
    subset in the mapping table. Property-based or table-driven: for a set of sample
    values, `parse` succeeding must agree with a standard JSON Schema validator accepting
    the same value against the emitted schema. This is the criterion that catches a mapping
    that looks right and is not.

## Mapping table

| data-schema                   | JSON Schema                                                         |
| ----------------------------- | ------------------------------------------------------------------- |
| `s.string()`                  | `{ "type": "string" }`                                              |
| `s.number()`                  | `{ "type": "number" }`                                              |
| `s.boolean()`                 | `{ "type": "boolean" }`                                             |
| `s.null_()`                   | `{ "type": "null" }`                                                |
| `s.any()`                     | `{}`                                                                |
| `s.literal("a")`              | `{ "const": "a" }`                                                  |
| `s.enum_(["a", "b"])`         | `{ "type": "string", "enum": ["a", "b"] }`                          |
| `s.array(T)`                  | `{ "type": "array", "items": T }`                                   |
| `s.tuple([A, B])`             | `{ "type": "array", "prefixItems": [A, B], "items": false }`        |
| `s.object({ a: A })`          | `{ "type": "object", "properties": { "a": A }, "required": ["a"] }` |
| `s.record(T)`                 | `{ "type": "object", "additionalProperties": T }`                   |
| `s.optional(T)` as a property | `T`, and the key is absent from `required`                          |
| `s.nullable(T)`               | `T` with `"null"` added to its `type`                               |
| `s.defaulted(T, v)`           | `T` plus `"default": v`, key absent from `required`                 |
| `s.union([A, B])`             | `{ "anyOf": [A, B] }`                                               |
| `s.variant("k", { a: A })`    | `{ "oneOf": [A], "discriminator": { "propertyName": "k" } }`        |
| `.pipe(checks.minLength(n))`  | `"minLength": n`                                                    |
| `.pipe(checks.maxLength(n))`  | `"maxLength": n`                                                    |
| `.pipe(checks.min(n))`        | `"minimum": n`                                                      |
| `.pipe(checks.max(n))`        | `"maximum": n`                                                      |
| `.pipe(checks.url())`         | `"format": "uri"`                                                   |
| `.pipe(checks.email())`       | `"format": "email"`                                                 |
| `.describe(text)`             | `"description": text`                                               |

`s.bigint()`, `s.symbol()`, `s.instanceof_()`, `s.map()`, `s.undefined_()` and `s.set()`
with non-string elements have no representation. They must fail per criterion 20.

## Golden test

This is a real tool schema from our MCP server, written as it would be with this feature.
The emitted JSON Schema must match exactly, modulo key order.

```ts
let searchPosts = s.object({
	query: s
		.string()
		.pipe(checks.minLength(1), checks.maxLength(200))
		.describe("Words to look for. Matched against titles, excerpts and tags."),
	kind: s
		.optional(s.enum_(["article", "tutorial", "glossary"]))
		.describe("Restrict the search to one kind of post."),
	limit: s
		.defaulted(s.number().pipe(checks.min(1), checks.max(50)), 10)
		.describe("How many results to return."),
});
```

```json
{
	"type": "object",
	"properties": {
		"query": {
			"type": "string",
			"minLength": 1,
			"maxLength": 200,
			"description": "Words to look for. Matched against titles, excerpts and tags."
		},
		"kind": {
			"type": "string",
			"enum": ["article", "tutorial", "glossary"],
			"description": "Restrict the search to one kind of post."
		},
		"limit": {
			"type": "number",
			"minimum": 1,
			"maximum": 50,
			"default": 10,
			"description": "How many results to return."
		}
	},
	"required": ["query"]
}
```

Three things this example pins down, each of which we would hit on day one:

- `limit` is `defaulted`, so it carries `default` and is **not** required, but a caller
  omitting it still gets `10` from `parse`. The emitted schema and the parser must agree
  about that.
- `kind` is `optional`, so it is absent from `required` and carries no `default`.
- Every property carries a `description`, because that is what the model reads.

## Non-goals

- **Type inference.** `s.InferOutput<typeof schema>` already gives the TypeScript type, and
  it is correct. Nothing here needs to change it. The broken direction is runtime
  description only.
- **JSON Schema to data-schema.** Useful, separate, not needed for this.
- **Dialects other than 2020-12.** MCP defaults to 2020-12 and that is enough.
- **`$ref` and `$defs`.** Inline everything. Shared subschemas can come later; MCP clients
  are required to handle `$ref` but nothing here needs to produce it.

## How we will verify it on our side

`@pkg/mcp` currently declares tool arguments as JSON Schema literals and derives the
handler's TypeScript argument type from them with a type-level mapper. If this lands we
would invert that: declare with data-schema, emit for the wire, and take the argument type
from `InferOutput`.

That switch is our acceptance test. It needs criteria 1 through 19 and 21. Specifically:

- Without **B (description)** the switch is not worth making, because the tool descriptions
  a model reads would be gone.
- Without **17 and 18 (defaulted and optional)** our handlers lose the property that a
  defaulted argument always arrives, which is currently carried by the type mapper.
- Without **21 (escape hatch)** any tool needing a `.refine()` becomes un-emittable, and we
  would be back to hand-written JSON Schema for that tool.

Our schema subset is deliberately narrower than what data-schema can express. We do not
want `union` or `variant` in tool arguments, because a model given a choice between arms
picks the wrong one. So we would keep a pass that refuses schemas outside our subset. That
is our concern, not this feature's: emitting `anyOf` correctly is still the right behaviour
for data-schema.
