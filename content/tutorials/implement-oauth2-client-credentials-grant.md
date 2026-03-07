---
title: How to Implement OAuth 2.0 Client Credentials Grant
excerpt: Build machine-to-machine authentication for service accounts without user interaction.
tech: bcryptjs@2.0.0
---

When one backend service needs to talk to another, a cron job needs API access, or an automated process needs to perform actions on behalf of itself, you need machine-to-machine authentication. The OAuth 2.0 client credentials grant handles exactly this: a service authenticates directly with its client ID and secret to receive an access token without any user involvement.

Unlike the authorization code flow where a user grants permission through a browser redirect, the client credentials flow is a single POST request. The client sends its credentials, the server validates them, and returns an access token. No redirects, no user consent screens, no browser involved at all. This makes it ideal for microservices communication, scheduled jobs, CLI tools, and IoT devices reporting telemetry.

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

The `grant_type` must be exactly `"client_credentials"`. Both `client_id` and `client_secret` are required since this is how the service authenticates. The `scope` parameter is optional and contains space separated scope strings when the client wants to limit the token's permissions. The `resource` parameter supports RFC 8707, allowing clients to specify which API resources the token will be used with.

## Route Requests by Grant Type

```ts {% path="app/controllers/oauth/token.ts" %}
import { validate } from "@pkg/validate";
import { isFailure } from "@pkg/result";

export default action<"POST", "/oauth/token">(async ({ db, formData, request, logger }) => {
	let log = logger.action("/oauth/token");
	let grantType = formData.get("grant_type");

	let basicAuth = parseBasicAuth(request.headers.get("authorization"));
	let body = Object.fromEntries(formData);

	// Support HTTP Basic authentication for client credentials
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

The token endpoint routes requests based on the grant type. OAuth 2.0 allows clients to send credentials either in the request body or via the `Authorization: Basic` header. The header approach is often preferred as it keeps credentials out of server logs that might capture POST bodies.

## Implement the Client Credentials Handler

```ts {% path="app/controllers/oauth/token.ts" %}
async function handleClientCredentials(db: Database, body: Record<string, unknown>, log: Logger) {
	log.info("Client credentials grant started");

	let result = await validate(body, ClientCredentialsSchema);
	if (isFailure(result)) {
		log.info("Invalid request parameters", { grantType: "client_credentials" });
		return reject("invalid_request", "Missing or invalid parameters");
	}

	let { client_id, client_secret, scope, resource } = result.data;

	// Look up the client
	let client = await Client.show(db, client_id);
	if (!client) {
		log.info("Client not found", { clientId: client_id, grantType: "client_credentials" });
		return reject("invalid_client", "Client not found", 401);
	}

	// Only m2m clients can use this grant type
	if (client.type !== "m2m") {
		log.info("Unauthorized client type for grant", {
			clientId: client.id,
			clientType: client.type,
			grantType: "client_credentials",
		});
		return reject("unauthorized_client", "Client is not authorized for this grant type");
	}

	// Verify the client secret
	let secretValid = await Secret.verify(db, client.id, client_secret);
	if (!secretValid) {
		log.info("Invalid client credentials", {
			clientId: client.id,
			grantType: "client_credentials",
		});
		return reject("invalid_client", "Invalid client credentials", 401);
	}

	// Validate requested scopes
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

	// Get signing configuration
	let [issuer, signingKeys] = await Promise.all([TenantMeta.getIssuer(db), SigningKey.getAll(db)]);

	if (!issuer) {
		log.info("Issuer not configured", { clientId: client.id, grantType: "client_credentials" });
		return reject("server_error", "Issuer not configured");
	}

	if (signingKeys.length === 0) {
		log.info("No signing keys available", { clientId: client.id, grantType: "client_credentials" });
		return reject("server_error", "No signing keys available");
	}

	// Build the audience array from resources
	let resources = Array.isArray(resource) ? resource : resource ? [resource] : [];
	let audience = [`https://${issuer}`, ...resources];
	let scopeArray = requestedScopes.isEmpty() ? undefined : requestedScopes.toArray();

	// Generate and sign the access token
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
			headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
		},
	);
}
```

The handler validates the request, authenticates the client, checks scopes, and issues an access token. The code checks that the client type is `m2m` (machine to machine), preventing public or confidential clients designed for user flows from using this grant. Scopes are validated against the client's allowed scopes before issuing the token.

## Create the ScopeSet Value Object

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
		try {
			let parsed: unknown = JSON.parse(json);
			if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
				return new ScopeSet(parsed as string[]);
			}
		} catch {
			// Invalid JSON, return empty set
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

The `ScopeSet` value object handles scope parsing and validation. The `getInvalidScopes` method compares requested scopes against allowed scopes and returns any that are not permitted, letting you provide a specific error message listing exactly which scopes were rejected.

## Verify Client Secrets Securely

```ts {% path="app/models/client/secret.ts" %}
const TIMING_SAFE_DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W";

static async verify(db: Database, clientId: string, plainSecret: string): Promise<boolean> {
  let secrets = await db.findMany(Secret.table, { where: { client_id: clientId } });
  let now = new Date();

  // Filter out expired secrets
  let validSecrets = secrets.filter((secret) => {
    if (secret.expires_at && new Date(secret.expires_at) < now) {
      return false;
    }
    return true;
  });

  // Timing attack prevention: always perform bcrypt comparison
  if (validSecrets.length === 0) {
    await bcrypt.compare(plainSecret, TIMING_SAFE_DUMMY_HASH);
    return false;
  }

  // Compare against all valid secrets in parallel
  let comparisons = await Promise.all(
    validSecrets.map(async (secret) => ({
      id: secret.id,
      isMatch: await bcrypt.compare(plainSecret, secret.secret_hash),
    })),
  );

  let match = comparisons.find((c) => c.isMatch);

  if (match) {
    // Track last usage for auditing
    await db.update(Secret.table, { id: match.id }, { last_used_at: now.toISOString() });
    return true;
  }

  return false;
}
```

Client secrets should be stored as bcrypt hashes, not plain text. The dummy hash comparison when no secrets exist ensures that an attacker cannot detect whether a client has any secrets by measuring response times. Comparing all secrets in parallel similarly prevents timing attacks that could reveal which position in the list contains the valid secret.

## Generate Access Tokens

```ts {% path="app/values/access-token.ts" %}
import { JWT } from "@edgefirst-dev/jwt";

const ACCESS_TOKEN_TTL = 60 * 60 * 1000; // 1 hour

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

The access token is a JWT containing standard claims plus optional scopes. For client credentials, the `sub` (subject) claim contains the client ID since there is no user. The `aud` (audience) claim contains the issuer URL plus any resource URIs the client specified, allowing resource servers to verify the token was intended for them.

## Return the Proper Response

The response format follows RFC 6749:

```json
{
	"access_token": "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...",
	"token_type": "Bearer",
	"expires_in": 3600
}
```

There is no `refresh_token`. Client credentials grants do not issue refresh tokens because the client can simply reauthenticate with its credentials whenever it needs a new token. Including a refresh token would add complexity without any benefit.

The `Cache-Control: no-store` header is required by the OAuth 2.0 specification to prevent tokens from being cached by proxies or browsers.

## Test the Client Credentials Flow

Clients authenticate with a simple POST request:

```bash
curl -X POST https://auth.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=service-account-123" \
  -d "client_secret=sdx_auth_..." \
  -d "scope=read:metrics write:logs"
```

Or using HTTP Basic authentication:

```bash
curl -X POST https://auth.example.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n 'service-account-123:sdx_auth_...' | base64)" \
  -d "grant_type=client_credentials" \
  -d "scope=read:metrics write:logs"
```

The client then includes the access token in API requests:

```bash
curl https://api.example.com/metrics \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Final Thoughts

A few security details matter here. Always use HTTPS since client secrets sent over HTTP can be intercepted. Keep token lifetimes short: one hour is reasonable for most use cases and clients can request new tokens as needed. Implement rate limiting on the token endpoint to prevent brute force attacks against client secrets.

Consider implementing client secret rotation. Allow clients to have multiple active secrets so they can rotate without downtime. Track `last_used_at` to identify and clean up stale secrets.

Finally, log all authentication attempts, both successful and failed. Include the client ID but never log the actual secret values. These logs are essential for detecting credential stuffing attacks and debugging integration issues.

For validating the tokens your services receive, see [How to Implement OAuth 2.0 Token Introspection](/tutorials/implement-oauth2-token-introspection). For the complete picture of building an OAuth provider, check out [How to Build an OAuth2/OIDC Provider from Scratch](/tutorials/build-an-oauth2-oidc-provider-from-scratch).
