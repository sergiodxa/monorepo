# @sdxc/json-schema

Schema builders that validate like `remix/data-schema` and emit JSON Schema 2020-12.

Every combinator takes the same arguments as its `remix/data-schema` counterpart and validates
through it, and the schema also carries the [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
keywords that describe it. The schema a handler validates with is the schema an API reference
publishes. Every schema implements [Standard JSON Schema](https://standardschema.dev) and nests
inside `remix/data-schema` combinators like any other.

## Installation

```sh
npm add @sdxc/json-schema
```

Validation runs on `remix/data-schema` from [`remix`](https://www.npmjs.com/package/remix), and
`toJSONSchema` answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

## Usage

### Validate a request body

Import the package as a namespace and call sites read like `remix/data-schema`. Checks from
`./checks` validate and document in one value.

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

let ProductUpdate = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	stock: s.optional(s.integer().pipe(checks.min(0), checks.max(10_000))),
	url: s.string().pipe(checks.url()),
});

let body = s.parse(ProductUpdate, await request.json());
// { name?: string; stock?: number; url: string }
```

### Describe it as JSON Schema

```typescript
import { isSuccess } from "@sdxc/result";

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

### Name and annotate schemas

`meta()` adds annotations; an `id` hoists the schema into `$defs` and every use becomes a `$ref`.

```typescript
import * as s from "@sdxc/json-schema";

let Product = s
	.object({
		id: s.string().meta({ readOnly: true }),
		createdAt: s.integer().meta({ description: "Epoch milliseconds" }),
	})
	.meta({ id: "Product", title: "Product" });

s.toJSONSchema(s.object({ product: Product, related: s.array(Product) }));
// properties.product: { $ref: "#/$defs/Product" }, $defs: { Product: { ... } }

s.toJSONSchema(Product, { refs: "inline" }); // the object in place, no $defs
```

### Recursive schemas

`lazy()` defers the schema until first use and always documents as a `$ref`, so recursion ends.

```typescript
import * as s from "@sdxc/json-schema";

interface Category {
	name: string;
	children: Category[];
}

let Category: s.Schema<unknown, Category> = s.lazy(
	() => s.object({ name: s.string(), children: s.array(Category) }),
	{ id: "Category" },
);
// { $ref: "#/$defs/Category", $defs: { Category: { ..., children: { items: { $ref: ... } } } } }
```

## API

### Combinators

Each validates exactly like its `remix/data-schema` namesake and returns a `Schema`. A nested
schema can be any `DescribedSchema`.

| Combinator                          | JSON Schema 2020-12                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `string()`, `number()`, `boolean()` | `type`                                                                          |
| `integer()`                         | `type: "integer"`; validates as `number()` plus `Number.isInteger`              |
| `null_()` / `any()`                 | `type: "null"` / `{}`                                                           |
| `literal(value)`                    | `const`, plus `type`                                                            |
| `enum_(values)`                     | `enum`, plus `type` when every value shares one                                 |
| `object(shape, options?)`           | `properties`, and `required` for keys not wrapped in `optional`/`defaulted`     |
| `optional(schema)`                  | the key leaves `required`                                                       |
| `defaulted(schema, value)`          | `default: value`; the key leaves `required` on the input side only              |
| `nullable(schema)`                  | `type: [T, "null"]` for a scalar, `anyOf: [schema, { type: "null" }]` otherwise |
| `array(item)`                       | `items`                                                                         |
| `tuple(items)`                      | `prefixItems`, `items: false`, and fixed `minItems`/`maxItems`                  |
| `record(key, value)`                | `additionalProperties`, plus `propertyNames` when the key schema has checks     |
| `union(members)`                    | `anyOf`                                                                         |
| `variant(key, variants)`            | `oneOf` with each branch pinning `key` by `const`, plus OpenAPI `discriminator` |
| `lazy(get, { id })`                 | `$ref: "#/$defs/<id>"` in every `refs` mode                                     |

`object`'s `options.unknownKeys` is `"strip"` (default), `"passthrough"` or `"error"`, which
documents as `additionalProperties: false`. A key whose value accepts `undefined` is optional
(`key?:`) in the inferred types.

### Schema methods

- `pipe(...checks)` runs each check; a check from `./checks` also adds its keyword, a plain
  `remix/data-schema` check only validates.
- `refine(predicate, message?)` validates and leaves the JSON Schema unchanged.
- `transform(fn, output?)` keeps this schema as the input side and documents the output side
  as `output`, or `{}` without one. A check piped after it documents the output side.
- `meta(annotations)` adds `title`, `description`, `examples`, `deprecated`, `format`,
  `pattern`, `readOnly` and `writeOnly`; `id` names the schema in `$defs`.

### `toJSONSchema(schema: StandardJSONSchemaV1, options?: ToJSONSchemaOptions): Result<JSONSchema, JSONSchemaConversionError>`

Converts any Standard JSON Schema into a standalone document declaring `$schema`.

- `direction`: `"input"` (default) describes what a caller sends, `"output"` what a parse yields.
- `refs`: `"defs"` (default) collects named schemas under `$defs`; `"inline"` writes them in
  place, keeping `$ref` where a `lazy` schema recurses.

### `withJSONSchema(schema, jsonSchema: JSONSchema | { input: JSONSchema; output: JSONSchema }): Schema`

Pairs a schema built with `remix/data-schema` directly with a hand-written JSON Schema. Pass
`{ input, output }` when a transform changes the value's shape.

### `JSONSchemaConversionError`

The failure of `toJSONSchema`: a nested schema with no JSON Schema form, or two different schemas
sharing one `id`. `path` holds the failing schema's location, such as
`["properties", "address", "properties", "city"]`.

### `parse`, `parseSafe`, `ValidationError`

Re-exported from `remix/data-schema`, so one import validates and describes.

### `@sdxc/json-schema/checks`

`minLength(n)`, `maxLength(n)`, `min(n)`, `max(n)`, `email()` and `url()` carry the codes and
messages of their `remix/data-schema` counterparts and document as `minLength`, `maxLength`,
`minimum`, `maximum`, `format: "email"` and `format: "uri"`. `minLength`/`maxLength` piped into
an array document as `minItems`/`maxItems`. `pattern(regex)`, `minItems(n)` and `maxItems(n)`
add the matching keyword; `pattern` ignores the `g` and `y` flags.

### `@sdxc/json-schema/coerce`

`number()`, `boolean()`, `date()`, `bigint()` and `string()` convert text from query strings,
path params and form fields. The input side documents what a caller may send
(`type: ["number", "string"]`), the output side what the parser yields; `date()` documents both
sides as `{ type: "string", format: "date-time" }`.

### Types

- `JSONSchema`: the 2020-12 vocabulary the package emits, with `JSONSchema.TypeName` and
  `JSONSchema.Direction`.
- `Schema<Input, Output>`: a `remix/data-schema` schema with the methods above that implements
  Standard JSON Schema.
- `DescribedSchema<Input, Output>`: any `remix/data-schema` schema that also implements Standard
  JSON Schema, which is what a combinator nests.
- `Check<Output>`: a `remix/data-schema` check with the `keywords` it documents.
- `Annotations<Output>`: what `meta()` accepts.
- `ToJSONSchemaOptions`, `ObjectOptions`: the options of `toJSONSchema` and `object`.
- `ObjectInput<Shape>`, `ObjectOutput<Shape>`: the two sides of `object(shape)`.
- `InferInput<S>`, `InferOutput<S>`: re-exported from `remix/data-schema`.

## Pattern: A Path Parameter That Documents Its Format

Pipe the regex as a check so one expression validates and documents, then transform it into the
value the handler uses and describe that side too.

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

function prefixedId(prefix: string) {
	return s
		.string()
		.pipe(checks.pattern(new RegExp(`^${prefix}_[0-9a-z]{26}$`)))
		.transform((value) => value.slice(prefix.length + 1), s.string());
}

let Params = s.object({ orderId: prefixedId("ord") });

s.parse(Params, { orderId: "ord_01j9z3k8m2q4r6t8v0w2y4a6c8" }); // { orderId: "01j9z3k8…" }
s.toJSONSchema(Params); // orderId: { type: "string", pattern: "^ord_[0-9a-z]{26}$" }
s.toJSONSchema(Params, { direction: "output" }); // orderId: { type: "string" }
```

## Pattern: A Query String With Coercion

Every query value arrives as text; `coerce` parses it and documents both forms.

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import * as coerce from "@sdxc/json-schema/coerce";

let Query = s.object({
	page: s.defaulted(coerce.number().pipe(checks.min(1)), 1),
	since: s.optional(coerce.date()),
	archived: s.optional(coerce.boolean()),
	sort: s.defaulted(s.enum_(["newest", "oldest"]), "newest"),
});

let query = s.parse(Query, Object.fromEntries(new URL(request.url).searchParams));
query.page; // number, 1 when absent

s.toJSONSchema(Query);
// page: { type: ["number", "string"], minimum: 1, default: 1 }, no required keys
s.toJSONSchema(Query, { direction: "output" });
// page: { type: "number", minimum: 1, default: 1 }, required: ["page", "sort"]
```

## Pattern: A Tagged Union Of Events

`variant` picks a branch by its key and documents it as `oneOf` with an OpenAPI `discriminator`;
named branches also fill the discriminator's `mapping`.

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";

let Created = s
	.object({ type: s.literal("created"), id: s.string(), email: s.string().pipe(checks.email()) })
	.meta({ id: "UserCreated" });

let Deleted = s
	.object({ type: s.literal("deleted"), id: s.string(), deletedAt: s.nullable(s.integer()) })
	.meta({ id: "UserDeleted" });

let Event = s.variant("type", { created: Created, deleted: Deleted });

let event = s.parse(Event, await request.json());
if (event.type === "created") event.email;

s.toJSONSchema(Event);
// {
//   oneOf: [{ allOf: [{ $ref: "#/$defs/UserCreated" }, ...] }, ...],
//   discriminator: { propertyName: "type", mapping: { created: "#/$defs/UserCreated", ... } },
//   $defs: { UserCreated: { ... }, UserDeleted: { ... } },
// }
```

## Pattern: A Shape The Combinators Cannot Express

Give a `remix/data-schema` schema its JSON Schema with `withJSONSchema`, then nest it like any
other. A failed conversion names where it happened.

```typescript
import { isFailure } from "@sdxc/result";
import * as s from "@sdxc/json-schema";
import * as ds from "remix/data-schema";

let slug = s.withJSONSchema(
	ds.string().refine((value) => /^[a-z0-9-]+$/.test(value)),
	{ type: "string", pattern: "^[a-z0-9-]+$" },
);

let cents = s.withJSONSchema(ds.string().transform(Number), {
	input: { type: "string", pattern: "^[0-9]+$" },
	output: { type: "integer" },
});

let Price = s.object({ slug, cents });

let result = s.toJSONSchema(Price);
if (isFailure(result)) {
	throw new Error(`${result.error.message} at ${result.error.path.join("/")}`);
}
```

## Pattern: Hand A Schema To A Standard JSON Schema Tool

Any tool that reads `~standard.jsonSchema` (form generators, OpenAPI builders, LLM tool
definitions) accepts these schemas directly.

```typescript
import * as s from "@sdxc/json-schema";

let Product = s.object({ name: s.string(), price: s.number() });

let input = Product["~standard"].jsonSchema.input({ target: "draft-2020-12" });
let output = Product["~standard"].jsonSchema.output({ target: "draft-2020-12" });
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
