# @sdxc/session-storage-kv

A `remix/session` `SessionStorage` backed by a Cloudflare Workers KV store.

The cookie carries only the session id; the values live as JSON in
[Workers KV](https://developers.cloudflare.com/kv/) under a key prefix and an expiration you
choose. The store is any object with KV's `get`/`put`/`delete`/`list` methods, so the same
storage runs on a real `KVNamespace` binding in production and on an in-memory object in tests.

## Installation

```sh
npm add @sdxc/session-storage-kv
```

The session middleware and cookies come from [`remix`](https://www.npmjs.com/package/remix);
lifetimes may be written as duration strings from
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration).

## Usage

### Create the storage

```typescript
import { KVSessionStorage } from "@sdxc/session-storage-kv";

let storage = new KVSessionStorage(env.SESSIONS);
```

A `KVNamespace` binding passes straight through. Each session is stored under
`session:<id>` and expires 365 days after its last save.

### Wire it into a router

```typescript
import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";

let cookie = createCookie("__session", {
	path: "/",
	httpOnly: true,
	sameSite: "Lax",
	secure: true,
	secrets: [env.COOKIE_SECRET],
});

let router = createRouter({
	middleware: [session(cookie, new KVSessionStorage(env.SESSIONS))],
});

router.get("/", (ctx) => {
	let userId = ctx.session.get("userId");
	return new Response(userId ? `Hello ${userId}` : "Hello stranger");
});
```

The middleware reads the session before the handler and saves it after, so handlers only
touch `ctx.session`.

### Choose a key prefix and a lifetime

```typescript
let storage = new KVSessionStorage(env.SESSIONS, {
	prefix: "web:session:",
	ttlSeconds: "30 days",
});
```

`ttlSeconds` takes whole seconds or a duration string, so `2_592_000` and `"30 days"` are the
same lifetime.

### Type the session data

```typescript
import { KVSessionStorage } from "@sdxc/session-storage-kv";

interface Values {
	userId: string;
}

interface Flash {
	error: string;
}

let storage = new KVSessionStorage<Values, Flash>(env.SESSIONS);

let session = await storage.read(cookieValue);
session.get("userId"); // string | undefined
```

The first type parameter describes the values a session keeps, the second the flash values
that survive one read.

## API

### `new KVSessionStorage<Values, Flash>(kv: KVStore, options?: KVSessionStorage.Options)`

Creates a `SessionStorage` over a KV-like store. Pass it to `session()` from
`remix/middleware/session`, or call `read` and `save` yourself.

- `options.prefix`: prepended to every key. Default `"session:"`.
- `options.ttlSeconds`: lifetime of a saved session, as whole seconds or a duration string.
  Default `"365 days"`.

### `storage.read(cookie: string | null): Promise<Session<Values, Flash>>`

Restores the session named by a cookie value. `null` starts a new session with a fresh id; a
missing or unreadable entry reads as an empty session under the same id.

### `storage.save(session: Session<Values, Flash>): Promise<string | null>`

Writes the session and returns the cookie value: the id after a write, `""` after
`session.destroy()` (the entry is deleted), and `null` when nothing changed. After
`session.regenerateId(true)` the previous key is deleted too.

### Types

#### `KVStore`

The store contract. A Cloudflare `KVNamespace` satisfies it as is.

```typescript
interface KVStore {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string | ArrayBuffer | ReadableStream | ArrayBufferView,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
	list(): Promise<{ keys: Array<{ name: string }> }>;
}
```

#### `KVSessionStorage.Options`

The `prefix` and `ttlSeconds` options above.

#### `KVSessionStorage.Data`

`Record<string, unknown>`, the shape both type parameters extend.

## Pattern: Sign In And Sign Out

Rotating the id on sign-in moves the session to a new key and deletes the old one, so an id
captured before authentication stops working. `destroy()` deletes the entry and clears the
cookie.

```typescript
import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { redirect } from "remix/response/redirect";
import { createRouter } from "remix/router";

import { authenticate } from "./auth.js";

let cookie = createCookie("__session", { httpOnly: true, secrets: [env.COOKIE_SECRET] });

let router = createRouter({
	middleware: [session(cookie, new KVSessionStorage(env.SESSIONS))],
});

router.post("/login", async ({ session, request }) => {
	let form = await request.formData();
	let user = await authenticate(form.get("email"), form.get("password"));

	if (!user) {
		session.flash("error", "Invalid email or password");
		return redirect("/login");
	}

	session.regenerateId(true);
	session.set("userId", user.id);
	return redirect("/dashboard");
});

router.get("/login", ({ session }) => {
	let error = session.get("error");
	return new Response(error ?? "Sign in");
});

router.post("/logout", ({ session }) => {
	session.destroy();
	return redirect("/");
});
```

The flashed error is read once on the next `GET /login` and gone after that.

## Pattern: Separate Sessions In One Namespace

Two storages with different prefixes share one KV namespace without touching each other's
keys, each with its own cookie and lifetime.

```typescript
import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { createCookie } from "remix/cookie";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";

let visitors = new KVSessionStorage(env.SESSIONS, {
	prefix: "visitor:",
	ttlSeconds: "30 days",
});

let admins = new KVSessionStorage(env.SESSIONS, {
	prefix: "admin:",
	ttlSeconds: "8 hours",
});

let site = createRouter({
	middleware: [session(createCookie("__visitor", { secrets: [env.COOKIE_SECRET] }), visitors)],
});

let admin = createRouter({
	middleware: [session(createCookie("__admin", { secrets: [env.COOKIE_SECRET] }), admins)],
});
```

## Pattern: Testing With An In-Memory Store

A `Map` satisfies `KVStore`, so session behavior runs in a plain test runner. Recording the
`expirationTtl` each `put` receives checks a configured lifetime without waiting for it.

```typescript
import type { KVStore } from "@sdxc/session-storage-kv";

import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { expect, test } from "vitest";

function createMemoryKV() {
	let values = new Map<string, string>();
	let ttls = new Map<string, number | undefined>();

	let kv: KVStore = {
		async get(key) {
			return values.get(key) ?? null;
		},
		async put(key, value, options) {
			if (typeof value === "string") values.set(key, value);
			ttls.set(key, options?.expirationTtl);
		},
		async delete(key) {
			values.delete(key);
		},
		async list() {
			return { keys: [...values.keys()].map((name) => ({ name })) };
		},
	};

	return { kv, ttls };
}

test("a session round-trips under its prefix and lifetime", async () => {
	let { kv, ttls } = createMemoryKV();
	let storage = new KVSessionStorage(kv, { prefix: "test:", ttlSeconds: "1 hour" });

	let session = await storage.read(null);
	session.set("userId", "user-123");

	let cookie = await storage.save(session);
	let loaded = await storage.read(cookie);

	expect(loaded.get("userId")).toBe("user-123");
	expect(ttls.get(`test:${cookie}`)).toBe(3600);
});
```

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
		"@sdxc/session-storage-kv": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
