---
name: sdxc-session-storage-kv
description: "@sdxc/session-storage-kv is a `remix/session` SessionStorage that persists sessions as JSON in a Cloudflare Workers KV namespace, with a configurable key prefix and TTL. Use when wiring `session()` middleware to a KV binding, when the session cookie should carry only an id, when picking a session lifetime or key prefix, or when faking a KV store in session tests."
---

# @sdxc/session-storage-kv

Remix ships cookie, filesystem, memory, Redis and Memcache session stores. `KVSessionStorage`
persists a session as JSON in a key-value store under a key prefix and an expiration you
choose, so the cookie carries only the signed session id and the values live in KV. The
store is reached through a four-method `KVStore` contract rather than Cloudflare's
`KVNamespace` type, so the same adapter runs against the real binding in production and
against an in-memory object in tests, with no Workers runtime involved.

Full API, options and examples: [packages/session-storage-kv/README.md](packages/session-storage-kv/README.md)

## When to reach for it

- Session data has outgrown a cookie, or should not be readable by the client at all.
- A router's `session()` middleware needs a backend for a Workers deployment.
- Sign-in has to rotate the session id and drop the old KV entry, so a captured pre-auth id is worthless.
- Session behavior needs testing in a plain test runner, with no KV binding available.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/session-storage-kv": "workspace:*" } }
```

```ts
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
```

## Suggestions

- Set a `prefix` so sessions stay apart from anything else sharing the namespace, and a `ttlSeconds` matching the lifetime you want; it takes whole seconds as a number or a duration string, so `2_592_000` and `"30 days"` are the same. The defaults are `"session:"` and 365 days.
- Type both parameters — `KVSessionStorage<Values, Flash>` — so `session.get("userId")` narrows instead of returning `unknown`.
- On sign-in call `session.regenerateId(true)`: the `true` is what asks the storage to delete the previous key. The middleware calls `save` once the handler returns.
- A Cloudflare `KVNamespace` satisfies `KVStore` as it is, so pass the binding straight through. In tests, satisfy the same four methods with a `Map` — the fake also records the `expirationTtl` each `put` receives, which is how a configured lifetime is checked without waiting for one.

## Related

- `@sdxc/duration` — supplies the `DurationInput` that `ttlSeconds` accepts; skill `sdxc-duration`
- `@sdxc/cloudflare-mocks` — `createKVNamespace()` is a behavior-accurate in-memory binding to hand the storage in tests; skill `sdxc-cloudflare-mocks`
