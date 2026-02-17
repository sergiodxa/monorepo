---
title: How to Store Authorization Codes with KV TTL
excerpt: Use Cloudflare KV expiration to store OAuth authorization codes that automatically expire.
tech: wrangler@3.0.0
---

When [building an OAuth 2.0 authorization server](/tutorials/build-an-oauth2-oidc-provider-from-scratch), you need to store authorization codes temporarily. These codes are [exchanged for access tokens](/articles/oauth2-tokens-explained) and should expire quickly, typically within minutes, to prevent replay attacks. The challenge is ensuring these codes are automatically cleaned up after they expire.

Cloudflare KV provides a built-in TTL (Time to Live) feature that automatically deletes keys after a specified duration. This makes it perfect for storing short-lived authorization codes without needing a separate cleanup job or cron task. For more patterns on using KV effectively, see [how to build a cache abstraction for Cloudflare KV](/tutorials/build-a-cache-abstraction-for-cloudflare-kv).

## Define the Authorization Code Schema

First, create a Zod schema to validate the data stored with each authorization code:

```ts {% path="app/entities/authz-code.ts" %}
import { z } from "zod";

const Schema = z.object({
	clientId: z.string(),
	subjectId: z.string(),
	sessionId: z.string(),
	pkce: z.object({ challenge: z.string(), method: z.enum(["S256", "plain"]) }).nullable(),
});
```

This schema defines the data associated with each authorization code: the client requesting the token, the user (subject) who authorized it, the session, and optional [PKCE parameters](/tutorials/use-pkce-in-oauth2-authorization-code-flow) for enhanced security.

## Generate and Store the Authorization Code

Create a method that generates a cryptographically secure code and stores it in KV with an expiration:

```ts {% path="app/entities/authz-code.ts" %}
import { z } from "zod";

import { AUTHZ_CODE_TTL } from "../config";
import { getKV } from "../lib/kv";

const Schema = z.object({
	clientId: z.string(),
	subjectId: z.string(),
	sessionId: z.string(),
	pkce: z.object({ challenge: z.string(), method: z.enum(["S256", "plain"]) }).nullable(),
});

export default class AuthzCode {
	static async generate(
		clientId: string,
		subjectId: string,
		sessionId: string,
		pkce: { challenge: string; method: "S256" | "plain" } | null,
	) {
		let code = AuthzCode.generateCode();
		let kv = getKV();

		await kv.put(`authz-code:${code}`, JSON.stringify({ clientId, subjectId, sessionId, pkce }), {
			expirationTtl: AUTHZ_CODE_TTL,
		});

		return code;
	}

	private static generateCode() {
		return crypto.randomUUID();
	}
}
```

The `expirationTtl` option tells KV to automatically delete this key after the specified number of seconds. The code uses `crypto.randomUUID()` to generate a secure, unique identifier that cannot be guessed.

## Retrieve and Validate the Authorization Code

Add a method to find and validate an authorization code:

```ts {% path="app/entities/authz-code.ts" %}
static async find(code: string) {
	let kv = getKV();
	let result = await kv.get(`authz-code:${code}`);
	if (!result) return null;
	return Schema.parse(JSON.parse(result));
}
```

When the code is exchanged for a token, this method retrieves the stored data. If the code has expired, KV automatically returns `null` because the key no longer exists. The Zod schema validates the data structure before returning it.

## Use the Authorization Code Entity

In your token endpoint, use the entity to validate and consume authorization codes:

```ts {% path="app/routes/oauth.token.ts" %}
import AuthzCode from "../entities/authz-code";

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let code = formData.get("code");

	if (typeof code !== "string") {
		throw new Error("Invalid code parameter");
	}

	let authzCode = await AuthzCode.find(code);

	if (!authzCode) {
		throw new Error("Invalid or expired authorization code");
	}

	// Validate PKCE, client credentials, and issue tokens...
}
```

The `find` method returns `null` for both invalid codes and expired codes, treating them identically. This prevents timing attacks that could reveal whether a code existed but expired. After validating the code, you would [validate PKCE](/tutorials/use-pkce-in-oauth2-authorization-code-flow) if present and issue tokens.

## Configure the TTL Duration

Store the TTL value in a configuration file to keep it consistent across your application:

```ts {% path="app/config.ts" %}
// TTL in seconds for KV expiration
export const AUTHZ_CODE_TTL = 600; // 10 minutes
```

Authorization codes should have a short TTL since they are exchanged immediately after the user authorizes the request. Ten minutes is a reasonable default that accounts for network delays while limiting the window for replay attacks. Once exchanged, the code is used to issue [access and refresh tokens](/articles/oauth2-tokens-explained) that have their own lifecycles.

## Why KV TTL Works Well for Authorization Codes

Using KV with TTL for authorization codes provides several benefits:

1. **Automatic cleanup**: expired codes are deleted without any background jobs
2. **Consistent behavior**: the same `null` response for missing and expired codes
3. **Low latency**: KV is optimized for fast reads at the edge
4. **No database overhead**: avoids storing temporary data in your primary database

The trade-off is that KV is eventually consistent, meaning there's a small window where a code might still be readable after expiration. For most OAuth implementations, this is acceptable since the code is typically used immediately after generation.
