# @sdxc/get-client-ip

Read the client IP your proxy or edge reports for a request, parsed into an address.

Every hosting platform puts the connecting client's address in a header: Cloudflare in
[`CF-Connecting-IP`](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip),
a reverse proxy in `X-Forwarded-For` or `Forwarded`, Fly.io in `Fly-Client-IP`. This package reads
the one header your platform sets and parses it into an `IP` from
[`@sdxc/ip`](https://www.npmjs.com/package/@sdxc/ip), so only a valid address ever becomes a rate
limit key or a stored value. It runs on any runtime with the Fetch API.

## Installation

```sh
npm add @sdxc/get-client-ip
```

`@sdxc/ip` and [`remix`](https://www.npmjs.com/package/remix), for the middleware, are installed
with it.

## Usage

### Read the caller's address

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export function GET(request: Request) {
	let ip = getClientIP(request); // IP | null
	return Response.json({ ip }); // {"ip":"203.0.113.42"}
}
```

An `IP` serializes as its canonical text, so it goes straight into JSON.

`CF-Connecting-IP` is read unless you name another header.

### Read the header your platform sets

```typescript
getClientIP(request, { header: "Fly-Client-IP" });
getClientIP(request, { header: "X-Forwarded-For" }); // behind one reverse proxy
getClientIP(request, { header: "X-Forwarded-For", proxies: 2 }); // a CDN, then a load balancer
```

Only the named header is read. A client can send any header it likes, so a header is trustworthy
only when the platform in front of your app overwrites it, and reading a second one would let a
client pick its own address. Name exactly the header your platform documents.

`X-Forwarded-For` and `Forwarded` are lists every proxy appends to, and a client can write the
first entries itself. The address is read from the right: `proxies` is how many trusted proxies
append an entry (one by default), and the entry the outermost of them appended is the client.

| Platform                        | `header`           |
| ------------------------------- | ------------------ |
| Cloudflare                      | `CF-Connecting-IP` |
| Fly.io                          | `Fly-Client-IP`    |
| Fastly                          | `Fastly-Client-IP` |
| Akamai, Cloudflare Enterprise   | `True-Client-IP`   |
| Azure Front Door                | `X-Azure-ClientIP` |
| DigitalOcean App Platform       | `DO-Connecting-IP` |
| Shopify Oxygen                  | `Oxygen-Buyer-IP`  |
| nginx with `proxy_set_header`   | `X-Real-IP`        |
| Most load balancers and proxies | `X-Forwarded-For`  |
| Proxies following RFC 7239      | `Forwarded`        |

`CLIENT_IP_HEADERS` lists these names, and `header` accepts any other name as a header carrying
one address.

### Fall back when there is no address

A request no trusted proxy routed (a local dev server, a test) has no header, and a header that
is not one address parses to nothing; both answer `null`, so one fallback covers them:

```typescript
let ip = getClientIP(request)?.toString() ?? "unknown";
```

### Publish it on every request

The middleware parses the header once per request and publishes it as `ctx.ip`:

```typescript
import getClientIP from "@sdxc/get-client-ip/middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [getClientIP()] });

router.get("/", (ctx) => {
	return Response.json({ ip: ctx.ip?.toString() ?? null });
});
```

## API

### `getClientIP(source: Request | Headers, options?: ClientIPOptions): IP | null`

Parses the configured header into an `IP`, or answers `null` when the header is absent, is not
one address, or (for a list) has fewer entries than `proxies`.

- `header`: the header to read. Default `"CF-Connecting-IP"`.
- `proxies`: for `X-Forwarded-For` and `Forwarded`, how many trusted proxies append an entry,
  counted from the right. A port on the entry is dropped. Default `1`.

### `CLIENT_IP_HEADERS`

The header names platforms and proxies use for the client's address, typed as `ClientIPHeader`.

### `@sdxc/get-client-ip/middleware`

#### `getClientIP(options?: ClientIPOptions): Middleware` (default export)

A router middleware that sets `ctx.ip` to the address `getClientIP` reads with the same options. Importing the module types
`ctx.ip` as `IP | null`.

#### `ClientIP`

The context key the middleware writes, for code that reads the value with `ctx.get(ClientIP)`.
A context the middleware never ran on reads `null`.

## Pattern: Rate Limiting Per Client Network

An IPv6 client is usually assigned a whole `/64` and can send each request from a different
address in it. Keying IPv6 on its `/64` and IPv4 on the full address gives one budget per client:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { ok, tooManyRequests } from "@sdxc/response";

let LIMIT = 100;
let WINDOW_SECONDS = 60;

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

Requests without a usable address share the `unknown` bucket, which keeps their budget finite.
The status helpers come from [`@sdxc/response`](https://www.npmjs.com/package/@sdxc/response).

## Pattern: Restricting Routes To A Network

A guard middleware reads the address through the `ClientIP` key and answers before the handler
when it falls outside an allowed range:

```typescript
import getClientIP, { ClientIP } from "@sdxc/get-client-ip/middleware";
import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";
import type { Middleware } from "remix/router";
import { createRouter } from "remix/router";

let OFFICE = IP.Range.parse("203.0.113.0/24");

function officeOnly(): Middleware {
	return (ctx, next) => {
		let ip = ctx.get(ClientIP);
		if (ip === null || !isSuccess(OFFICE) || !OFFICE.data.contains(ip)) {
			return new Response("Forbidden", { status: 403 });
		}
		return next();
	};
}

let router = createRouter({ middleware: [getClientIP(), officeOnly()] });
```

## Pattern: Attaching The Address To A Log Line

The address goes onto the request's wide event from
[`@sdxc/logger`](https://www.npmjs.com/package/@sdxc/logger) as one field:

```typescript
import type { Middleware } from "remix/router";

export function logClient(): Middleware {
	return (ctx, next) => {
		ctx.log.set({ client: { ip: ctx.ip?.toString() ?? null } });
		return next();
	};
}
```

Mount it after `log(logger)` and `getClientIP()`, so both `ctx.log` and `ctx.ip` are set when it
runs. An IP address is personal data in many jurisdictions, so decide its retention before the
log line outlives the request.

## Pattern: Pairing It With Cloudflare's Geolocation

A Worker request also carries a `cf` object with the location Cloudflare resolved for the same
connection:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";

export function GET(request: Request) {
	return Response.json({
		ip: getClientIP(request),
		country: request.cf?.country,
		city: request.cf?.city,
	});
}
```

`request.cf` is typed by
[`@cloudflare/workers-types`](https://www.npmjs.com/package/@cloudflare/workers-types).

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
