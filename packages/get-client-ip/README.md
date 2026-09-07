# @sdxc/get-client-ip

Utility to get the client's IP address from a Cloudflare Workers request.

## Overview

Getting the real client IP address in web applications can be challenging due to proxies, load balancers, and CDNs sitting between users and your server. Each layer can obscure the original IP.

Cloudflare solves this by adding the `CF-Connecting-IP` header to every request passing through their network. This header always contains the original client IP address, regardless of how many proxies the request traversed.

This package provides a simple utility to extract that header value in Cloudflare Workers environments.

## Usage

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { ok } from "@sdxc/response";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** GET /api/whoami — answers with the caller's own IP address. */
export default createAction(routes.api.whoami, (ctx) => {
	return ok({ ip: getClientIP(ctx.request) });
});
```

## API

### `getClientIP(request: Request): string | null`

Gets the client's IP address from a Cloudflare Workers request.

Reads the `CF-Connecting-IP` header which Cloudflare automatically adds to all requests with the client's IP address.

**Parameters:**

- `request`: The incoming Request object

**Returns:**

- The client's IP address as a string, or `null` if not available

## How it works

Cloudflare automatically adds the `CF-Connecting-IP` header to all requests passing through their network. This header contains the original client IP address, even if the request has passed through proxies or load balancers.

This is the recommended way to get client IP addresses in Cloudflare Workers applications.

## Patterns

### Rate Limiting

Use the client IP to implement rate limiting:

```typescript
import { getClientIP } from "@sdxc/get-client-ip";
import { ok, tooManyRequests } from "@sdxc/response";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** How many requests one IP may spend inside {@link WINDOW_SECONDS}. */
const LIMIT = 100;
const WINDOW_SECONDS = 60;

/** GET /api/status — serves the status, spending the caller's per-minute budget first. */
export default createAction(routes.api.status, async (ctx) => {
	let key = `rate-limit:${getClientIP(ctx.request) ?? "unknown"}`;
	let spent = Number((await env.KV.get(key)) ?? "0");

	if (spent >= LIMIT) return tooManyRequests({ error: "Rate limit exceeded" });

	await env.KV.put(key, String(spent + 1), { expirationTtl: WINDOW_SECONDS });

	return ok({ status: "up" });
});
```

A missing header falls back to a shared `unknown` bucket, so a request that arrives without one still spends a budget.

### Geolocation Logging

Log client IP alongside geolocation data for analytics:

```tsx
import { getClientIP } from "@sdxc/get-client-ip";
import { createAction } from "remix/router";

import DashboardView from "~/resources/views/dashboard";
import routes from "~/routes/web";

/** GET /dashboard — records where the visitor connected from, then renders the page. */
export default createAction(routes.dashboard, (ctx) => {
	let cf = ctx.request.cf;

	ctx.log.note("request.received", {
		ip: getClientIP(ctx.request),
		country: cf?.country,
		city: cf?.city,
		region: cf?.region,
	});

	return ctx.render(<DashboardView />);
});
```

## Related Packages

- [`@sdxc/logger`](../logger/README.md) - For logging client IP with requests
- [`@sdxc/response`](../response/README.md) - Status helpers such as the `429` a rate limit answers with

## Tips

1. **Always check for null** - The `CF-Connecting-IP` header might not be present in local development or non-Cloudflare environments. Always handle the `null` case gracefully.

2. **Only works in Cloudflare Workers environments** - This package relies on Cloudflare-specific headers. It won't work in other hosting environments unless you configure your proxy to forward similar headers.

3. **Consider privacy implications when logging IP addresses** - IP addresses are personally identifiable information (PII) in many jurisdictions. Ensure you have appropriate privacy policies, data retention limits, and legal basis before storing or logging IP addresses.
