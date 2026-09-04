# @sdxc/types

TypeScript utility types for async return values, JSON-safe data, and type-level checks.

## Installation

```bash
npm add @sdxc/types
```

Types only: the package ships no runtime code, so import everything with `import type`.

## Usage

### Extract the resolved type of an async function

```typescript
import type { ResolvedType } from "@sdxc/types";

async function fetchUser(id: string): Promise<{ name: string; email: string }> {
	// ...
}

type User = ResolvedType<typeof fetchUser>; // { name: string; email: string }
```

### Type component props from a data function

```typescript
import type { ResolvedType } from "@sdxc/types";

import type { listPosts } from "./posts";

// Props stay in sync with whatever listPosts returns
interface Props {
	posts: ResolvedType<typeof listPosts>;
}
```

Combine it with indexed access to reach nested types, such as `ResolvedType<typeof listPosts>["posts"][number]` for a single item.

### Constrain an argument to valid JSON

Take `JSONValue` as a bound rather than as the parameter type. The caller still gets their own shape back, and anything JSON cannot carry is rejected where it is passed.

```typescript
import type { JSONValue } from "@sdxc/types";

function enqueue<T extends JSONValue>(payload: T): T {
	return payload;
}

let job = enqueue({ id: 1, tags: ["news"], draft: false });
job.tags; // string[] — the literal shape survives

enqueue({ when: new Date() }); // Error: Date is not a JSONValue
enqueue({ run: () => 1 }); // Error: functions are not a JSONValue
enqueue({ missing: undefined }); // Error: undefined is not a JSONValue
```

## API

### `ResolvedType<T>`

Unwraps the value an async function resolves to, where `T` is a function type `(...args: any) => Promise<any>`.

```typescript
type User = ResolvedType<typeof fetchUser>;
// same as
type User = Awaited<ReturnType<typeof fetchUser>>;
```

### `JSONValue`

Any JSON-serializable value. The union recurses into itself, so it is the one type here with no shorthand to expand — writing it inline means writing it out in full:

```typescript
type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
```

Reach for it as a generic bound. As a parameter type it widens the argument to the whole union and the caller loses their shape; as a constraint it only rules values out:

```typescript
function enqueue<T extends JSONValue>(payload: T): T;
// payload stays { id: number; tags: string[] }

function enqueue(payload: JSONValue): JSONValue;
// payload is now the union, and `payload.id` no longer exists
```

### `IsAny<T>`

Resolves to `true` when `T` is `any`, and `false` for every other type. Use it to branch on values that type as `any`, such as the result of `JSON.parse`.

```typescript
type Parsed<T> = IsAny<T> extends true ? unknown : T;
// same as
type Parsed<T> = (0 extends 1 & T ? true : false) extends true ? unknown : T;
```

`0 extends 1 & T` holds only for `any`, because intersecting with `any` collapses `1 & T` back to `any`, which `0` does extend. Every other type leaves `1 & T` incompatible with `0`.

```typescript
type A = IsAny<any>; // true
type B = IsAny<unknown>; // false
type C = IsAny<string>; // false
```

## Pattern: Typing deferred data

A data function can hand back a promise instead of awaiting it, so the caller decides when to resolve. `ResolvedType` names the value on the far side of that promise, letting the consumer type itself without restating the shape.

```typescript
import type { ResolvedType } from "@sdxc/types";

import { listPosts } from "./posts";

function load() {
	return { posts: listPosts() }; // a promise, not awaited
}

interface PostListProps {
	posts: ResolvedType<typeof listPosts>["posts"];
}

function PostList(props: PostListProps) {
	// props.posts is fully typed
}

let { posts } = load();
posts.then((data) => PostList({ posts: data.posts }));
```

## Pattern: A JSON-safe boundary

Anything crossing a serialization boundary — a queue message, a cache entry, a stored column — has to survive `JSON.stringify` and come back intact. Constraining the write side to `JSONValue` moves that from a runtime surprise to a compile error, while the read side still knows the shape it wrote.

```typescript
import type { JSONValue } from "@sdxc/types";

class Queue {
	async push<T extends JSONValue>(topic: string, message: T): Promise<void> {
		await this.transport.send(topic, JSON.stringify(message));
	}
}

let queue = new Queue();

await queue.push("posts", { id: 1, publishedAt: "2026-09-04" });
await queue.push("posts", { id: 1, publishedAt: new Date() }); // Error, caught here
```

The second call fails at the call site rather than surviving as `"2026-09-04T00:00:00.000Z"` and coming back a string the consumer expected to be a `Date`.

## Pattern: Typing array items from query results

Indexed access reaches into the resolved value, so a single item of a returned array gets a name of its own.

```typescript
import type { ResolvedType } from "@sdxc/types";

import type { listPosts } from "./posts";

type Post = ResolvedType<typeof listPosts>["posts"][number];

interface PostRowProps {
	post: Post;
}
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
