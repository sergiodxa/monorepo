# @pkg/get-client-ip

Utility to get the client's IP address from a Cloudflare Workers request.

## Usage

```typescript
import { getClientIP } from "@pkg/get-client-ip";

export async function loader({ request }: Route.LoaderArgs) {
	const ipAddress = getClientIP(request);
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
