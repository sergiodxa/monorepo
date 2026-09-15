---
name: sdxc-get-client-ip
description: "@sdxc/get-client-ip reads the client IP off a Cloudflare Workers request, returning the `CF-Connecting-IP` header value or `null`. Use when you need the caller's address for rate limiting, audit logs, abuse detection or geolocation in a Worker, or when you catch yourself writing `request.headers.get(\"CF-Connecting-IP\")` by hand."
---

# @sdxc/get-client-ip

A request that reaches a Worker has already crossed Cloudflare's network, and Cloudflare settles the source address by attaching `CF-Connecting-IP`. This package exports one function, `getClientIP(request)`, which reads that header so the name worth remembering is the function rather than the header spelling. It assumes a Cloudflare Workers request; anywhere else the header is absent and the call answers `null`.

Full API, options and examples: [packages/get-client-ip/README.md](packages/get-client-ip/README.md)

## When to reach for it

- Building a per-caller rate-limit bucket key.
- Attaching the caller's address to a log line so requests correlate across a trace.
- Pairing the address with `request.cf` geolocation fields such as `country`, `city` and `region`.
- Replacing a hand-written `CF-Connecting-IP` header read, where a typo shows up as a silent `null` at runtime instead of a failing test.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/get-client-ip": "workspace:*" } }
```

```ts
import { getClientIP } from "@sdxc/get-client-ip";

export function GET(request: Request) {
	let ip = getClientIP(request);
	return Response.json({ ip });
}
```

## Suggestions

- Name the fallback once at the top of the handler — `getClientIP(request) ?? "unknown"` — so the rest stops caring. The header is absent exactly when something other than Cloudflare served the request: a local dev server, a test, another host. In a rate limiter that keeps the budget finite for traffic that arrived some other way, since every such request shares the `unknown` bucket.
- IPv4 and IPv6 both come back as the text Cloudflare sent, and a header repeated across several lines reads as one comma-joined string, the way `Headers.get` reports any repeated header.
- An IP address is personal data in many jurisdictions. Decide what retention applies before a log line carrying one outlives the request that produced it.
- `request.cf` is typed by `@cloudflare/workers-types`, listed in the `types` of a Workers `tsconfig.json`.

## Related

- `@sdxc/rate-limit` — every registration states a `key`, and the client address is the usual answer for a per-caller budget; skill `sdxc-rate-limit`
- `@sdxc/response` — status-named helpers such as `tooManyRequests` for the response a limiter sends back; skill `sdxc-response`
