# @sdxc/get-client-ip

Read the client IP from a Cloudflare Workers request, parsed into an address.

A request that reaches a Worker has already crossed Cloudflare's network, and every proxy
along the way is another hop that could have rewritten the source address. Cloudflare
settles it by attaching
[`CF-Connecting-IP`](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip),
a header carrying the address the connection actually came from. This package reads that
header and parses it into an `IP` from [`@sdxc/ip`](https://www.npmjs.com/package/@sdxc/ip),
so a junk header can never become a rate limit key or a stored address.

## Installation

```bash
npm add @sdxc/get-client-ip
```

`@sdxc/ip` and [`remix`](https://www.npmjs.com/package/remix), for the middleware, are
installed with it.

## Usage

### Read The Caller's Address

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export function GET(request: Request) {
	let ip = getClientIP(request); // IP | null
	return Response.json({ ip }); // {"ip":"203.0.113.42"}, through IP#toJSON
}
```

### Publish It On Every Request

The middleware parses the header once per request and publishes it as `ctx.ip`:

```typescript
import getClientIP from "@sdxc/get-client-ip/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [getClientIP()] });

router.get("/", (ctx) => {
	return Response.json({ ip: ctx.ip?.toString() ?? null });
});
```

### Handle A Request Without The Header

The header arrives on every request Cloudflare routes, so it is absent exactly when
something else served the request — a local dev server, a test, another host. A header
that is not an address answers `null` too, so one fallback covers both:

```typescript
let ip = getClientIP(request)?.toString() ?? "unknown";
```

### Pair It With Cloudflare's Geolocation

A Worker request also carries a `cf` object with the location Cloudflare resolved for that
same connection, so the address and where it came from read together:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export function GET(request: Request) {
	return Response.json({
		ip: getClientIP(request),
		country: request.cf?.country,
		city: request.cf?.city,
		region: request.cf?.region,
	});
}
```

`request.cf` is typed by
[`@cloudflare/workers-types`](https://www.npmjs.com/package/@cloudflare/workers-types),
listed in the `types` of a Workers `tsconfig.json`.

## API

### `getClientIP(request: Request): IP | null`

Parses the request's `CF-Connecting-IP` header into an `IP`, or answers `null` when the
header is absent or is not one address — a header repeated across several lines reads as a
comma-joined string, which is not.

```typescript
getClientIP(request)?.toString(); // "203.0.113.42" or "2001:db8::1"
```

### `@sdxc/get-client-ip/middleware`

- Default export `getClientIP()` — a router middleware that sets `ctx.ip` to
  `getClientIP(ctx.request)`. Importing the module types `ctx.ip` as `IP | null`.
- `ClientIP` — the context key, for code that reads the value with `ctx.get(ClientIP)`. A
  context the middleware never ran on reads `null`.

## Pattern: Rate Limiting Per Client Network

An IPv6 client is normally assigned a whole `/64` and can send each request from a
different address in it. Keying IPv6 on its `/64` and IPv4 on the full address gives one
budget per client:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { ok, tooManyRequests } from "@sdxc/response";

/** How many requests one client may spend inside the window. */
const LIMIT = 100;
const WINDOW_SECONDS = 60;

export default {
	async fetch(request: Request, env: { KV: KVNamespace }) {
		let client = getClientIP(request)?.network({ v4: 32, v6: 64 }).toString() ?? "unknown";
		let key = `rate-limit:${client}`;
		let spent = Number((await env.KV.get(key)) ?? "0");

		if (spent >= LIMIT) return tooManyRequests({ error: "Rate limit exceeded" });

		await env.KV.put(key, String(spent + 1), { expirationTtl: WINDOW_SECONDS });

		return ok({ status: "up" });
	},
};
```

Every request that arrives without a usable header shares the `unknown` bucket, which keeps
the budget finite for traffic that reached the Worker some other way. The status helpers
come from [`@sdxc/response`](https://www.npmjs.com/package/@sdxc/response).

## Pattern: Attaching The Address To A Log Line

An `IP` serializes as its canonical text, so it goes into a structured log as is:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export async function GET(request: Request) {
	let url = new URL(request.url);

	console.log(
		JSON.stringify({
			event: "request.received",
			ip: getClientIP(request),
			path: url.pathname,
			method: request.method,
		}),
	);

	return new Response("OK");
}
```

An IP address is personal data in many jurisdictions. Decide what retention applies before
a log line like this outlives the request that produced it.

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
		"@sdxc/get-client-ip": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
