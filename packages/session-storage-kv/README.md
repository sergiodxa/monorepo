# @sdxc/session-storage-kv

A `remix/session` `SessionStorage` backed by a Cloudflare Workers KV store.

Remix ships cookie, filesystem, memory, Redis and Memcache session stores. This one
persists a session as JSON in a key-value store, under a key prefix and an expiration you
choose, so a Workers app keeps its sessions on
[Workers KV](https://developers.cloudflare.com/kv/) while the cookie carries only the id.

The store is reached through a four-method `KVStore` contract rather than Cloudflare's
`KVNamespace` type, so the same adapter runs against the real binding in production and
against an in-memory object in tests, with no Workers runtime involved.

## Installation

```bash
npm add @sdxc/session-storage-kv
```

The session types and the middleware that uses this storage come from
[`remix`](https://www.npmjs.com/package/remix). Session lifetimes may be written as
duration strings from [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration).
Both install alongside this package.

## Usage

### Create The Storage

```typescript
import { KVSessionStorage } from "@sdxc/session-storage-kv";

let storage = new KVSessionStorage(env.KV);
```

Every session is written under `session:${sessionId}` and expires after 365 days.

### Wire It Into A Router

`session()` reads and saves through whichever storage it is handed, so a handler works the
same against KV as against any other backend:

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
	middleware: [session(cookie, new KVSessionStorage(env.KV))],
});

router.get("/", (ctx) => {
	let userId = ctx.session.get("userId");
	return new Response(userId ? `Hello ${userId}` : "Hello stranger");
});
```

The cookie holds the session id and is signed; the values live in KV.

### Choose A Key Prefix And A Lifetime

```typescript
let storage = new KVSessionStorage(env.KV, {
	prefix: "web:session:",
	ttlSeconds: "30 days",
});
```

A prefix keeps sessions apart from anything else in the same namespace. `ttlSeconds`
accepts whole seconds as a number, so `2_592_000` and `"30 days"` set the same expiration.

### Type The Session Data

Both type parameters describe the payload: the values a session keeps, and the flash
values that survive one request.

```typescript
import { KVSessionStorage } from "@sdxc/session-storage-kv";

interface Values {
	userId: string;
}

interface Flash {
	error: string;
}

let storage = new KVSessionStorage<Values, Flash>(env.KV);

let session = await storage.read(cookieValue);
session.get("userId"); // string | undefined
```

## API

### `new KVSessionStorage<Values, Flash>(kv: KVStore, options?: KVSessionStorage.Options)`

Creates the storage over a KV-like store. A Cloudflare `KVNamespace` satisfies `KVStore`
as it is, so the binding can be passed straight through.

### `storage.read(cookie: string | null): Promise<Session>`

Restores the session named by a cookie value. A `null` cookie starts a new session with a
fresh id; a cookie whose KV entry is absent, or whose stored value has a shape other than
the `[values, flash]` tuple this storage writes, reads as an empty session under that same
id.

### `storage.save(session: Session): Promise<string | null>`

Writes the session's current state and returns the value the cookie should carry: the
session id after a write, `""` after `session.destroy()`, and `null` when the session was
left untouched. A session whose id was regenerated with `regenerateId(true)` also has its
previous key deleted.

### `KVSessionStorage.Options`

```typescript
interface Options {
	/** Lifetime of a saved session. A number is whole seconds; a string states its own unit. Default `"365 days"`. */
	ttlSeconds?: DurationInput;
	/** Prefix prepended to every KV key. Default `"session:"`. */
	prefix?: string;
}
```

### `KVSessionStorage.Data`

The `Record<string, unknown>` shape both type parameters extend.

### `KVStore`

What this package needs from a key-value store, and the whole of it:

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

## Pattern: Sign In And Sign Out

Rotating the id on sign-in gives the visitor a new key in KV and drops the old one, so a
session id captured before authentication is worthless afterwards. `destroy()` removes the
entry and clears the cookie:

```typescript
import { redirect } from "remix/response/redirect";

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

router.post("/logout", ({ session }) => {
	session.destroy();
	return redirect("/");
});
```

Passing `true` to `regenerateId` is what asks the storage to delete the previous key; the
middleware calls `save` for you once the handler returns.

## Pattern: Testing Without A KV Binding

`KVStore` is small enough to satisfy with a `Map`, which makes session behavior testable in
a plain test runner:

```typescript
import type { KVStore } from "@sdxc/session-storage-kv";

import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { expect, test } from "vitest";

function createFakeKV(): KVStore {
	let values = new Map<string, string>();

	return {
		async get(key) {
			return values.get(key) ?? null;
		},
		async put(key, value) {
			if (typeof value === "string") values.set(key, value);
		},
		async delete(key) {
			values.delete(key);
		},
		async list() {
			return { keys: [...values.keys()].map((name) => ({ name })) };
		},
	};
}

test("a session round-trips", async () => {
	let storage = new KVSessionStorage(createFakeKV(), { prefix: "test:" });

	let session = await storage.read(null);
	session.set("userId", "user-123");

	let cookie = await storage.save(session);
	let loaded = await storage.read(cookie);

	expect(loaded.get("userId")).toBe("user-123");
});
```

The same fake records the `expirationTtl` each `put` receives, which is how a configured
lifetime is checked without waiting for one.

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
