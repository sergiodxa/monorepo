# @pkg/get-client-ip

Utility to get the client's IP address from a Cloudflare Workers request.

## Overview

Getting the real client IP address in web applications can be challenging due to proxies, load balancers, and CDNs sitting between users and your server. Each layer can obscure the original IP.

Cloudflare solves this by adding the `CF-Connecting-IP` header to every request passing through their network. This header always contains the original client IP address, regardless of how many proxies the request traversed.

This package provides a simple utility to extract that header value in Cloudflare Workers environments.

## Usage

```typescript
import { getClientIP } from "@pkg/get-client-ip";

export async function loader({ request }: Route.LoaderArgs) {
	let ipAddress = getClientIP(request);
	console.log("Client IP:", ipAddress);
}
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
import { getClientIP } from "@pkg/get-client-ip";

export async function loader({ request, context }: Route.LoaderArgs) {
	let ipAddress = getClientIP(request);

	if (ipAddress) {
		let key = `rate-limit:${ipAddress}`;
		let requests = await context.cloudflare.env.KV.get(key);

		if (requests && parseInt(requests) > 100) {
			throw new Response("Too many requests", { status: 429 });
		}

		await context.cloudflare.env.KV.put(key, String(parseInt(requests ?? "0") + 1), {
			expirationTtl: 60,
		});
	}

	// Continue with request handling
}
```

### Geolocation Logging

Log client IP alongside geolocation data for analytics:

```typescript
import { getClientIP } from "@pkg/get-client-ip";
import { getLoggerFromContext } from "@pkg/logger";

export async function loader({ request, context }: Route.LoaderArgs) {
	let logger = getLoggerFromContext(context);
	let ipAddress = getClientIP(request);
	let cf = request.cf;

	logger.info("request.received", {
		ip: ipAddress,
		country: cf?.country,
		city: cf?.city,
		region: cf?.region,
	});

	// Continue with request handling
}
```

## Related Packages

- [`@pkg/logger`](../logger/README.md) - For logging client IP with requests

## Tips

1. **Always check for null** - The `CF-Connecting-IP` header might not be present in local development or non-Cloudflare environments. Always handle the `null` case gracefully.

2. **Only works in Cloudflare Workers environments** - This package relies on Cloudflare-specific headers. It won't work in other hosting environments unless you configure your proxy to forward similar headers.

3. **Consider privacy implications when logging IP addresses** - IP addresses are personally identifiable information (PII) in many jurisdictions. Ensure you have appropriate privacy policies, data retention limits, and legal basis before storing or logging IP addresses.
