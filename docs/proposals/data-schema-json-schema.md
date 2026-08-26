# JSON Schema support for `remix/data-schema`

Requirements for emitting JSON Schema from a data-schema value. Each numbered item is a
statement that should become a test.

Measured against `@remix-run/data-schema@0.3.0`.

## Goal

`toJSONSchema(schema)` returns a JSON Schema 2020-12 object describing what `schema`
accepts, so one declaration can both validate input and be published to consumers that
speak JSON Schema.

## Current state

A schema value carries no description of itself. At runtime:

```
s.object({ ... })     own props: ~standard, ~run, pipe, refine, transform
s.string()            own props: ~standard, ~run, pipe, refine, transform
s.enum_(["a", "b"])   own props: ~standard, ~run, pipe, refine, transform
~standard             keys:      version, vendor, validate
```

An object, a string and an enum are indistinguishable. Standard Schema v1 specifies a
validator and no introspection, and `createSchema(validator)` is the documented way to
build one, so this is by design rather than an oversight.

Checks are the exception and already carry what an emitter needs:

| Check          | `code`              | `values`     |
| -------------- | ------------------- | ------------ |
| `minLength(1)` | `string.min_length` | `{ min: 1 }` |
| `maxLength(5)` | `string.max_length` | `{ max: 5 }` |
| `min(1)`       | `number.min`        | `{ min: 1 }` |
| `max(9)`       | `number.max`        | `{ max: 9 }` |
| `url()`        | `string.url`        | none         |
| `email()`      | `string.email`      | none         |

Those six are the complete set exported from `remix/data-schema/checks`. They become
unreachable once attached, because `.pipe()` returns a new opaque schema.

Scope is the 22 constructors exported from `remix/data-schema`:

```
any, array, bigint, boolean, defaulted, enum_, instanceof_, literal, map, null_,
nullable, number, object, optional, record, set, string, symbol, tuple, undefined_,
union, variant
```

## Requirements

### Introspection

Worth exposing on its own, not just as an internal step of the emitter.

1. **Every schema reports its own kind.** Given any value from any of the 22 constructors,
   determine which one built it, without calling `validate`.
2. **Object schemas expose their entries:** property names, and each property's schema.
3. **Object schemas expose which properties are required.** `s.optional(x)` as a property
   value is distinguishable from a bare `x`.
4. **Array, set and record schemas expose their element schema.**
5. **Tuple schemas expose their positional schemas, in order.**
6. **Enum and literal schemas expose their values.**
7. **Union and variant schemas expose their members.** A variant also exposes its
   discriminator key.
8. **Modifier schemas expose what they wrap.** `optional`, `nullable` and `defaulted` each
   expose the inner schema, and `defaulted` also exposes the default **value**, not just
   the fact that one exists.
9. **Checks survive `.pipe()`.** For `s.string().pipe(checks.minLength(1), checks.url())`,
   read both checks in order, with the `code` and `values` they already carry.
10. **`.refine()` and `.transform()` are detectable,** even though neither can be
    described.

Introspection must not call the validator, must not throw on any constructible schema, and
must be stable across `.pipe()`, `.refine()` and `.transform()`, so a wrapped schema still
reports the kind underneath.

### Metadata

11. **A schema can carry a description,** and a title.
12. **Both survive `.pipe()`, `.refine()` and `.transform()`** and are readable through
    introspection.

Shape is the implementer's call. `s.string().describe("...")` matches Zod; a
`meta({ description, title })` combinator would also work.

### Emission

13. **`toJSONSchema(schema)` returns a JSON Schema 2020-12 object** for every schema built
    from the mapping table.
14. **The mapping table holds exactly.** Each row is a test.
15. **Checks become constraints** per the table, rather than being dropped.
16. **`defaulted` emits `default` with the value,** and its key is absent from `required`.
17. **`optional` omits the key from `required`;** `nullable` adds `"null"` to the type.
18. **Description and title are emitted** on the node that carries them.
19. **A schema that cannot be represented fails loudly.** Throw, or return an explicit
    failure, naming the schema and the path where it was found. Never silently drop a
    constraint. At minimum: `.refine()`, `.transform()`, `instanceof_`, `symbol`, `map`,
    `bigint`, and `set` with non-string elements.
20. **There is an escape hatch:** a way to attach an explicit JSON Schema fragment to a
    node, so a schema using `.refine()` can still be emitted by stating what the refinement
    means. Without it, requirement 19 makes any schema with a custom rule permanently
    un-emittable.
21. **Emission is pure and side-effect free.**

### Agreement

22. **The emitted schema accepts exactly what the schema accepts,** for the subset in the
    mapping table. Table-driven or property-based: for a set of sample values, `parse`
    succeeding agrees with a standard JSON Schema validator accepting the same value
    against the emitted output. This is what catches a mapping that looks right and is not.

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
| `s.optional(T)` as a property | `T`, key absent from `required`                                     |
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

`bigint`, `symbol`, `instanceof_`, `map`, `undefined_` and `set` with non-string elements
have no representation and must fail per requirement 19.

## Worked example

```ts
let schema = s.object({
	query: s.string().pipe(checks.minLength(1), checks.maxLength(200)).describe("Words to look for."),
	kind: s.optional(s.enum_(["article", "tutorial"])).describe("Restrict to one kind."),
	limit: s.defaulted(s.number().pipe(checks.min(1), checks.max(50)), 10).describe("How many."),
});
```

Must emit, modulo key order:

```json
{
	"type": "object",
	"properties": {
		"query": {
			"type": "string",
			"minLength": 1,
			"maxLength": 200,
			"description": "Words to look for."
		},
		"kind": {
			"type": "string",
			"enum": ["article", "tutorial"],
			"description": "Restrict to one kind."
		},
		"limit": {
			"type": "number",
			"minimum": 1,
			"maximum": 50,
			"default": 10,
			"description": "How many."
		}
	},
	"required": ["query"]
}
```

Three things this pins down:

- `limit` is `defaulted`, so it carries `default` and is **not** required, while `parse`
  still supplies `10` when it is omitted. The emitted schema and the parser have to agree
  about that.
- `kind` is `optional`, so it is absent from `required` and carries no `default`.
- Descriptions reach the output.

## Not in scope

- **Type inference.** `s.InferOutput<typeof schema>` already works. Only the runtime
  direction is missing.
- **JSON Schema to data-schema.** Separate concern.
- **Dialects other than 2020-12.**
- **`$ref` and `$defs`.** Inline everything.
