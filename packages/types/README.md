# @sdxc/types

Shared TypeScript types for async return values, JSON boundaries and type-level checks.

## Installation

```sh
npm add @sdxc/types
```

The package ships types only, so import everything with `import type`.

## Usage

### Name what an async function resolves to

```typescript
import type { ResolvedType } from "@sdxc/types";

async function fetchUser(id: string): Promise<{ name: string; email: string }> {
	return { name: id, email: `${id}@example.com` };
}

type User = ResolvedType<typeof fetchUser>; // { name: string; email: string }
```

### Accept only values that survive JSON

Use `JSONValue` as a generic bound: the caller keeps their own shape, and anything JSON cannot
carry is rejected at the call site.

```typescript
import type { JSONValue } from "@sdxc/types";

function enqueue<T extends JSONValue>(payload: T): T {
	return payload;
}

let job = enqueue({ id: 1, tags: ["news"], draft: false });
job.tags; // string[]

enqueue({ when: new Date() }); // Error: a Date comes back as a string
enqueue({ run: () => 1 }); // Error: functions are not JSON
```

### Accept anything `JSON.stringify` can write

`JSONSerializable` adds objects with a `toJSON`, such as `Date` and `URL`.

```typescript
import type { JSONSerializable } from "@sdxc/types";

function write<T extends JSONSerializable>(payload: T): string {
	return JSON.stringify(payload);
}

write({ publishedAt: new Date(), href: new URL("https://example.com") });
```

### Type what comes back

`JSONSerialized<T>` is the shape a written value has after `JSON.parse`.

```typescript
import type { JSONSerialized } from "@sdxc/types";

type Stored = JSONSerialized<{ id: number; publishedAt: Date; edit: () => void }>;
// { id: number; publishedAt: string }
```

## API

### `ResolvedType<T extends (...args: any) => Promise<any>>`

The value an async function resolves to; shorthand for `Awaited<ReturnType<T>>`.

### `JSONPrimitive`

`string | number | boolean | null`. Take it where a value is compared, indexed or used as a key,
so the signature says a structure has no meaning there.

### `JSONValue`

`JSONPrimitive | JSONValue[] | { [key: string]: JSONValue }`: a value that comes back from
`JSON.parse` identical to what was written. Use it as a generic bound (`T extends JSONValue`); as
a plain parameter type it widens the argument and the caller loses their shape.

### `JSONSerializable`

`JSONValue` plus `{ toJSON(): JSONSerializable }` at any depth: every value `JSON.stringify`
accepts. Take it where a value is written and `JSONValue` (or `JSONSerialized<T>`) where it is
read back, since the reader receives the `toJSON` replacement.

### `JSONSerialized<T>`

What `T` becomes after a JSON round trip: `toJSON` is applied, unwritable properties are dropped,
and unwritable array elements become `null`. A `JSONValue` comes back unchanged.

```typescript
JSONSerialized<Date>; // string
JSONSerialized<undefined[]>; // null[]
JSONSerialized<[string, Date]>; // [string, string]
```

It describes the shape, so it tracks nine levels of nesting and widens to `JSONValue` below
that, and it keeps getters and inherited properties that `JSON.stringify` leaves out.

### `IsAny<T>`

`true` when `T` is `any`, `false` for every other type, `unknown` included. Equivalent to
`0 extends 1 & T ? true : false`.

## Pattern: Typing a consumer from its data function

Name the data once, at its source, and derive props and item types from it with indexed access.

```typescript
import type { ResolvedType } from "@sdxc/types";

async function listPosts() {
	return { posts: [{ id: "1", title: "Hello" }], total: 1 };
}

type PostList = ResolvedType<typeof listPosts>;
type Post = PostList["posts"][number]; // { id: string; title: string }

interface PostRowProps {
	post: Post;
}

let pending = listPosts(); // hand the promise on unawaited
pending.then((list: PostList) => list.posts.map((post): PostRowProps => ({ post })));
```

## Pattern: A typed queue across a JSON boundary

The producer may send a `Date`; the consumer is typed with the string it will actually receive.

```typescript
import type { JSONSerializable, JSONSerialized } from "@sdxc/types";

class Topic<T extends JSONSerializable> {
	#messages: string[] = [];

	push(message: T): void {
		this.#messages.push(JSON.stringify(message));
	}

	pull(): JSONSerialized<T> | undefined {
		let raw = this.#messages.shift();
		return raw === undefined ? undefined : JSON.parse(raw);
	}
}

let posts = new Topic<{ id: number; publishedAt: Date }>();
posts.push({ id: 1, publishedAt: new Date() });

let message = posts.pull();
message?.publishedAt; // string
```

## Pattern: A cache that only stores round-trippable values

When the value read back must be the value written, constrain the write to `JSONValue`.

```typescript
import type { JSONValue } from "@sdxc/types";

class Cache {
	#entries = new Map<string, string>();

	set<T extends JSONValue>(key: string, value: T): void {
		this.#entries.set(key, JSON.stringify(value));
	}

	get<T extends JSONValue>(key: string): T | undefined {
		let raw = this.#entries.get(key);
		return raw === undefined ? undefined : JSON.parse(raw);
	}
}

let cache = new Cache();
cache.set("plans", ["free", "pro"]);
cache.set("now", new Date()); // Error: read back, it would be a string
```

## Pattern: Filters over scalar fields

`JSONPrimitive` keeps comparisons to values that compare meaningfully.

```typescript
import type { JSONPrimitive } from "@sdxc/types";

interface Condition {
	field: string;
	value: JSONPrimitive;
}

function eq(field: string, value: JSONPrimitive): Condition {
	return { field, value };
}

eq("plan", "pro");
eq("seats", null);
eq("plan", { tier: "pro" }); // Error: an object is not a JSONPrimitive
```

## Pattern: Turning `any` into `unknown`

`IsAny` lets a helper refuse to pass `any` through, so a caller narrows the result of
`JSON.parse` before using it.

```typescript
import type { IsAny } from "@sdxc/types";

type Known<T> = IsAny<T> extends true ? unknown : T;

function read<T>(load: () => T): Known<T> {
	return load() as Known<T>;
}

let parsed = read(() => JSON.parse('{"id":1}')); // unknown
let count = read(() => 42); // number
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/types": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
