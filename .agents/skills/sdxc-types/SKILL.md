---
name: sdxc-types
description: "@sdxc/types is a types-only package exporting `ResolvedType`, `JSONPrimitive`, `JSONValue`, `JSONSerializable`, `JSONSerialized` and `IsAny`. Use when constraining a queue message, cache entry or stored column to what JSON can carry, when typing the read side of a serialization boundary in terms of what was written, when deriving props from a data function's resolved value, or when branching on a value that types as `any`."
---

# @sdxc/types

TypeScript utility types for async return values, JSON boundaries, and type-level checks.
`ResolvedType<T>` unwraps what an async function resolves to; `JSONValue` and
`JSONSerializable` name the two directions of a serialization boundary and `JSONSerialized<T>`
names what a written type becomes after the round trip; `JSONPrimitive` is the scalar leaf
and `IsAny<T>` the type-level `any` check. The package ships no runtime code, so everything
is imported with `import type`.

Full API, options and examples: [packages/types/README.md](packages/types/README.md)

## When to reach for it

- A `Date` is being pushed onto a queue or into a cache and coming back as a string the consumer expected to be a `Date`.
- Component props have to stay in sync with whatever a data function returns, without restating its shape.
- A field is compared or used as a key and the signature should say a nested structure has no meaning there.
- The read side of a stored value needs a type instead of widening to `JSONValue` and casting back.
- `JSON.parse` returns `any` and a generic has to branch on that.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/types": "workspace:*" } }
```

```ts
import type { JSONValue } from "@sdxc/types";

function enqueue<T extends JSONValue>(payload: T): T {
	return payload;
}

let job = enqueue({ id: 1, tags: ["news"], draft: false });
job.tags; // string[] — the literal shape survives

enqueue({ when: new Date() }); // Error: Date is not a JSONValue
```

```ts
import type { ResolvedType } from "@sdxc/types";

import type { listPosts } from "./posts";

type Post = ResolvedType<typeof listPosts>["posts"][number];
```

## Suggestions

- Take `JSONValue` as a generic bound, never as the parameter type. As a bound it only rules values out and the caller keeps their shape; as a parameter type it widens the argument to the whole union and `payload.id` stops existing.
- Pick the type by direction: `JSONSerializable` where a value is written (it adds the `toJSON` branch, so `Date` and `URL` pass), `JSONValue` where one is read back, because the replacement is what a reader receives.
- `JSONSerialized<T>` applies `toJSON`, drops a property JSON cannot write, and writes an unwritable array element as `null` so the length read back is unchanged. It describes the shape, not the value: a cycle still throws, `NaN` and `Infinity` still read back as `null`, and an inherited property is kept by the type while `JSON.stringify` leaves it out.
- `JSONSerialized` tracks nine levels of nesting and widens to `JSONValue` below that, which is what lets a generic constrained to `JSONSerializable` pass through it — unbounded, the recursive pair exhausts the compiler.
