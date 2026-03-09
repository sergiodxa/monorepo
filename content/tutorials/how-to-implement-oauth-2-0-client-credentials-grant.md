---
title: How to Implement OAuth 2.0 Client Credentials Grant
excerpt: Build a token endpoint that issues access tokens to machine clients.
tech: bcryptjs@2.4.3
---

When one service needs to call another, you need a way to authenticate the client itself instead of a user. The OAuth 2.0 client credentials grant solves that with a single token request using a client ID and secret.

In this tutorial, you will add `client_credentials` support to an OAuth token endpoint. By the end, the endpoint will validate machine clients, check scopes, and return a signed bearer token.

## Define the Request Schema

```ts {% path="app/controllers/oauth/token.ts" %}
import * as s from "remix/data-schema";

let ClientCredentialsSchema = s.object({
	grant_type: s.literal("client_credentials"),
	client_id: s.string(),
	client_secret: s.string(),
	scope: s.optional(s.string()),
	resource: s.optional(s.union([s.string(), s.array(s.string())])),
});
```

Start with the request shape. The client must send `grant_type`, `client_id`, and `client_secret`, while `scope` and `resource` stay optional.

## Route the Token Request

```ts {% path="app/controllers/oauth/token.ts" %}
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

// ... previous code

export default action<"POST", "/oauth/token">(async ({ db, formData, request, logger }) => {
	let log = logger.action("/oauth/token");
	let grantType = formData.get("grant_type");
	let basicAuth = parseBasicAuth(request.headers.get("authorization"));
	let body = Object.fromEntries(formData);

	if (basicAuth) {
		body.client_id = basicAuth.clientId;
		body.client_secret = basicAuth.clientSecret;
	}

	if (grantType === "authorization_code") {
		return await handleAuthorizationCode(db, body, log);
	}

	if (grantType === "refresh_token") {
		return await handleRefreshToken(db, body, log);
	}

	if (grantType === "client_credentials") {
		return await handleClientCredentials(db, body, log);
	}

	log.info("Unsupported grant type requested", { grantType: String(grantType) });
	return reject("unsupported_grant_type", "The authorization grant type is not supported");
});
```

The token endpoint now accepts `client_credentials` requests alongside your existing grants. It also supports HTTP Basic authentication, which lets clients send credentials in the `Authorization` header instead of the form body.

## Issue Tokens for Machine Clients

```ts {% path="app/controllers/oauth/token.ts" %}
// ... previous code

async function handleClientCredentials(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Client credentials grant started");

	let result = await validate(body, ClientCredentialsSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "client_credentials" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { client_id, client_secret, scope, resource } = result.data;
	let client = await Client.show(db, client_id);

	if (!client) {
		log.info("Client not found", { clientId: client_id, grantType: "client_credentials" });
		return reject("invalid_client", "Client not found", 401);
	}

	if (client.type !== "m2m") {
		log.info("Unauthorized client type for grant", {
			clientId: client.id,
			clientType: client.type,
			grantType: "client_credentials",
		});
		return reject("unauthorized_client", "Client is not authorized for this grant type");
	}

	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		log.info("Invalid client credentials", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	let requestedScopes = ScopeSet.fromString(scope);
	if (!requestedScopes.isEmpty() && client.allowed_scopes) {
		let allowedScopes = ScopeSet.fromJson(client.allowed_scopes);
		let invalidScopes = requestedScopes.getInvalidScopes(allowedScopes);

		if (invalidScopes.length > 0) {
			log.info("Invalid scopes requested", {
				clientId: client.id,
				invalidScopes,
				grantType: "client_credentials",
			});
			return reject("invalid_scope", `Scopes not allowed: ${invalidScopes.join(", ")}`);
		}
	}

	let [issuer, signingKeys] = await Promise.all([TenantMeta.getIssuer(db), SigningKey.getAll(db)]);

	if (!issuer) {
		log.info("Issuer not configured", { clientId: client.id, grantType: "client_credentials" });
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.info("No signing keys available", { clientId: client.id, grantType: "client_credentials" });
		return reject("server_error", "No signing keys available");
	}

	let resources = Array.isArray(resource) ? resource : resource ? [resource] : [];
	let audience = [`https://${issuer}`, ...resources];
	let scopeArray = requestedScopes.isEmpty() ? undefined : requestedScopes.toArray();
	let accessToken = AccessToken.generate(`https://${issuer}`, audience, client.id, scopeArray);
	let signedAccessToken = await accessToken.sign(JWK.Algoritm.ES256, signingKeys);

	log.info("Token issued successfully", {
		clientId: client.id,
		grantType: "client_credentials",
		scope: scopeArray,
		resourceCount: resources.length,
	});

	return new Response(
		JSON.stringify({
			access_token: signedAccessToken,
			token_type: "Bearer",
			expires_in: AccessToken.ttl,
		}),
		{
			status: 200,
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "application/json",
			},
		},
	);
}
```

This handler does the whole grant. It validates the request, confirms the client is an `m2m` client, checks the secret, validates scopes, and returns a bearer token response.

## Parse and Compare Scopes

```ts {% path="app/values/scope-set.ts" %}
export default class ScopeSet {
	private readonly scopes: Set<string>;

	constructor(scopes: string[] = []) {
		this.scopes = new Set(scopes);
	}

	static fromString(scopeString: string | null | undefined): ScopeSet {
		if (!scopeString) return new ScopeSet();
		return new ScopeSet(scopeString.split(" ").filter(Boolean));
	}

	static fromJson(json: string | null | undefined): ScopeSet {
		if (!json) return new ScopeSet();

		let parsed: unknown = JSON.parse(json);

		if (Array.isArray(parsed) && parsed.every((scope) => typeof scope === "string")) {
			return new ScopeSet(parsed);
		}

		return new ScopeSet();
	}

	isEmpty(): boolean {
		return this.scopes.size === 0;
	}

	toArray(): string[] {
		return Array.from(this.scopes);
	}

	getInvalidScopes(allowedScopes: ScopeSet): string[] {
		return this.toArray().filter((scope) => !allowedScopes.has(scope));
	}

	has(scope: string): boolean {
		return this.scopes.has(scope);
	}
}
```

`scope` arrives as a space separated string, but validation is easier if you treat it as a set. This object keeps parsing and comparison out of the token handler.

## Verify Client Secrets

```ts {% path="app/models/client/secret.ts" %}
import bcrypt from "bcryptjs";

let TIMING_SAFE_DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

export default class Secret {
	static async verify(db: Database, clientId: string, plainSecret: string): Promise<boolean> {
		let secrets = await db.findMany(Secret.table, { where: { client_id: clientId } });
		let now = new Date();
		let validSecrets = secrets.filter((secret) => {
			if (secret.expires_at && new Date(secret.expires_at) < now) {
				return false;
			}

			return true;
		});

		if (validSecrets.length === 0) {
			await bcrypt.compare(plainSecret, TIMING_SAFE_DUMMY_HASH);
			return false;
		}

		let comparisons = await Promise.all(
			validSecrets.map(async (secret) => ({
				id: secret.id,
				isMatch: await bcrypt.compare(plainSecret, secret.secret_hash),
			})),
		);

		let match = comparisons.find((comparison) => comparison.isMatch);

		if (!match) {
			return false;
		}

		await db.update(Secret.table, { id: match.id }, { last_used_at: now.toISOString() });
		return true;
	}
}
```

Store secrets as hashes, not plaintext. The dummy hash check keeps the response time similar even when a client has no active secrets.

## Generate the Access Token

```ts {% path="app/values/access-token.ts" %}
import { JWT } from "@edgefirst-dev/jwt";

let ACCESS_TOKEN_TTL = 60 * 60 * 1000;

export default class AccessToken extends JWT {
	static generate(
		issuer: string,
		audience: string | string[],
		subjectId: string,
		scope?: string[],
	) {
		let now = Math.floor(Date.now() / 1000);
		let expiresAt = now + Math.floor(ACCESS_TOKEN_TTL / 1000);

		return new AccessToken({
			aud: audience,
			exp: expiresAt,
			iat: now,
			iss: issuer,
			jti: crypto.randomUUID(),
			nbf: now,
			sub: subjectId,
			...(scope && { scope: scope.join(" ") }),
		});
	}

	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
```

The token uses the client ID as `sub` because no user participates in this flow. If the request includes `resource`, those values become additional audiences in the JWT.

## Test the Endpoint

```bash {% path="requests/client-credentials-body.sh" %}
curl -X POST https://auth.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=service-account-123" \
  -d "client_secret=sdx_auth_..." \
  -d "scope=read:metrics write:logs"
```

Send the credentials in the form body first. This should return a bearer token and an `expires_in` value.

```json {% path="responses/client-credentials-success.json" %}
{
	"access_token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
	"token_type": "Bearer",
	"expires_in": 3600
}
```

You can also authenticate the client with HTTP Basic.

```bash {% path="requests/client-credentials-basic.sh" %}
curl -X POST https://auth.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(printf 'service-account-123:sdx_auth_...' | base64)" \
  -d "grant_type=client_credentials" \
  -d "scope=read:metrics write:logs"
```

Use the returned token in downstream API calls.

```bash {% path="requests/use-access-token.sh" %}
curl https://api.example.com/metrics \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Final Thoughts

You now have a token endpoint that supports machine to machine authentication with the client credentials grant. You can extend this further by adding secret rotation, rate limiting, and token introspection for resource servers.
