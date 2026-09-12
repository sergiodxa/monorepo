# @sdxc/get-client-ip

Read the client IP from a Cloudflare Workers request.

A request that reaches a Worker has already crossed Cloudflare's network, and every proxy
along the way is another hop that could have rewritten the source address. Cloudflare
settles it by attaching
[`CF-Connecting-IP`](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip),
a header carrying the address the connection actually came from. This package reads that
header, so the one name worth remembering is the function rather than the header spelling.

## Installation

```bash
npm add @sdxc/get-client-ip
```

The rate-limit pattern below answers with a status helper from
[`@sdxc/response`](https://www.npmjs.com/package/@sdxc/response), which you install only if
you want those helpers.

## Usage

### Read The Caller's Address

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export function GET(request: Request) {
	let ip = getClientIP(request);
	return Response.json({ ip });
}
```

### Handle A Request Without The Header

The header arrives on every request Cloudflare routes, so it is absent exactly when
something else served the request — a local dev server, a test, another host. Name the
fallback and the rest of the handler stops caring:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export function GET(request: Request) {
	let ip = getClientIP(request) ?? "unknown";
	return Response.json({ ip });
}
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

### `getClientIP(request: Request): string | null`

Returns the value of the request's `CF-Connecting-IP` header, or `null` when the header is
absent. IPv4 and IPv6 both come back as the text Cloudflare sent, and a header repeated
across several lines reads as one comma-joined string, the way `Headers.get` reports any
repeated header.

```typescript
getClientIP(request); // "203.0.113.42"
```

Longhand, this is `request.headers.get("CF-Connecting-IP")` — the value of the export is
that the header name is written once, in a place a typo shows up as a failing test rather
than as a `null` at runtime.

## Pattern: Rate Limiting Per Client

The address is the bucket key, so a counter in a KV namespace gives one budget per caller
per window:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { ok, tooManyRequests } from "@sdxc/response";

/** How many requests one address may spend inside the window. */
const LIMIT = 100;
const WINDOW_SECONDS = 60;

export default {
	async fetch(request: Request, env: { KV: KVNamespace }) {
		let key = `rate-limit:${getClientIP(request) ?? "unknown"}`;
		let spent = Number((await env.KV.get(key)) ?? "0");

		if (spent >= LIMIT) return tooManyRequests({ error: "Rate limit exceeded" });

		await env.KV.put(key, String(spent + 1), { expirationTtl: WINDOW_SECONDS });

		return ok({ status: "up" });
	},
};
```

Every request that arrives without the header shares the `unknown` bucket, which keeps the
budget finite for traffic that reached the Worker some other way.

## Pattern: Attaching The Address To A Log Line

Logging the address turns a stack trace into something you can correlate across requests:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export async function GET(request: Request) {
	let url = new URL(request.url);

	console.log("request.received", {
		ip: getClientIP(request),
		path: url.pathname,
		method: request.method,
	});

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
