---
name: sdxc-get-client-ip
description: "@sdxc/get-client-ip reads the client IP off a Cloudflare Workers request: `getClientIP(request)` parses the `CF-Connecting-IP` header into an `IP` from `@sdxc/ip` (or `null` when missing or malformed), and the `@sdxc/get-client-ip/middleware` default export publishes it as `ctx.ip`. Use when you need the caller's address for rate limiting, audit logs, abuse detection or geolocation in a Worker, or when you catch yourself writing `request.headers.get(\"CF-Connecting-IP\")` by hand."
---

# @sdxc/get-client-ip

A request that reaches a Worker has already crossed Cloudflare's network, and Cloudflare settles the source address by attaching `CF-Connecting-IP`. `getClientIP(request)` reads that header and parses it into an `IP` (`@sdxc/ip`), answering `null` when it is absent or not an address, so junk never becomes a key or a stored value. The `./middleware` default export does the same once per request and publishes `ctx.ip: IP | null`; `ClientIP` is its context key.

Full API, options and examples: [packages/get-client-ip/README.md](packages/get-client-ip/README.md)

## When to reach for it

- Building a per-caller rate-limit bucket key.
- Attaching the caller's address to a log line or a stored record.
- Pairing the address with `request.cf` geolocation fields such as `country`, `city` and `region`.
- Replacing a hand-written `CF-Connecting-IP` header read.

## Using it

```json
{ "dependencies": { "@sdxc/get-client-ip": "workspace:*" } }
```

```ts
import getClientIP from "@sdxc/get-client-ip/middleware";

let router = createRouter({ middleware: [log(logger), getClientIP()] });

router.use(
	rateLimit({
		adapter,
		prefix: "signup:ip",
		key: (ctx) => ctx.ip?.network({ v4: 32, v6: 64 }).toString() ?? "unknown",
	}),
);
```

Without a router context (a job, a Durable Object), use the root export:

```ts
import { getClientIP } from "@sdxc/get-client-ip";

let ip = getClientIP(request)?.toString() ?? null;
```

## Suggestions

- Key rate limits on `ip.network({ v4: 32, v6: 64 }).toString()`: an IPv6 client controls a whole `/64`.
- Store and forward `ip.toString()`, the canonical text; compare with `ip.equals(other)`.
- Name the fallback once — `?? "unknown"` — so every request without a usable header shares one bucket.
- An IP address is personal data in many jurisdictions. Decide what retention applies before a log line carrying one outlives the request that produced it.

## Related

- `@sdxc/ip` — the `IP` value object, classification and ranges; skill `sdxc-ip`
- `@sdxc/rate-limit` — every registration states a `key`; skill `sdxc-rate-limit`
- `@sdxc/response` — status-named helpers such as `tooManyRequests`; skill `sdxc-response`
