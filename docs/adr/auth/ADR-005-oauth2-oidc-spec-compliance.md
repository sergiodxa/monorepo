# ADR-005: OAuth 2.0 and OpenID Connect Specification Compliance

## Status

**Accepted** - 2026-02-25

## Context

The auth server (`apps/auth`) advertises itself as an OAuth 2.0 Authorization Server and OpenID Connect Provider through its discovery document at `/.well-known/oauth-authorization-server`. However, a comprehensive review against the relevant specifications reveals several gaps between what is advertised and what is actually implemented.

The discovery document currently advertises endpoints that don't exist (revocation, introspection, userinfo, registration) and response types that aren't implemented (implicit grant). This violates OIDC Discovery 1.0 which states that advertised endpoints MUST be functional. This ADR documents the implementation status of all relevant OAuth 2.0 and OpenID Connect specifications and outlines the required changes to achieve full compliance.

The goal is to systematically address each specification gap, prioritizing core functionality and security improvements, while providing a clear roadmap for implementation.

---

## Specifications

### OAuth 2.0 Core Specifications

#### RFC 6749 - OAuth 2.0 Authorization Framework

The foundational OAuth 2.0 specification defining the authorization framework, grant types, and core protocol flows. It establishes the roles (resource owner, client, authorization server, resource server) and defines the authorization code, implicit, resource owner password credentials, and client credentials grant types.

**Reference:** https://datatracker.ietf.org/doc/html/rfc6749

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Authorization Code Grant (`app/routes/authorize.tsx`, `app/routes/oauth.token.ts`)
- Client Credentials Grant (`app/routes/oauth.token.ts`)
- Refresh Token Grant (`app/routes/oauth.token.ts`)
- Error responses with `error` and `error_description`

**What's Missing:**

- Authorization code lifetime exceeds recommended 10 minutes (currently uses ACCESS_TOKEN_TTL of 1 hour)
- Scope validation against `scopes_supported`
- Implicit Grant advertised but not implemented (should be removed per RFC 9700)

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/authz-code.ts`
- `app/config.ts`

**Required Changes:**

1. Change authorization code TTL from `ACCESS_TOKEN_TTL` to 10 minutes max:

```typescript
// app/config.ts
export const AUTHZ_CODE_TTL = ms("10 minutes");
```

2. Add scope validation in `app/routes/authorize.tsx`:
   - Validate `scope` parameter against `scopes_supported`
   - Store granted scopes with authorization code
   - Filter ID Token and UserInfo claims based on granted scopes

3. Remove `"token"` from `response_types_supported` in `app/config.ts`

---

#### RFC 6750 - Bearer Token Usage

Defines how to use Bearer tokens in HTTP requests and the `WWW-Authenticate` response header format for protected resources. This specification is essential for resource servers to properly communicate authentication requirements and errors to clients.

**Reference:** https://datatracker.ietf.org/doc/html/rfc6750

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Bearer tokens issued as JWTs
- `Authorization: Bearer` header accepted

**What's Missing:**

- `WWW-Authenticate` header with proper error codes on 401/403 responses
- `Cache-Control: no-store` and `Pragma: no-cache` headers on token responses

**Relevant Files:**

- `app/routes/oauth.token.ts`
- `app/routes/userinfo.ts` (to be created)

**Required Changes:**

1. Add cache headers to token endpoint responses in `app/routes/oauth.token.ts`:

```typescript
return json(tokenResponse, {
	headers: {
		"Cache-Control": "no-store",
		Pragma: "no-cache",
	},
});
```

2. Return proper `WWW-Authenticate: Bearer` headers on protected endpoints:

```typescript
// 401 Unauthorized - missing or invalid token
return new Response(null, {
	status: 401,
	headers: {
		"WWW-Authenticate": 'Bearer realm="auth.example.com"',
	},
});

// 401 Unauthorized - expired token
return new Response(null, {
	status: 401,
	headers: {
		"WWW-Authenticate":
			'Bearer realm="auth.example.com", error="invalid_token", error_description="The access token expired"',
	},
});

// 403 Forbidden - insufficient scope
return new Response(null, {
	status: 403,
	headers: {
		"WWW-Authenticate":
			'Bearer realm="auth.example.com", error="insufficient_scope", scope="openid email"',
	},
});
```

---

#### RFC 6755 - IETF URN Sub-Namespace for OAuth

Defines the `urn:ietf:params:oauth:` URN namespace for OAuth-related identifiers (grant types, token types, etc.). This is a namespace registration specification used implicitly when referencing grant types like `urn:ietf:params:oauth:grant-type:device_code`.

**Reference:** https://datatracker.ietf.org/doc/html/rfc6755

**Status:** ✅ Reference Only

**Required Changes:** None

---

#### RFC 6819 - OAuth 2.0 Threat Model and Security Considerations

Comprehensive threat model and security considerations for OAuth 2.0 deployments. This specification has been superseded by RFC 9700 for best practices but provides valuable background threat analysis.

**Reference:** https://datatracker.ietf.org/doc/html/rfc6819

**Status:** ✅ Reference Only

**Required Changes:** None (reference document - use RFC 9700 for current best practices)

---

#### RFC 7636 - Proof Key for Code Exchange (PKCE)

Extension to prevent authorization code interception attacks by using a code verifier and challenge. PKCE is now mandatory for public clients and recommended for all clients per RFC 9700 (OAuth 2.0 Security BCP).

**Reference:** https://datatracker.ietf.org/doc/html/rfc7636

**Status:** ✅ Implemented

**What's Implemented:**

- `code_challenge` and `code_challenge_method` parameters accepted
- S256 and plain methods supported
- Code verifier validation in token endpoint

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/authz-code.ts`
- `app/modules/oauth2.ts` (CodeChallenge class)

**Required Changes:** None

---

#### RFC 8252 - OAuth 2.0 for Native Apps (BCP 212)

Best Current Practice for implementing OAuth in native applications, recommending custom URL schemes and claimed HTTPS URLs. This is primarily client-side guidance, but the authorization server should support the patterns recommended for native apps.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8252

**Status:** ✅ Guidance Document

**Relevant Files:**

- `app/routes/authorize.tsx` (redirect URI validation)

**Required Changes:**

Ensure localhost/loopback redirect URIs are allowed for native app development:

- Support `http://localhost` and `http://127.0.0.1` redirect URIs
- Support custom URI schemes as redirect URIs

---

#### RFC 8414 - OAuth 2.0 Authorization Server Metadata

Defines the `/.well-known/oauth-authorization-server` endpoint for publishing authorization server capabilities. Clients and resource servers use this metadata to dynamically configure themselves.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8414

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Metadata endpoint exists at `/.well-known/oauth-authorization-server`
- Most required fields present

**What's Missing:**

- `grant_types_supported` field not advertised
- Advertises non-existent endpoints (revoke, introspect, userinfo, register)
- Advertises `"token"` response type which isn't implemented

**Relevant Files:**

- `app/config.ts`
- `app/routes/[.]well-known.oauth-authorization-server.ts`

**Required Changes:**

1. Add `grant_types_supported` to discovery:

```typescript
grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
```

2. Remove endpoints that aren't implemented OR implement them:
   - `revocation_endpoint` - implement or remove
   - `introspection_endpoint` - implement or remove
   - `userinfo_endpoint` - implement or remove
   - `registration_endpoint` - implement or remove

3. Remove `"token"` from `response_types_supported`

---

### OAuth 2.0 Extension Specifications

#### RFC 7009 - OAuth 2.0 Token Revocation

Defines an endpoint for clients to notify the authorization server that a token is no longer needed and should be invalidated. This is essential for proper logout flows and security hygiene when tokens may have been compromised.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7009

**Status:** ❌ Not Implemented (but advertised)

**What's Missing:**

- POST `/oauth/revoke` endpoint
- Accept `token` and `token_type_hint` parameters
- Client authentication via `client_secret_basic`
- Return 200 OK even for invalid/unknown tokens (prevents token probing)

**Relevant Files:**

- `app/routes/oauth.revoke.ts` (to be created)
- `app/modules/oauth2.ts` (`OAuth2Provider.revoke()` method exists but incomplete)
- `app/config.ts`

**Required Changes:**

1. Create `app/routes/oauth.revoke.ts` route handler:

```typescript
// POST /oauth/revoke
export async function action({ request, context }: Route.ActionArgs) {
	// Authenticate client (client_secret_basic or client_secret_post)
	const client = await authenticateClient(request);
	if (!client) {
		return json({ error: "invalid_client" }, { status: 401 });
	}

	const formData = await request.formData();
	const token = formData.get("token");
	const tokenTypeHint = formData.get("token_type_hint"); // "access_token" or "refresh_token"

	if (!token) {
		return json({ error: "invalid_request" }, { status: 400 });
	}

	// For refresh tokens (session IDs): delete session from database
	// For access tokens (JWTs): cannot truly revoke, but return 200 OK
	await revokeToken(token, tokenTypeHint);

	// Always return 200 OK (even for invalid tokens - prevents probing)
	return new Response(null, { status: 200 });
}
```

2. Complete `OAuth2Provider.revoke()` implementation in `app/modules/oauth2.ts`

---

#### RFC 7521 - Assertion Framework for OAuth 2.0

Abstract framework for using assertions (like SAML or JWT) as authorization grants or client authentication. This is the base framework that RFC 7522 (SAML) and RFC 7523 (JWT) build upon.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7521

**Status:** ❌ Not Implemented

**Required Changes:** Implement RFC 7523 for JWT-based client authentication if needed.

---

#### RFC 7522 - SAML 2.0 Profile for OAuth 2.0

Defines using SAML 2.0 assertions for OAuth client authentication and authorization grants. Only implement if SAML federation is required.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7522

**Status:** ❌ Not Implemented

**Required Changes:** None unless SAML support is needed.

---

#### RFC 7523 - JWT Profile for OAuth 2.0 Client Authentication

Allows clients to authenticate using signed JWTs instead of client secrets (`private_key_jwt` method). This is more secure than shared secrets and is required for some high-security profiles like FAPI.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7523

**Status:** ❌ Not Implemented

**What's Missing:**

- Support `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`
- Support `client_assertion` parameter containing signed JWT
- Validate JWT signature against client's registered public key
- Add `private_key_jwt` to `token_endpoint_auth_methods_supported`

**Relevant Files:**

- `app/routes/oauth.token.ts`
- `app/config.ts`
- `db/schema.ts` (store client public keys)

**Required Changes:**

1. Add `jwks_uri` or `jwks` field to clients table in `db/schema.ts`

2. Implement JWT assertion validation in token endpoint:

```typescript
// In app/routes/oauth.token.ts
if (clientAssertionType === "urn:ietf:params:oauth:client-assertion-type:jwt-bearer") {
	const client = await validateJwtAssertion(clientAssertion);
	// Verify signature against client's registered public key
	// Verify iss === client_id
	// Verify aud === token_endpoint
	// Verify exp and iat
}
```

3. Update discovery metadata:

```typescript
token_endpoint_auth_methods_supported: [
	"client_secret_basic",
	"client_secret_post",
	"private_key_jwt",
],
```

---

#### RFC 7591 - OAuth 2.0 Dynamic Client Registration

Defines an endpoint for clients to register themselves programmatically without manual intervention. Currently `registration_endpoint` is advertised in discovery but not implemented.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7591

**Status:** ❌ Not Implemented (but advertised)

**Relevant Files:**

- `app/routes/oidc.register.ts` (to be created)
- `app/config.ts`

**Required Changes:**

Either implement `/oidc/register` endpoint OR remove `registration_endpoint` from discovery document.

---

#### RFC 7592 - OAuth 2.0 Dynamic Client Registration Management

Extends RFC 7591 with endpoints for reading, updating, and deleting dynamically registered clients. Only relevant if RFC 7591 is implemented.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7592

**Status:** ❌ Not Implemented

**Required Changes:** None unless dynamic registration is implemented.

---

#### RFC 7662 - OAuth 2.0 Token Introspection

Defines an endpoint for resource servers to query token metadata and validity. Essential for resource servers that cannot validate tokens locally (e.g., opaque tokens) or need additional token metadata.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7662

**Status:** ❌ Not Implemented (but advertised)

**What's Missing:**

- POST `/oauth/introspect` endpoint
- Accept `token` and `token_type_hint` parameters
- Client authentication for the requesting resource server
- Return `{ active: true, sub, client_id, scope, exp, iat, iss, aud }` for valid tokens
- Return `{ active: false }` for invalid/expired tokens (never reveal why)

**Relevant Files:**

- `app/routes/oauth.introspect.ts` (to be created)
- `app/modules/oauth2.ts` (`OAuth2Provider.introspect()` throws "not implemented yet")
- `app/config.ts`

**Required Changes:**

1. Create `app/routes/oauth.introspect.ts` route handler:

```typescript
// POST /oauth/introspect
export async function action({ request, context }: Route.ActionArgs) {
	// Authenticate requesting client/resource server
	const client = await authenticateClient(request);
	if (!client) {
		return json({ error: "invalid_client" }, { status: 401 });
	}

	const formData = await request.formData();
	const token = formData.get("token");
	const tokenTypeHint = formData.get("token_type_hint");

	if (!token) {
		return json({ error: "invalid_request" }, { status: 400 });
	}

	// For JWT access tokens: decode and validate, return claims
	// For refresh tokens (session IDs): look up session in database
	const introspection = await introspectToken(token, tokenTypeHint);

	if (!introspection.active) {
		return json({ active: false });
	}

	return json({
		active: true,
		sub: introspection.sub,
		client_id: introspection.clientId,
		scope: introspection.scope,
		exp: introspection.exp,
		iat: introspection.iat,
		iss: introspection.iss,
		aud: introspection.aud,
	});
}
```

2. Implement `OAuth2Provider.introspect()` method in `app/modules/oauth2.ts`

---

#### RFC 7800 - Proof-of-Possession Key Semantics for JWTs

Defines the `cnf` (confirmation) claim for binding tokens to cryptographic keys. Used by DPoP (RFC 9449) and mTLS (RFC 8705) for proof-of-possession tokens.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7800

**Status:** ❌ Not Implemented

**Required Changes:** None unless DPoP or mTLS is implemented.

---

#### RFC 8176 - Authentication Method Reference Values

Defines standard values for the `amr` (Authentication Methods References) claim in ID tokens. Values like `pwd` (password), `otp`, `mfa`, `hwk` (hardware key) indicate how the user authenticated.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8176

**Status:** ❌ Not Implemented

**What's Missing:**

- Track authentication method during login
- Include `amr` claim in ID tokens with appropriate values

**Relevant Files:**

- `app/entities/id-token.ts`

**Required Changes:**

1. Track authentication method during login flow
2. Include `amr` claim in ID tokens:

```typescript
// In app/entities/id-token.ts
amr: ["pwd"], // or ["pwd", "otp"] for MFA, ["hwk"] for hardware key, etc.
```

---

#### RFC 8628 - Device Authorization Grant

Enables authorization on devices with limited input capabilities (TVs, CLIs, IoT) using a user code. The user visits a verification URL on a separate device and enters the code to authorize.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8628

**Status:** ❌ Not Implemented

**What's Missing:**

- POST `/oauth/device` endpoint returning `device_code`, `user_code`, `verification_uri`
- User verification page at `verification_uri`
- Token endpoint support for `grant_type=urn:ietf:params:oauth:grant-type:device_code`
- Polling with `authorization_pending`, `slow_down`, `expired_token` errors

**Relevant Files:**

- `app/routes/oauth.device.ts` (to be created)
- `app/routes/device.tsx` (to be created)
- `app/routes/oauth.token.ts`
- `app/config.ts`

**Required Changes:**

1. Create device authorization endpoint `app/routes/oauth.device.ts`:

```typescript
// POST /oauth/device
export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const clientId = formData.get("client_id");
	const scope = formData.get("scope");

	// Generate device_code (long, unguessable) and user_code (short, user-friendly)
	const deviceCode = generateSecureRandom();
	const userCode = generateUserCode(); // e.g., "ABCD-1234"

	// Store in KV with expiration
	await kv.put(`device:${deviceCode}`, JSON.stringify({ clientId, scope, userCode }), {
		expirationTtl: 600, // 10 minutes
	});

	return json({
		device_code: deviceCode,
		user_code: userCode,
		verification_uri: "https://auth.example.com/device",
		verification_uri_complete: `https://auth.example.com/device?user_code=${userCode}`,
		expires_in: 600,
		interval: 5,
	});
}
```

2. Create user verification page `app/routes/device.tsx`

3. Add device code grant type to token endpoint

4. Add `device_authorization_endpoint` to discovery

---

#### RFC 8693 - OAuth 2.0 Token Exchange

Enables exchanging one token for another, useful for delegation and impersonation scenarios. Complex feature for service-to-service communication and identity federation.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8693

**Status:** ❌ Not Implemented

**Required Changes:** None unless token exchange/delegation is required.

---

#### RFC 8705 - Mutual-TLS Client Authentication and Certificate-Bound Access Tokens

Client authentication using TLS client certificates and binding access tokens to certificates. Requires TLS termination that exposes client certificates, which is complex on Cloudflare Workers.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8705

**Status:** ❌ Not Implemented

**Required Changes:** None (infrastructure limitation on Cloudflare Workers).

---

#### RFC 8707 - Resource Indicators for OAuth 2.0

Allows clients to specify the intended resource server(s) for the requested token using the `resource` parameter. This enables audience restriction and multi-tenant scenarios.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8707

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- `resource` parameter accepted in client credentials grant

**What's Missing:**

- `resource` parameter support in authorization request
- `resource` parameter support in token request for other grant types
- Audience restriction based on resource parameter

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/access-token.ts`

**Required Changes:**

1. Accept `resource` parameter in authorization requests
2. Store resource with authorization code
3. Set access token `aud` claim based on resource parameter

---

#### RFC 9068 - JWT Profile for OAuth 2.0 Access Tokens

Standardizes JWT access token format with required claims and header parameters. Ensures interoperability between authorization servers and resource servers.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9068

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- Access tokens are JWTs with `iss`, `sub`, `aud`, `exp`, `iat` claims
- ES256 signing

**What's Missing:**

- `client_id` claim (REQUIRED)
- `jti` claim (REQUIRED for replay protection)
- `typ: "at+jwt"` header parameter (REQUIRED)

**Relevant Files:**

- `app/entities/access-token.ts`

**Required Changes:**

1. Add required claims and header in `app/entities/access-token.ts`:

```typescript
// Header
{
  alg: "ES256",
  typ: "at+jwt",  // REQUIRED by RFC 9068
}

// Payload
{
  iss: issuer,
  sub: subject,
  aud: audience,
  exp: expiration,
  iat: issuedAt,
  client_id: clientId,  // REQUIRED by RFC 9068
  jti: generateUUID(),  // REQUIRED by RFC 9068
  scope: scope,
}
```

---

#### RFC 9101 - JWT-Secured Authorization Request (JAR)

Allows authorization request parameters to be sent as a signed/encrypted JWT for integrity and confidentiality. Discovery already indicates this is not supported.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9101

**Status:** ❌ Not Implemented

**Required Changes:** None unless JAR support is needed. Discovery correctly advertises `request_parameter_supported: false` and `request_uri_parameter_supported: false`.

---

#### RFC 9126 - Pushed Authorization Requests (PAR)

Clients push authorization parameters to the AS before redirect, receiving a `request_uri` to use in the authorization request. This improves security by keeping sensitive parameters off the front channel.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9126

**Status:** ❌ Not Implemented

**What's Missing:**

- POST `/oauth/par` endpoint
- Accept all authorization request parameters
- Return `{ request_uri: "urn:ietf:params:oauth:request_uri:...", expires_in: 60 }`
- Accept `request_uri` parameter in authorization endpoint
- Store PAR data in KV with expiration

**Relevant Files:**

- `app/routes/oauth.par.ts` (to be created)
- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Create PAR endpoint `app/routes/oauth.par.ts`:

```typescript
// POST /oauth/par
export async function action({ request, context }: Route.ActionArgs) {
	// Authenticate client
	const client = await authenticateClient(request);
	if (!client) {
		return json({ error: "invalid_client" }, { status: 401 });
	}

	const formData = await request.formData();
	const params = {
		response_type: formData.get("response_type"),
		client_id: formData.get("client_id"),
		redirect_uri: formData.get("redirect_uri"),
		scope: formData.get("scope"),
		state: formData.get("state"),
		code_challenge: formData.get("code_challenge"),
		code_challenge_method: formData.get("code_challenge_method"),
		// ... other params
	};

	// Validate parameters
	// ...

	// Store in KV with short expiration
	const requestUri = `urn:ietf:params:oauth:request_uri:${generateSecureRandom()}`;
	await kv.put(`par:${requestUri}`, JSON.stringify(params), { expirationTtl: 60 });

	return json({
		request_uri: requestUri,
		expires_in: 60,
	});
}
```

2. Modify authorization endpoint to accept `request_uri` parameter

3. Add to discovery:

```typescript
pushed_authorization_request_endpoint: "/oauth/par",
require_pushed_authorization_requests: false,
```

---

#### RFC 9207 - Authorization Server Issuer Identification

Includes `iss` parameter in authorization responses to prevent mix-up attacks where a malicious AS redirects to a legitimate client.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9207

**Status:** ❌ Not Implemented

**What's Missing:**

- Include `iss` parameter in authorization response redirects
- Add `authorization_response_iss_parameter_supported: true` to discovery

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Add `iss` parameter to authorization response in `app/routes/authorize.tsx`:

```typescript
// Redirect with iss parameter
const redirectUrl = new URL(redirectUri);
redirectUrl.searchParams.set("code", code);
redirectUrl.searchParams.set("state", state);
redirectUrl.searchParams.set("iss", issuer); // Add this
return redirect(redirectUrl.toString());
```

2. Update discovery metadata:

```typescript
authorization_response_iss_parameter_supported: true,
```

---

#### RFC 9278 - JWK Thumbprint URI

Defines `urn:ietf:params:oauth:jwk-thumbprint:` URI for referencing keys by their thumbprint. Used when referencing keys in DPoP or other contexts.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9278

**Status:** ✅ Reference Only

**Required Changes:** None

---

#### RFC 9396 - OAuth 2.0 Rich Authorization Requests (RAR)

Enables fine-grained authorization using structured `authorization_details` parameter instead of simple scopes. Useful for complex authorization scenarios like banking and healthcare.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9396

**Status:** ❌ Not Implemented

**Required Changes:** None unless fine-grained authorization is needed.

---

#### RFC 9449 - Demonstrating Proof of Possession (DPoP)

Binds access tokens to a client's key pair, preventing token theft and replay. High-security feature for applications requiring proof-of-possession.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9449

**Status:** ❌ Not Implemented

**Required Changes:** None unless DPoP is needed.

---

#### RFC 9470 - Step Up Authentication Challenge Protocol

Allows resource servers to challenge for stronger authentication using `insufficient_user_authentication` error. Enables step-up authentication flows for sensitive operations.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9470

**Status:** ❌ Not Implemented

**What's Missing:**

- Support `acr_values` and `max_age` in authorization requests
- Include `acr` and `auth_time` claims in access tokens and introspection
- Resource servers can return `WWW-Authenticate: Bearer error="insufficient_user_authentication", acr_values="...", max_age="..."`

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/entities/access-token.ts`
- `app/routes/oauth.introspect.ts`

**Required Changes:**

1. Accept and process `acr_values` and `max_age` parameters in authorization requests
2. Track `auth_time` in sessions
3. Include `acr` and `auth_time` in tokens

---

#### RFC 9701 - JWT Response for OAuth Token Introspection

Allows introspection responses to be returned as signed/encrypted JWTs instead of plain JSON. Implement after basic introspection (RFC 7662) is working.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9701

**Status:** ❌ Not Implemented

**Required Changes:** None until basic introspection is implemented.

---

#### RFC 9728 - OAuth 2.0 Protected Resource Metadata

Defines `/.well-known/oauth-protected-resource` for resource servers to publish their metadata. This is for resource servers, not authorization servers.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9728

**Status:** ❌ Not Applicable

**Required Changes:** None

---

### JWT Specifications

#### RFC 7515 - JSON Web Signature (JWS)

Defines the structure and processing of signed JWTs. Used via `@edgefirst-dev/jwt` library for signing ID tokens and access tokens.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7515

**Status:** ✅ Implemented

**Required Changes:** None

---

#### RFC 7516 - JSON Web Encryption (JWE)

Defines the structure and processing of encrypted JWTs. Only needed if token encryption is required.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7516

**Status:** ❌ Not Implemented

**Required Changes:** None unless encryption is needed.

---

#### RFC 7517 - JSON Web Key (JWK)

Defines the JSON format for representing cryptographic keys. JWKS endpoint at `/.well-known/jwks.json` publishes the ES256 key pair.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7517

**Status:** ✅ Implemented

**Relevant Files:**

- `app/routes/[.]well-known.jwks[.]json.ts`
- `app/modules/jwks.ts`

**Required Changes:** None

---

#### RFC 7518 - JSON Web Algorithms (JWA)

Defines cryptographic algorithms for JWS, JWE, and JWK. ES256 algorithm used for signing, provided by `@edgefirst-dev/jwt`.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7518

**Status:** ✅ Implemented

**Required Changes:** None

---

#### RFC 7519 - JSON Web Token (JWT)

Defines the JWT format and standard claims. ID tokens and access tokens are JWTs with standard claims.

**Reference:** https://datatracker.ietf.org/doc/html/rfc7519

**Status:** ✅ Implemented

**Required Changes:** None

---

#### RFC 8725 - JWT Best Current Practices

Security recommendations for JWT implementations. Key recommendations include validating `alg` header, validating `iss` and `aud` claims, using short expiration times, and never using `none` algorithm.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8725

**Status:** ✅ Guidance Document (Compliant)

**Required Changes:** Ensure all JWT validation follows BCP recommendations (already implemented).

---

#### RFC 9901 - Selective Disclosure for JWTs (SD-JWT)

Allows selective disclosure of JWT claims for privacy-preserving credential presentation. Emerging standard for verifiable credentials.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9901

**Status:** ❌ Not Implemented

**Required Changes:** None unless SD-JWT support is needed.

---

### Security Best Practices

#### RFC 9700 - OAuth 2.0 Security Best Current Practice (BCP 240)

Comprehensive security recommendations for OAuth 2.0 implementations, superseding RFC 6819. This is the authoritative reference for OAuth 2.0 security best practices and should be followed for all implementations.

**Reference:** https://datatracker.ietf.org/doc/html/rfc9700

**Status:** ⚠️ Partially Compliant

| Requirement                       | Status | Notes                                                  |
| --------------------------------- | ------ | ------------------------------------------------------ |
| PKCE required for public clients  | ✅     | Implemented                                            |
| Implicit grant deprecated         | ⚠️     | Advertised but not implemented - remove from discovery |
| Exact redirect URI matching       | ✅     | Implemented                                            |
| Authorization code one-time use   | ✅     | Code deleted after exchange                            |
| Short authorization code lifetime | ✅     | Reduced to 10 minutes                                  |
| Refresh token rotation            | ❌     | Not implemented                                        |
| Rate limiting                     | ✅     | Via Workers Rate Limiting bindings                     |
| Client secret hashing             | ❌     | Stored as plain UUID                                   |

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/entities/authz-code.ts`
- `app/modules/oauth2.ts`
- `db/schema.ts`

**Required Changes:**

1. **Reduce authorization code TTL to 10 minutes:**

```typescript
// app/config.ts
export const AUTHZ_CODE_TTL = ms("10 minutes");
```

2. **Implement refresh token rotation in `app/modules/oauth2.ts`:**

```typescript
// In refreshTokenGrant
async function refreshTokenGrant(refreshToken: string) {
	const session = await validateRefreshToken(refreshToken);

	// Issue new refresh token
	const newRefreshToken = generateNewRefreshToken();

	// Invalidate old refresh token (detect reuse = possible theft)
	await invalidateRefreshToken(refreshToken);

	// Store new refresh token
	await storeRefreshToken(newRefreshToken, session.userId);

	return {
		access_token: newAccessToken,
		refresh_token: newRefreshToken,
		// ...
	};
}
```

3. **Rate limiting via Cloudflare Workers Rate Limiting bindings:**

Rate limiting uses [Workers Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
configured in `wrangler.jsonc`. Each endpoint has its own rate limiter with appropriate limits.
See `apps/auth/README.md` for the rate limiting configuration.

4. **Hash client secrets with bcrypt** (see client secrets refactoring in Migration Notes)

---

### OpenID Connect Core Specifications

#### OIDC Core 1.0

Core OpenID Connect specification defining authentication on top of OAuth 2.0. Adds ID Tokens, UserInfo endpoint, and standard claims for identity information.

**Reference:** https://openid.net/specs/openid-connect-core-1_0.html

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- ID Token issuance with required claims (`iss`, `sub`, `aud`, `exp`, `iat`)
- Authorization code flow with OIDC
- `openid` scope handling

**What's Missing:**

- UserInfo endpoint (advertised but not implemented)
- `nonce` parameter support
- `auth_time` claim
- `acr` claim
- Standard scopes (`profile`, `email`, `address`, `phone`) claim mapping

**Relevant Files:**

- `app/routes/authorize.tsx`
- `app/routes/oauth.token.ts`
- `app/routes/userinfo.ts` (to be created)
- `app/entities/id-token.ts`
- `app/modules/oauth2.ts`

**Required Changes:**

1. **Create `/userinfo` endpoint (`app/routes/userinfo.ts`):**

```typescript
// GET /userinfo
export async function loader({ request, context }: Route.LoaderArgs) {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return new Response(null, {
			status: 401,
			headers: { "WWW-Authenticate": 'Bearer realm="auth"' },
		});
	}

	const token = authHeader.slice(7);
	const claims = await validateAccessToken(token);

	if (!claims) {
		return new Response(null, {
			status: 401,
			headers: {
				"WWW-Authenticate": 'Bearer error="invalid_token"',
			},
		});
	}

	// Return claims based on granted scopes
	const response: Record<string, unknown> = { sub: claims.sub };

	if (claims.scope.includes("email")) {
		response.email = claims.email;
		response.email_verified = claims.email_verified;
	}

	if (claims.scope.includes("profile")) {
		response.name = claims.name;
		response.preferred_username = claims.preferred_username;
		response.picture = claims.picture;
	}

	return json(response);
}
```

2. **Add `nonce` support:**

```typescript
// In app/routes/authorize.tsx - accept nonce parameter
const nonce = url.searchParams.get("nonce");

// Store nonce with authorization code
// In app/entities/authz-code.ts

// Include nonce in ID token
// In app/entities/id-token.ts
{
  // ... other claims
  nonce: authzCode.nonce, // Echo back from authorization request
}
```

3. **Track and include `auth_time` in ID tokens:**

```typescript
// In app/entities/session.ts - track auth_time when session created
auth_time: (Math.floor(Date.now() / 1000),
	// In app/entities/id-token.ts
	{
		// ... other claims
		auth_time: session.auth_time,
	});
```

4. **Implement scope-based claim filtering:**

```typescript
// openid: sub, iss, aud, exp, iat (required)
// email: email, email_verified
// profile: name, preferred_username, picture
```

---

#### OIDC Discovery 1.0

Defines `/.well-known/openid-configuration` for OIDC Provider metadata discovery. OIDC clients expect this endpoint in addition to the OAuth AS metadata endpoint.

**Reference:** https://openid.net/specs/openid-connect-discovery-1_0.html

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- OAuth AS metadata at `/.well-known/oauth-authorization-server`

**What's Missing:**

- OIDC-specific endpoint at `/.well-known/openid-configuration`

**Relevant Files:**

- `app/routes/[.]well-known.openid-configuration.ts` (to be created)
- `app/config.ts`

**Required Changes:**

Create `/.well-known/openid-configuration` endpoint (can return same content as OAuth AS metadata):

```typescript
// app/routes/[.]well-known.openid-configuration.ts
export async function loader({ context }: Route.LoaderArgs) {
	return json(getDiscoveryDocument(context));
}
```

---

#### OIDC Dynamic Registration 1.0

Extends RFC 7591 with OIDC-specific client metadata. `registration_endpoint` is advertised but not implemented.

**Reference:** https://openid.net/specs/openid-connect-registration-1_0.html

**Status:** ❌ Not Implemented (but advertised)

**Required Changes:** See RFC 7591 section - either implement or remove from discovery.

---

#### OAuth 2.0 Multiple Response Types

Defines additional response types like `code token`, `code id_token`, `id_token token`, etc. for hybrid flows.

**Reference:** https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless hybrid flows are needed.

---

#### OAuth 2.0 Form Post Response Mode

Returns authorization response via HTTP POST using auto-submitting form. Useful when URL length limits are a concern or for security reasons.

**Reference:** https://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html

**Status:** ✅ Implemented

**What's Implemented:**

- Accept `response_mode=form_post` parameter in authorization endpoint
- Store `responseMode` in session for use after login
- Return HTML page with auto-submitting form via `formPostResponse()` utility
- Proper HTML escaping to prevent XSS
- Support in SSO flow, credential login, and OAuth provider callbacks
- `form_post` added to `response_modes_supported` in discovery metadata

**Relevant Files:**

- `app/utils/form-post-response.ts` - Form post response utility
- `app/routes/authorize.tsx` - Stores responseMode and handles form_post for SSO
- `app/routes/auth.$provider.callback.tsx` - Handles form_post for OAuth login
- `app/services/login/with-credential.ts` - Returns params for form_post
- `app/services/login/with-provider.ts` - Returns params for form_post
- `app/session.ts` - responseMode in session data
- `app/config.ts` - Discovery metadata

---

### OpenID Connect Session & Logout Specifications

#### OIDC RP-Initiated Logout 1.0

Allows Relying Parties to request End-User logout from the OpenID Provider. Essential for single logout scenarios.

**Reference:** https://openid.net/specs/openid-connect-rpinitiated-1_0.html

**Status:** ⚠️ Partially Implemented

**What's Implemented:**

- `/oidc/logout` endpoint
- `id_token_hint` parameter
- `post_logout_redirect_uri` parameter
- `state` parameter

**What's Missing:**

- `logout_hint` parameter
- `client_id` parameter (for when `id_token_hint` not provided)
- `ui_locales` parameter

**Relevant Files:**

- `app/routes/oidc.logout.tsx`

**Required Changes:**

1. Accept additional parameters in `app/routes/oidc.logout.tsx`:

```typescript
const logoutHint = url.searchParams.get("logout_hint");
const clientId = url.searchParams.get("client_id");
const uiLocales = url.searchParams.get("ui_locales");

// When client_id is provided with id_token_hint, verify they match
if (clientId && idTokenHint) {
	const decoded = decodeIdToken(idTokenHint);
	if (decoded.aud !== clientId) {
		return error("Client ID does not match ID Token audience");
	}
}
```

---

#### OIDC Front-Channel Logout 1.0

Logout mechanism using browser redirects and iframes. Less reliable than back-channel due to third-party cookie blocking, but useful as a fallback.

**Reference:** https://openid.net/specs/openid-connect-frontchannel-1_0.html

**Status:** ❌ Not Implemented

**What's Missing:**

- Store `frontchannel_logout_uri` per client
- On logout, render hidden iframes to each RP's logout URI
- Include `iss` and `sid` parameters
- Add `frontchannel_logout_supported` to discovery

**Relevant Files:**

- `db/schema.ts`
- `app/routes/oidc.logout.tsx`
- `app/config.ts`

**Required Changes:**

1. Add `frontchannel_logout_uri` column to clients table:

```typescript
// db/schema.ts
frontchannel_logout_uri: text("frontchannel_logout_uri"),
frontchannel_logout_session_required: integer("frontchannel_logout_session_required"),
```

2. Modify logout page to include logout iframes:

```typescript
// In app/routes/oidc.logout.tsx
// Render hidden iframes for each RP with active session
const logoutIframes = clients.map(
	(client) =>
		`<iframe src="${client.frontchannel_logout_uri}?iss=${issuer}&sid=${sessionId}" style="display:none"></iframe>`,
);
```

3. Update discovery metadata:

```typescript
frontchannel_logout_supported: true,
frontchannel_logout_session_supported: true,
```

---

#### OIDC Back-Channel Logout 1.0

Server-to-server logout notification using Logout Tokens. More reliable than front-channel as it doesn't depend on the user's browser.

**Reference:** https://openid.net/specs/openid-connect-backchannel-1_0.html

**Status:** ❌ Not Implemented

**What's Missing:**

- Store `backchannel_logout_uri` per client
- Generate Logout Tokens (JWTs with special `events` claim)
- POST logout tokens to each RP on user logout
- Add `backchannel_logout_supported` to discovery

**Relevant Files:**

- `db/schema.ts`
- `app/entities/logout-token.ts` (to be created)
- `app/routes/oidc.logout.tsx`
- `app/config.ts`

**Required Changes:**

1. Add columns to clients table:

```typescript
// db/schema.ts
backchannel_logout_uri: text("backchannel_logout_uri"),
backchannel_logout_session_required: integer("backchannel_logout_session_required"),
```

2. Create Logout Token entity (`app/entities/logout-token.ts`):

```typescript
interface LogoutTokenPayload {
	iss: string;
	sub?: string;
	aud: string;
	iat: number;
	exp: number; // Short expiration, max 2 minutes
	jti: string;
	sid?: string;
	events: {
		"http://schemas.openid.net/event/backchannel-logout": {};
	};
}

// Sign with ES256, same keys as ID Tokens
// Set typ: "logout+jwt" in header
```

3. Send logout tokens to RPs during logout:

```typescript
// POST to each RP's backchannel_logout_uri
// Content-Type: application/x-www-form-urlencoded
// Body: logout_token=<JWT>
// Expected response: 200 OK or 204 No Content
```

4. Update discovery metadata:

```typescript
backchannel_logout_supported: true,
backchannel_logout_session_supported: true,
```

---

#### OIDC Session Management 1.0

Allows RPs to monitor login status via postMessage with check_session_iframe. Enables silent session checks without network requests.

**Reference:** https://openid.net/specs/openid-connect-session-1_0.html

**Status:** ❌ Not Implemented

**What's Missing:**

- `/oidc/check-session` endpoint returning HTML/JS page
- `session_state` parameter in authorization response
- Browser state tracking via cookies

**Relevant Files:**

- `app/routes/oidc.check-session.ts` (to be created)
- `app/routes/authorize.tsx`
- `app/config.ts`

**Required Changes:**

1. Create check session iframe endpoint (`app/routes/oidc.check-session.ts`):

```typescript
export function loader() {
	const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Check Session</title></head>
    <body>
    <script>
      window.addEventListener("message", function(e) {
        var client_id = e.data.substr(0, e.data.lastIndexOf(' '));
        var session_state = e.data.substr(e.data.lastIndexOf(' ') + 1);
        var salt = session_state.split('.')[1];
        
        // Get OP browser state from cookie
        var opuas = getOpBrowserState();
        
        var ss = sha256(client_id + ' ' + e.origin + ' ' + opuas + ' ' + salt) + '.' + salt;
        
        var stat = (session_state === ss) ? 'unchanged' : 'changed';
        e.source.postMessage(stat, e.origin);
      });
    </script>
    </body>
    </html>
  `;
	return new Response(html, { headers: { "Content-Type": "text/html" } });
}
```

2. Add `session_state` to authorization responses:

```typescript
// In app/routes/authorize.tsx
const salt = generateRandomString();
const opBrowserState = getOpBrowserState(); // From cookie
const sessionState = sha256(`${clientId} ${redirectOrigin} ${opBrowserState} ${salt}`) + "." + salt;

// Include in redirect
redirect_uri + `?code=${code}&state=${state}&session_state=${sessionState}`;
```

3. Add `check_session_iframe` to discovery

---

### OpenID Connect Extension Specifications

#### OIDC Prompt Create 1.0

Allows RPs to request user registration via `prompt=create`. Enables direct links to registration from client applications.

**Reference:** https://openid.net/specs/openid-connect-prompt-create-1_0.html

**Status:** ✅ Implemented

**What's Implemented:**

- Accept `prompt` parameter with multiple space-separated values
- `prompt=create` shows the registration form prominently
- `prompt=none` returns `login_required` error if user not authenticated
- `prompt=login` forces re-authentication even if logged in
- Prompt values stored in session for use after OAuth provider login
- `prompt_values_supported` added to discovery metadata

**Relevant Files:**

- `app/routes/authorize.tsx` - Handles prompt parameter logic
- `app/session.ts` - Stores prompt in session
- `app/config.ts` - Discovery metadata with prompt_values_supported

---

#### OIDC Unmet Authentication Requirements

Defines `unmet_authentication_requirements` error for when requested `acr` cannot be met. Implement alongside Step Up Authentication (RFC 9470).

**Reference:** https://openid.net/specs/openid-connect-unmet-authentication-requirements-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** Return `unmet_authentication_requirements` error when requested `acr_values` cannot be satisfied.

---

#### EAP ACR Values

Defines standard Authentication Context Class Reference values. Reference for `acr` claim values when implementing step-up authentication.

**Reference:** https://openid.net/specs/openid-connect-eap-acr-values-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None directly, use as reference for `acr` values.

---

#### OpenID Connect Native SSO

Enables SSO between native apps from the same vendor. Specialized use case for mobile app ecosystems.

**Reference:** https://openid.net/specs/openid-connect-native-sso-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless native app SSO is needed.

---

#### Self-Issued OP v2 (SIOP v2)

User-controlled OpenID Providers (wallet-based authentication). Emerging standard for decentralized identity, not applicable to centralized auth server.

**Reference:** https://openid.net/specs/openid-connect-self-issued-v2-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None

---

#### OpenID Federation 1.0

Trust establishment mechanism for federations of identity providers. Only needed for multi-organization federation scenarios.

**Reference:** https://openid.net/specs/openid-federation-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless federation is needed.

---

### OpenID Connect CIBA

#### CIBA Core 1.0

Client-Initiated Backchannel Authentication enables decoupled authentication where the authentication device is separate from the consumption device. Useful for scenarios like TV login, call center authentication.

**Reference:** https://openid.net/specs/openid-client-initiated-backchannel-authentication-core-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless decoupled authentication is needed.

---

### Financial-grade API (FAPI) Specifications

#### FAPI 2.0 Security Profile

High-security OAuth profile for financial and other sensitive APIs. Requires PAR, signed requests, and other security measures.

**Reference:** https://openid.net/specs/fapi-security-profile-2_0-final.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless FAPI compliance is needed.

---

#### FAPI 2.0 Attacker Model

Threat model informing FAPI security requirements. Reference document for understanding FAPI security considerations.

**Reference:** https://openid.net/specs/fapi-attacker-model-2_0-final.html

**Status:** ✅ Reference Only

**Required Changes:** None

---

#### FAPI 1.0 Part 1: Baseline

Secured OAuth baseline profile for read-only API access.

**Reference:** https://openid.net/specs/openid-financial-api-part-1-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless FAPI compliance is needed.

---

#### FAPI 1.0 Part 2: Advanced

High-security OAuth profile for read-write API access.

**Reference:** https://openid.net/specs/openid-financial-api-part-2-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless FAPI compliance is needed.

---

#### JARM - JWT Secured Authorization Response Mode

Returns authorization response as a signed/encrypted JWT. Security feature from FAPI for high-security responses.

**Reference:** https://openid.net/specs/oauth-v2-jarm.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless JARM is needed.

---

#### Grant Management for OAuth 2.0

APIs for managing user consent/grants programmatically. Useful for consent management UIs.

**Reference:** https://openid.net/specs/fapi-grant-management.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless grant management is needed.

---

### Identity Assurance Specifications

#### OIDC for Identity Assurance 1.0

Extends OIDC with verified claims for KYC/identity proofing. Specialized for identity verification scenarios.

**Reference:** https://openid.net/specs/openid-connect-4-identity-assurance-1_0-final.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless identity assurance is needed.

---

#### Identity Assurance Schema

Verified Claims Schema Definition for identity assurance.

**Reference:** https://openid.net/specs/openid-ida-verified-claims-1_0-final.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless identity assurance is needed.

---

#### Identity Assurance Claims

Claims Registration for Identity Assurance.

**Reference:** https://openid.net/specs/openid-connect-4-ida-claims-1_0-final.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless identity assurance is needed.

---

### Shared Signals and Events Specifications

#### RFC 8417 - Security Event Token (SET)

JWT format for security events like logout, account changes. Foundation for RISC and CAEP. Logout Tokens (OIDC Back-Channel Logout) are a form of SET.

**Reference:** https://datatracker.ietf.org/doc/html/rfc8417

**Status:** ❌ Not Implemented

**Required Changes:** Implement as part of back-channel logout.

---

#### Shared Signals Framework 1.0

Framework for sharing security signals between services. For advanced security event sharing.

**Reference:** https://openid.net/specs/openid-sharedsignals-framework-1_0-final.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless signal sharing is needed.

---

#### CAEP 1.0 - Continuous Access Evaluation Profile

Real-time access evaluation and revocation signals. Enterprise feature for continuous security evaluation.

**Reference:** https://openid.net/specs/openid-caep-1_0-final.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless CAEP is needed.

---

#### RISC 1.0 - Risk Incident Sharing and Coordination

Sharing risk and security incidents between identity providers.

**Reference:** https://openid.net/specs/openid-risc-1_0-final.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless RISC is needed.

---

### Verifiable Credentials (Emerging)

#### OpenID4VCI - Verifiable Credential Issuance

Protocol for issuing verifiable credentials via OAuth. Emerging standard for digital credentials.

**Reference:** https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless VC issuance is needed.

---

#### OpenID4VP - Verifiable Presentations

Protocol for presenting verifiable credentials. Emerging standard for credential presentation.

**Reference:** https://openid.net/specs/openid-4-verifiable-presentations-1_0.html

**Status:** ❌ Not Implemented

**Required Changes:** None unless VP support is needed.

---

### IETF Drafts (In Progress)

#### draft-ietf-oauth-v2-1 - OAuth 2.1

Consolidation of OAuth 2.0 core + security BCPs into single spec. When finalized, will be the new baseline. Currently incorporates RFC 6749 (core), RFC 7636 (PKCE), RFC 9700 (security BCP), and deprecates implicit and password grants.

**Reference:** https://datatracker.ietf.org/doc/draft-ietf-oauth-v2-1/

**Status:** 📋 Future Consideration

**Required Changes:** Track progress; no immediate action needed.

---

#### draft-ietf-oauth-browser-based-apps - OAuth for SPAs

Best practices for browser-based (SPA) OAuth applications. Client-side guidance - auth server should support recommended patterns.

**Reference:** https://datatracker.ietf.org/doc/draft-ietf-oauth-browser-based-apps/

**Status:** 📋 Guidance for Clients

**Required Changes:** None (guidance document for clients).

---

#### draft-ietf-oauth-cross-device-security

Security considerations for cross-device OAuth flows. Relevant to Device Authorization Grant security.

**Reference:** https://datatracker.ietf.org/doc/draft-ietf-oauth-cross-device-security/

**Status:** 📋 Security Guidance

**Required Changes:** Review when implementing device flow.

---

#### draft-ietf-oauth-first-party-apps - OAuth 2.0 for First-Party Applications

OAuth 2.0 patterns for first-party (same-organization) applications. May provide simplified flows for trusted applications.

**Reference:** https://datatracker.ietf.org/doc/draft-ietf-oauth-first-party-apps/

**Status:** 📋 Future Consideration

**Required Changes:** Track progress; no immediate action needed.

---

## Implementation Plan

| Status | Priority | Item                                                                             | Effort | Impact | Spec              |
| :----: | :------: | -------------------------------------------------------------------------------- | ------ | ------ | ----------------- |
|   ✅   |    P0    | Fix discovery document (remove false endpoints)                                  | Low    | High   | RFC 8414          |
|   ✅   |    P0    | Implement `/userinfo`                                                            | Medium | High   | OIDC Core         |
|   ✅   |    P0    | Reduce auth code TTL to 10 minutes                                               | Low    | Medium | RFC 6749          |
|   ✅   |    P0    | Add `Cache-Control: no-store` to token responses                                 | Low    | Medium | RFC 6750          |
|   ✅   |    P1    | Implement `/oauth/revoke`                                                        | Medium | Medium | RFC 7009          |
|   ✅   |    P1    | Implement `/oauth/introspect`                                                    | Medium | Medium | RFC 7662          |
|   ✅   |    P1    | Add nonce support                                                                | Medium | Medium | OIDC Core         |
|   ✅   |    P1    | Add `WWW-Authenticate` header to protected resources                             | Low    | Medium | RFC 6750          |
|   ✅   |    P1    | Add `grant_types_supported` to discovery                                         | Low    | Low    | RFC 8414          |
|   ✅   |    P1    | Back-channel logout support                                                      | High   | High   | OIDC Back-Channel |
|   ✅   |    P1    | Add `iss` to authorization response                                              | Low    | Medium | RFC 9207          |
|   ✅   |    P1    | Implement scope validation (openid, email, profile)                              | Medium | Medium | RFC 6749          |
|   ⬜   |    P2    | Client secrets/redirect URIs refactoring (multi-secret, hashing, usage tracking) | High   | High   | RFC 9700          |

| ✅ | P2 | Add `logout_hint`, `client_id`, `ui_locales` to logout | Low | Low | OIDC RP-Logout |
| ✅ | P2 | Add rate limiting (via Workers Rate Limiting bindings) | Low | High | RFC 9700 |
| ✅ | P2 | Front-channel logout support | Medium | Medium | OIDC Front-Channel |
| ✅ | P2 | Session management (check_session_iframe) | Medium | Medium | OIDC Session |
| ✅ | P2 | Form post response mode | Low | Medium | OAuth Form Post |
| ✅ | P2 | Prompt=create support | Low | Low | OIDC Prompt Create |
| ⬜ | P3 | Add `auth_time` claim | Low | Low | OIDC Core |
| ⬜ | P3 | Refresh token rotation | Medium | Medium | RFC 9700 |
| ⬜ | P3 | OIDC discovery endpoint (`/.well-known/openid-configuration`) | Low | Low | OIDC Discovery |
| ⬜ | P3 | Dynamic client registration (or remove from discovery) | High | Low | OIDC Registration |
| ⬜ | P3 | JWT client authentication (private_key_jwt) | Medium | Medium | RFC 7523 |
| ⬜ | P3 | Pushed Authorization Requests (PAR) | Medium | High | RFC 9126 |
| ⬜ | P3 | Device Authorization Grant | High | Medium | RFC 8628 |

**Legend:** ⬜ Not Started | 🟡 In Progress | ✅ Done

---

## Migration Notes

### Client Secrets and Redirect URIs Refactoring

Create two new tables to support multiple secrets and redirect URIs per client (similar to GitHub's approach):

```typescript
// db/schema.ts

// New table: client_secrets
export const clientSecrets = sqliteTable("client_secrets", {
	id: text("id").primaryKey(),
	clientId: text("client_id")
		.notNull()
		.references(() => clients.id, { onDelete: "cascade" }),
	secretHash: text("secret_hash").notNull(), // bcrypt hash
	name: text("name"), // Optional label (e.g., "Production", "Local Dev")
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(), // Updated on each use
});

// New table: client_redirect_uris
export const clientRedirectUris = sqliteTable("client_redirect_uris", {
	id: text("id").primaryKey(),
	clientId: text("client_id")
		.notNull()
		.references(() => clients.id, { onDelete: "cascade" }),
	uri: text("uri").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

**Migration Strategy:**

1. Create new `client_secrets` and `client_redirect_uris` tables via Drizzle migration
2. Run data migration script to:
   - Hash existing `secret` values with bcrypt and insert into `client_secrets` table
   - Set `name` to "Legacy (migrated)" for identification
   - Copy existing `redirectUri` values to `client_redirect_uris` table
3. Deploy updated code that reads from new tables
4. Verify all existing client integrations continue to work (secrets remain valid)
5. In a subsequent migration, remove old `secret` and `redirectUri` columns from `clients` table
6. Update admin UI to manage multiple secrets and redirect URIs

**Note:** This is a non-breaking migration. Existing secrets are hashed and moved to the new table, so all current client integrations continue to work without any changes on the client side.

**Secret Usage Tracking:**

```typescript
// In token endpoint after successful client authentication
async function authenticateClient(clientId: string, clientSecret: string) {
	const secrets = await db.query.clientSecrets.findMany({
		where: eq(clientSecrets.clientId, clientId),
	});

	for (const secret of secrets) {
		if (await bcrypt.compare(clientSecret, secret.secretHash)) {
			// Update last used timestamp
			await db
				.update(clientSecrets)
				.set({ updatedAt: new Date() })
				.where(eq(clientSecrets.id, secret.id));

			return { success: true, client };
		}
	}

	return { success: false };
}
```

### Discovery Document Changes

Clients caching the discovery document may need cache invalidation after changes. Key changes:

- Remove non-existent endpoints (revoke, introspect, userinfo, register) until implemented
- Add `grant_types_supported`
- Remove `"token"` from `response_types_supported`
- Add `authorization_response_iss_parameter_supported` when RFC 9207 is implemented

### Consequences

**Positive:**

- Full compliance with OAuth 2.0 and OIDC specifications
- Resource servers can validate tokens via introspection
- Clients can properly revoke tokens on logout
- Improved security posture per RFC 9700
- No more false advertising in discovery document
- Multiple secrets per client enables separate credentials for different environments
- Multiple redirect URIs per client provides flexibility for different deployment scenarios
- Secret usage tracking enables security audits and identification of unused credentials

**Negative:**

- Significant implementation effort
- Database migration needed for client secrets and redirect URIs refactoring
- Breaking change if clients depend on implicit grant (unlikely)
- Rate limiting adds operational complexity

### Secret Rotation Workflow

1. Create new secret in admin UI (shown once)
2. Update client application with new secret
3. Monitor `updated_at` on old secret to confirm it's no longer used
4. Revoke old secret once confirmed unused
