# @sdxc/json-schema

Schema builders that validate like `remix/data-schema` and describe themselves as JSON Schema 2020-12.

## Installation

```bash
npm add @sdxc/json-schema
```

Validation delegates to [`remix`](https://www.npmjs.com/package/remix)'s `remix/data-schema`,
and `toJSONSchema` returns an [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
value. Both install alongside this package.

A `remix/data-schema` schema validates, but nothing can read back what it accepts. This package
offers the same combinators, with the same names and signatures, where every schema validates
through `remix/data-schema` and also carries the
[JSON Schema 2020-12](https://json-schema.org/draft/2020-12) keywords that describe it, so the
schema a handler validates with is the schema an API reference publishes. Every schema
implements [Standard JSON Schema](https://standardschema.dev) (`~standard.jsonSchema`), and
nests inside `remix/data-schema` combinators like any other.

## Usage

### Describe A Request Body

```typescript
import { isSuccess } from "@sdxc/result";
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

let ProductUpdate = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	stock: s.optional(s.integer().pipe(checks.min(0), checks.max(10_000))),
	url: s.string().pipe(checks.url()),
});

let body = s.parse(ProductUpdate, await request.json()); // validates exactly like data-schema

let result = s.toJSONSchema(ProductUpdate);
if (isSuccess(result)) result.data;
// {
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   type: "object",
//   properties: {
//     name: { type: "string", minLength: 1, maxLength: 255 },
//     stock: { type: "integer", minimum: 0, maximum: 10000 },
//     url: { type: "string", format: "uri" },
//   },
//   required: ["url"],
// }
```

### Name A Schema

`meta({ id })` hoists a schema into `$defs`, and every use becomes a `$ref`:

```typescript
import * as s from "@sdxc/json-schema";

let Product = s
	.object({
		id: s.string(),
		createdAt: s.integer().meta({ description: "Epoch milliseconds" }),
	})
	.meta({ id: "Product" });

s.toJSONSchema(s.object({ product: Product }));
// success: { properties: { product: { $ref: "#/$defs/Product" } }, $defs: { Product: { ... } }, ... }
```

### Recursive Schemas

```typescript
import * as s from "@sdxc/json-schema";

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

### `@sdxc/json-schema`

Import it as a namespace, `import * as s from "@sdxc/json-schema"`, and call sites read exactly
like `remix/data-schema`.

#### Combinators

Each takes the arguments of its `remix/data-schema` counterpart and validates identically. A
nested schema can be any `DescribedSchema`: a schema from this package, or one built with
`remix/data-schema` directly that implements Standard JSON Schema itself.

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
`ObjectOptions` types `object`'s options (`unknownKeys`: `"strip"`, `"passthrough"` or
`"error"`), and `ObjectInput<Shape>` / `ObjectOutput<Shape>` its two sides.

#### Chain Methods

- `schema.pipe(...checks)` validates each check; a check from `./checks` also adds its keyword.
  A plain `remix/data-schema` check validates without documenting.
- `schema.refine(predicate, message?)` validates; the JSON Schema is unchanged, so describe the
  rule with `meta()` when it matters to a reader.
- `schema.transform(fn, output?)` keeps this schema as the input side and describes the output
  side with `output`, or `{}` without one. A check piped after it documents the output only.
- `schema.meta(annotations)` adds `title`, `description`, `examples`, `deprecated`, `format`,
  `pattern`, `readOnly` and `writeOnly`; `id` names the schema in `$defs`.

#### `toJSONSchema(schema, options?)`

Converts any Standard JSON Schema into a standalone document declaring `$schema`, as a
`Result<JSONSchema, JSONSchemaConversionError>`. `ToJSONSchemaOptions` types the options:

- `direction`: `"input"` (default) or `"output"`, the side of each `transform`.
- `refs`: `"defs"` (default) collects named schemas under `$defs`; `"inline"` writes them in
  place, keeping `$ref` only where a `lazy` schema recurses.

#### `JSONSchemaConversionError`

A nested schema with no JSON Schema form, such as one built with `remix/data-schema` directly,
fails with this error; its `path` names where it sits
(`["properties", "address", "properties", "city"]`). Two different schemas sharing one `id`
fail too.

#### `withJSONSchema(schema, jsonSchema)`

Pairs a schema built with `remix/data-schema` directly with a hand-written JSON Schema, for a
shape the combinators cannot express. Pass `{ input, output }` when a transform changes the
value's shape.

```typescript
import * as s from "@sdxc/json-schema";
import * as ds from "remix/data-schema";

let slug = s.withJSONSchema(
	ds.string().refine((value) => /^[a-z0-9-]+$/.test(value)),
	{ type: "string", pattern: "^[a-z0-9-]+$" },
);
```

#### `parse`, `parseSafe`, `ValidationError`, `InferInput`, `InferOutput`

Re-exported from `remix/data-schema`, so one import covers validating and describing.

#### Types

- `JSONSchema`: the 2020-12 vocabulary this package emits and reads, with `JSONSchema.TypeName`
  and `JSONSchema.Direction`.
- `Schema<Input, Output>`: a `remix/data-schema` schema that implements Standard JSON Schema and
  carries the chain methods above.
- `DescribedSchema<Input, Output>`: what a combinator nests, any `remix/data-schema` schema that
  implements Standard JSON Schema.
- `Check<Output>`: a `remix/data-schema` check with the `keywords` it documents.
- `Annotations<Output>`: what `meta()` accepts.

### `@sdxc/json-schema/checks`

`minLength(n)`, `maxLength(n)`, `min(n)`, `max(n)`, `email()` and `url()` carry the codes and
messages of their `remix/data-schema` counterparts. `pattern(regex)`, `minItems(n)` and
`maxItems(n)` add what an API reference documents. Each check's `keywords` holds the JSON Schema
it contributes; `minLength`/`maxLength` piped into an array document as `minItems`/`maxItems`.
`pattern` tests a copy of the regex without the `g` and `y` flags, so no `lastIndex` carries
between calls.

### `@sdxc/json-schema/coerce`

`number()`, `boolean()`, `date()`, `bigint()` and `string()`, for query strings, path params and
form fields. The input side documents the text a caller may send (`type: ["number", "string"]`),
and the output side the value the parser yields; `date()` documents both sides as
`format: "date-time"`.

## Pattern: A Path Parameter That Documents Its Format

A prefixed id validates with a regex and decodes with a transform. Pipe the regex as a check so
the same expression validates and documents, and the transform keeps the documented input side:

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

function prefixedId(prefix: string) {
	return s
		.string()
		.pipe(checks.pattern(new RegExp(`^${prefix}_[0-9a-z]{26}$`)))
		.transform((value) => value.slice(prefix.length + 1));
}

let Params = s.object({ orderId: prefixedId("ord") });
// properties.orderId: { type: "string", pattern: "^ord_[0-9a-z]{26}$" }
```

## Pattern: A Query String With Coercion

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as coerce from "@sdxc/json-schema/coerce";

let Query = s.object({
	page: s.defaulted(coerce.number().pipe(checks.min(1)), 1),
	archived: s.optional(coerce.boolean()),
});

let query = s.parse(Query, Object.fromEntries(new URL(request.url).searchParams));
query.page; // number

s.toJSONSchema(Query, { direction: "input" }); // page: { type: ["number", "string"], minimum: 1, default: 1 }
```

## Pattern: Hand A Schema To A Standard JSON Schema Tool

Any tool that reads `~standard.jsonSchema` accepts these schemas directly:

```typescript
let json = Product["~standard"].jsonSchema.input({ target: "draft-2020-12" });
```

That converter throws on failure, as the interface prescribes; call `toJSONSchema` for a `Result`.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/json-schema": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
