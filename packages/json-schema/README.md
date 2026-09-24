# @sdxc/json-schema

Schema builders that validate like `remix/data-schema` and describe themselves as JSON Schema 2020-12.

## Overview

A `remix/data-schema` schema is a set of closures: it validates, but nothing can read back what
it accepts. This package offers the same combinators, with the same names and signatures, where
every schema validates by delegating to `remix/data-schema` and also carries the
[JSON Schema 2020-12](https://json-schema.org/draft/2020-12) keywords that describe it. The
schema a handler validates with is then the schema an API reference or an OpenAPI document
publishes, and the two cannot drift.

Every schema implements [Standard JSON Schema](https://standardschema.dev) (`~standard.jsonSchema`),
so any tool that asks a schema for JSON Schema can read it, and `toJSONSchema` reads schemas
from any library that implements that interface. A schema is still a `remix/data-schema`
schema: it nests inside `remix/data-schema` combinators, and `parse`/`parseSafe` work on it.

`refine` and `transform` take arbitrary functions, which no library can turn into JSON Schema.
A refinement documents nothing unless it is described with `meta()`, and a `transform`
describes its output side only when it is given the output's schema.

## Usage

### Describe A Request Body

```typescript
import { isFailure } from "@sdxc/result";
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

let MonitorUpdate = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	intervalSeconds: s.optional(s.integer().pipe(checks.min(60), checks.max(3600))),
	url: s.string().pipe(checks.url()),
});

let body = s.parse(MonitorUpdate, await request.json()); // validates exactly like data-schema

let result = s.toJSONSchema(MonitorUpdate);
if (isFailure(result)) throw result.error;
// {
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   type: "object",
//   properties: {
//     name: { type: "string", minLength: 1, maxLength: 255 },
//     intervalSeconds: { type: "integer", minimum: 60, maximum: 3600 },
//     url: { type: "string", format: "uri" },
//   },
//   required: ["url"],
// }
```

### Name A Schema

`meta({ id })` hoists a schema into `$defs`, and every use becomes a `$ref`:

```typescript
let Monitor = s
	.object({
		id: s.string(),
		createdAt: s.integer().meta({ description: "Epoch milliseconds" }),
	})
	.meta({ id: "Monitor" });

s.toJSONSchema(s.object({ monitor: Monitor }));
// { properties: { monitor: { $ref: "#/$defs/Monitor" } }, $defs: { Monitor: { ... } }, ... }
```

### Recursive Schemas

```typescript
interface Category {
	name: string;
	children: Category[];
}

const CATEGORY: s.Schema<unknown, Category> = s.lazy(
	() => s.object({ name: s.string(), children: s.array(CATEGORY) }),
	{ id: "Category" },
);
// { $ref: "#/$defs/Category", $defs: { Category: { ..., children: { items: { $ref: ... } } } } }
```

## API

### Combinators

Each takes the arguments of its `remix/data-schema` counterpart and validates identically.

| Combinator                                | JSON Schema 2020-12                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| `string()`, `number()`, `boolean()`       | `type`                                                                        |
| `integer()`                               | `type: "integer"`; validates as `number()` plus `Number.isInteger`            |
| `null_()` / `any()`                       | `type: "null"` / `{}`                                                         |
| `literal(v)` / `enum_(values)`            | `const` / `enum`, plus `type` when every value shares one                     |
| `object(shape, options?)`                 | `properties`; `required` lists keys not wrapped in `optional` or `defaulted`  |
| `object(shape, { unknownKeys: "error" })` | adds `additionalProperties: false`                                            |
| `optional(x)`                             | the key leaves `required`                                                     |
| `defaulted(x, v)`                         | adds `default: v`; the key leaves the input side's `required` only            |
| `nullable(x)`                             | `type: [T, "null"]` for a scalar, `anyOf: [x, { type: "null" }]` otherwise    |
| `array(item)`                             | `items`                                                                       |
| `tuple(items)`                            | `prefixItems`, `items: false`, and a fixed `minItems`/`maxItems`              |
| `record(key, value)`                      | `additionalProperties`, plus `propertyNames` when the key is constrained      |
| `union(members)`                          | `anyOf`                                                                       |
| `variant(key, variants)`                  | `oneOf`, each branch pinning `key` with `const`, plus OpenAPI `discriminator` |
| `lazy(get, { id })`                       | `$ref: "#/$defs/<id>"`, in every refs mode, so recursion terminates           |

An object's inferred types make a key optional (`key?:`) when its value accepts `undefined`.

### Chain Methods

- `schema.pipe(...checks)` validates each check; a check from `./checks` also adds its keyword.
  A plain `remix/data-schema` check validates without documenting.
- `schema.refine(predicate, message?)` validates; the JSON Schema is unchanged.
- `schema.transform(fn, output?)` keeps this schema as the input side and describes the output
  side with `output`, or `{}` without one. A check piped after it documents the output only.
- `schema.meta(annotations)` adds `title`, `description`, `examples`, `deprecated`, `format`,
  `pattern`, `readOnly` and `writeOnly`; `id` names the schema in `$defs`.

### `@sdxc/json-schema/checks`

`minLength(n)`, `maxLength(n)`, `min(n)`, `max(n)`, `email()` and `url()` carry the codes and
messages of their `remix/data-schema` counterparts. `pattern(regex)`, `minItems(n)` and
`maxItems(n)` add what an API reference documents. Each check's `keywords` holds the JSON Schema
it contributes; `minLength`/`maxLength` piped into an array document as `minItems`/`maxItems`.

### `@sdxc/json-schema/coerce`

`number()`, `boolean()`, `date()`, `bigint()` and `string()`, for query strings and path
params. The input side documents the text a caller may send (`type: ["number", "string"]`), and
the output side the value the parser yields.

### `toJSONSchema(schema, options?): Result<JSONSchema, JSONSchemaConversionError>`

Converts any Standard JSON Schema into a standalone document declaring `$schema`.

- `options.direction`: `"input"` (default) or `"output"`, the side of each `transform`.
- `options.refs`: `"defs"` (default) collects named schemas under `$defs`; `"inline"` writes
  them in place, keeping `$ref` only where a `lazy` schema recurses.

A nested schema that cannot describe itself, such as one built with `remix/data-schema`
directly, fails with a `JSONSchemaConversionError` whose `path` names where it sits
(`["properties", "address", "properties", "city"]`). Two different schemas sharing one `id` fail
too.

### `withJSONSchema(schema, jsonSchema): Schema`

Pairs a schema built with `remix/data-schema` directly with a hand-written JSON Schema, for a
shape the combinators cannot express. Pass `{ input, output }` when a transform changes the
value's shape.

```typescript
import * as ds from "remix/data-schema";

let slug = s.withJSONSchema(ds.string().refine(isSlug), {
	type: "string",
	pattern: "^[a-z0-9-]+$",
});
```

### Re-exports

`parse`, `parseSafe`, `ValidationError`, `InferInput` and `InferOutput` from `remix/data-schema`.

### Types

- `JSONSchema`: the 2020-12 vocabulary this package emits and reads, with `JSONSchema.TypeName`
  and `JSONSchema.Direction`.
- `Schema<Input, Output>`: a `remix/data-schema` schema that implements Standard JSON Schema.
- `Check<Output>`: a `remix/data-schema` check with `keywords`.
- `Annotations<Output>`: what `meta()` accepts.

## Pattern: A Path Parameter That Documents Its Format

A typed id validates with a regex and decodes with a transform. Pipe the regex as a check so the
same expression validates and documents, and the transform keeps the documented input side:

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

function typedId(prefix: string) {
	return s
		.string()
		.pipe(checks.pattern(new RegExp(`^${prefix}_[0-9a-z]{26}$`)))
		.transform((value) => decode(value));
}

let Params = s.object({ monitorId: typedId("mon") });
// properties.monitorId: { type: "string", pattern: "^mon_[0-9a-z]{26}$" }
```

## Pattern: Handing A Schema To A Standard JSON Schema Tool

Any tool that reads `~standard.jsonSchema` accepts these schemas directly:

```typescript
let json = Monitor["~standard"].jsonSchema.input({ target: "draft-2020-12" });
```

That converter throws on failure, as the interface prescribes; call `toJSONSchema` for a `Result`.

## Related Packages

- [`@sdxc/openapi`](/packages/openapi) - Builds OpenAPI 3.1 documents from these schemas
- [`@sdxc/validate`](/packages/validate) - Validates requests with Standard Schema
- [`@sdxc/result`](/packages/result) - The `Result` `toJSONSchema` returns

## Tips

1. **Import as a namespace** - `import * as s from "@sdxc/json-schema"` keeps call sites identical to `remix/data-schema`.
2. **Prefer keyword-carrying checks over `refine`** - a check from `./checks` documents itself; a refinement needs `meta()`.
3. **Give a transform its output schema** - without one the output side is `{}`.
4. **Name shared shapes** - `meta({ id })` turns repeated objects into one `$defs` entry, which OpenAPI hoists to `components.schemas`.
