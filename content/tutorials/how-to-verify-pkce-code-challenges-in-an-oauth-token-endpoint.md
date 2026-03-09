---
title: How to Verify PKCE Code Challenges in an OAuth Token Endpoint
excerpt: Build PKCE generation and verification for an OAuth authorization code flow.
tech: "@cloudflare/workers-types@4.0.0"
---

PKCE adds proof of possession to the OAuth authorization code flow. The client sends a derived `code_challenge` during authorization, then proves it still has the original `code_verifier` during the token exchange.

In this tutorial, you'll build the full flow: generate the verifier and challenge, store the challenge with the authorization code, and verify the verifier before issuing tokens.

## Create the PKCE Helpers

```ts {% path="app/lib/pkce.ts" %}
export type PKCEMethod = "S256" | "plain";

export function base64UrlEncode(bytes: Uint8Array): string {
	let binary = String.fromCharCode(...bytes);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function generateCodeVerifier(): string {
	let bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
	let encoder = new TextEncoder();
	let data = encoder.encode(verifier);
	let hash = await crypto.subtle.digest("SHA-256", data);
	return base64UrlEncode(new Uint8Array(hash));
}

export async function validatePKCE(
	verifier: string,
	challenge: string,
	method: PKCEMethod,
): Promise<boolean> {
	if (method === "plain") return verifier === challenge;
	return (await generateCodeChallenge(verifier)) === challenge;
}
```

This file gives you the full PKCE core. `generateCodeVerifier` creates a random verifier, `generateCodeChallenge` derives the `S256` challenge, and `validatePKCE` compares both sides during the token exchange.

## Persist the Verifier Before Redirecting

```ts {% path="app/lib/oauth-client.ts" %}
import { generateCodeChallenge, generateCodeVerifier } from "./pkce";

interface AuthorizationRequest {
	url: URL;
	setCookie: string;
}

export async function createAuthorizationRequest(): Promise<AuthorizationRequest> {
	let codeVerifier = generateCodeVerifier();
	let state = crypto.randomUUID();
	let codeChallenge = await generateCodeChallenge(codeVerifier);

	let cookieValue = btoa(
		JSON.stringify({
			codeVerifier,
			state,
		}),
	)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=/g, "");

	let url = new URL("/authorize", "https://auth.example.com");
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", "your-client-id");
	url.searchParams.set("redirect_uri", "https://app.example.com/callback");
	url.searchParams.set("scope", "openid email profile");
	url.searchParams.set("state", state);
	url.searchParams.set("code_challenge", codeChallenge);
	url.searchParams.set("code_challenge_method", "S256");

	return {
		url,
		setCookie: `__oauth_state=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
	};
}
```

The client stores the `code_verifier` and `state` together before redirecting to the authorization endpoint. The authorization request only includes the derived challenge, which is the value the server will later verify against.

## Advertise Supported Challenge Methods

```ts {% path="app/lib/discovery.ts" %}
export let oauthMetadata = {
	code_challenge_methods_supported: ["S256", "plain"],
};
```

This tells OAuth clients which PKCE methods your server accepts. `S256` should be the default, while `plain` is usually kept only for compatibility.

## Save PKCE Data with the Authorization Code

```ts {% path="app/db/schema.ts" %}
import * as s from "remix/data-schema";
import { createTable } from "remix/data-table";

export let authorizationCodeTable = createTable({
	name: "authorization_codes",
	primaryKey: ["code"],
	columns: {
		code: s.string(),
		client_id: s.string(),
		subject_id: s.string(),
		session_id: s.string(),
		redirect_uri: s.string(),
		scope: s.nullable(s.string()),
		nonce: s.nullable(s.string()),
		pkce_challenge: s.nullable(s.string()),
		pkce_method: s.nullable(s.enum_(["S256", "plain"])),
		auth_time: s.number(),
		expires_at: s.number(),
		created_at: s.number(),
	},
});
```

Store the challenge and method alongside the authorization code. That gives the token endpoint the exact value it needs to compare when the client submits the verifier.

```ts {% path="app/lib/authorization-code.ts" %}
interface Database {
	create(table: unknown, values: Record<string, unknown>): Promise<void>;
}

interface CreateAuthorizationCodeOptions {
	clientId: string;
	subjectId: string;
	sessionId: string;
	redirectUri: string;
	scope?: string[];
	nonce?: string;
	pkce?: {
		challenge: string;
		method: "S256" | "plain";
	};
}

export async function createAuthorizationCode(db: Database, data: CreateAuthorizationCodeOptions) {
	let code = crypto.randomUUID();
	let now = Date.now();
	let ttl = 10 * 60 * 1000;

	await db.create(authorizationCodeTable, {
		code,
		client_id: data.clientId,
		subject_id: data.subjectId,
		session_id: data.sessionId,
		redirect_uri: data.redirectUri,
		scope: data.scope?.join(" ") ?? null,
		nonce: data.nonce ?? null,
		pkce_challenge: data.pkce?.challenge ?? null,
		pkce_method: data.pkce?.method ?? null,
		auth_time: Math.floor(now / 1000),
		expires_at: now + ttl,
		created_at: now,
	});

	return code;
}
```

When the authorization endpoint issues a code, persist the PKCE values from the request. Public clients should always send them, while confidential clients may still use PKCE for extra protection.

## Validate the Token Request Shape

```ts {% path="app/lib/token-schema.ts" %}
import * as s from "remix/data-schema";

export let AuthorizationCodeSchema = s.object({
	grant_type: s.literal("authorization_code"),
	code: s.string(),
	redirect_uri: s.string(),
	client_id: s.optional(s.string()),
	client_secret: s.optional(s.string()),
	code_verifier: s.optional(s.string()),
});
```

The token endpoint needs `code_verifier` only for authorization code exchanges. Parsing it here keeps the verification logic focused on comparison instead of request shape.

## Require PKCE for Public Clients

```ts {% path="app/routes/authorize.ts" %}
export async function action() {
	// ... previous code

	if (client.type === "public") {
		if (!code_challenge || !code_challenge_method) {
			return redirect(`${redirect_uri}?error=invalid_request&error_description=PKCE+is+required`);
		}
	}

	// ... previous code
}
```

Enforce PKCE before you issue the authorization code. That avoids creating a code that the token endpoint would have to reject later.

## Verify the Verifier Before Issuing Tokens

```ts {% path="app/routes/token.ts" %}
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { validatePKCE } from "~/lib/pkce";
import { AuthorizationCodeSchema } from "~/lib/token-schema";

export async function action({ request }: Route.ActionArgs) {
	let body = Object.fromEntries(await request.formData());
	let result = await validate(body, AuthorizationCodeSchema);

	if (isFailure(result)) {
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { code, redirect_uri, code_verifier } = result.data;
	let authzData = await AuthorizationCode.consume(db, code);

	if (redirect_uri !== authzData.redirectUri) {
		return reject("invalid_grant", "Redirect URI mismatch");
	}

	let client = await Client.show(db, authzData.clientId);
	if (!client) {
		return reject("invalid_client", "Client not found", 401);
	}

	if (client.type === "public" && !authzData.pkce) {
		return reject("invalid_request", "PKCE is required for public clients");
	}

	if (authzData.pkce) {
		if (!code_verifier) {
			return reject("invalid_request", "Missing code_verifier");
		}

		let isValid = await validatePKCE(
			code_verifier,
			authzData.pkce.challenge,
			authzData.pkce.method,
		);

		if (!isValid) {
			return reject("invalid_grant", "PKCE validation failed");
		}
	}

	// ... issue access token, refresh token, and ID token
}
```

This is the actual protection point. The token endpoint only issues tokens if the submitted verifier reproduces the stored challenge.

## Return OAuth Errors for PKCE Failures

```ts {% path="app/lib/oauth-response.ts" %}
export function reject(error: string, description: string, status = 400): Response {
	return new Response(
		JSON.stringify({
			error,
			error_description: description,
		}),
		{
			status,
			headers: {
				"Content-Type": "application/json",
				"Cache-Control": "no-store",
			},
		},
	);
}
```

Use `invalid_request` when the client omits required PKCE parameters. Use `invalid_grant` when the verifier does not match the stored challenge.

## Test the Verification Logic

```ts {% path="app/lib/pkce.test.ts" %}
import { describe, expect, test } from "bun:test";
import { validatePKCE } from "./pkce";

describe("validatePKCE", () => {
	test("accepts a valid S256 verifier", async () => {
		let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
		let challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

		expect(await validatePKCE(verifier, challenge, "S256")).toBe(true);
	});

	test("rejects a mismatched verifier", async () => {
		let verifier = "wrong-verifier";
		let challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

		expect(await validatePKCE(verifier, challenge, "S256")).toBe(false);
	});

	test("accepts the plain method", async () => {
		let verifier = "test-verifier";

		expect(await validatePKCE(verifier, verifier, "plain")).toBe(true);
	});
});
```

These tests cover the behavior that matters most: a valid `S256` exchange, a mismatched verifier, and the fallback `plain` method. If these pass, the token endpoint can rely on the helper doing the correct comparison.

## Final Thoughts

PKCE protects the authorization code flow by binding the token exchange to the client that started it. `S256` provides the strongest default, while `plain` mainly exists for compatibility. You can extend this flow further by enforcing PKCE for every client and adding end to end tests around the full authorization redirect.
