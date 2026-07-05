# @pkg/oidc-client

OpenID Connect relying-party helpers for the SaaS platform's login flows.

## Overview

This package centralizes the OIDC relying-party (RP) logic that used to be
duplicated across the dashboard and the blog engine. It offers two layers over
the same confidential-client authorization-code + PKCE flow:

- **Standalone helpers** — `discover`, `createPkce`, `buildAuthorizationUrl`,
  `exchangeCode`, and `verifyIdToken` drive the flow by hand. Use these when you
  want full control of the redirect/callback and session handling (the dashboard
  does this).
- **`remix/auth` adapter** — `createProvider`, `resolveEndSessionEndpoint`, and
  `toAuthProfile` wrap [`remix/auth`](https://remix.run)'s OIDC provider so you can
  drive the flow with its `startExternalAuth`/`finishExternalAuth` machinery (the
  blog engine's admin panel does this).

The ID token is received directly from the token endpoint over TLS with client
authentication, so per [OIDC §3.1.3.7](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)
`verifyIdToken` validates the mandatory `iss`/`aud`/`exp`/`sub` claims **in place
of** a signature check for this flow — TLS provides the transport trust. Discovery
documents and `end_session_endpoint`s are cached per issuer for the lifetime of
the isolate.

## Usage

### Standalone flow (dashboard)

```typescript
import {
	buildAuthorizationUrl,
	createPkce,
	discover,
	exchangeCode,
	verifyIdToken,
} from "@pkg/oidc-client";

// 1. Start the flow — redirect the browser to the IdP.
let metadata = await discover(env.OIDC_ISSUER);
let pkce = await createPkce();
let state = crypto.randomUUID();
// persist { state, codeVerifier: pkce.verifier } in the session
let url = buildAuthorizationUrl(metadata, {
	clientId: env.OIDC_CLIENT_ID,
	redirectUri: new URL("/auth/callback", request.url).toString(),
	state,
	challenge: pkce.challenge,
});

// 2. On the callback — exchange the code and validate the token.
let { idToken } = await exchangeCode(metadata, {
	clientId: env.OIDC_CLIENT_ID,
	clientSecret: env.OIDC_CLIENT_SECRET,
	code,
	codeVerifier: transaction.codeVerifier,
	redirectUri: new URL("/auth/callback", request.url).toString(),
});
let profile = verifyIdToken(idToken, {
	issuer: env.OIDC_ISSUER,
	clientId: env.OIDC_CLIENT_ID,
});
// profile.subject, profile.email, profile.displayName
```

### `remix/auth` adapter (blog engine)

```typescript
import { createProvider, resolveEndSessionEndpoint, toAuthProfile } from "@pkg/oidc-client";
import { finishExternalAuth, startExternalAuth } from "remix/auth";

// Start the flow.
let provider = createProvider(config, callbackUri);
return startExternalAuth(provider, ctx);

// Finish the flow.
let { result } = await finishExternalAuth(provider, ctx);
let user = await User.findOrCreateFromAuthProfile(db, toAuthProfile(result.profile));

// RP-initiated logout.
let endSession = await resolveEndSessionEndpoint(config);
```

## API

### `discover(issuer: string): Promise<OidcMetadata>`

Discovers provider metadata from `${issuer}/.well-known/openid-configuration`,
cached per issuer for the lifetime of the isolate.

**Parameters:**

- `issuer`: The OIDC issuer base URL (trailing slash optional)

**Returns:**

- The discovered `OidcMetadata` (`authorization_endpoint`, `token_endpoint`, optional `end_session_endpoint`)

**Throws:** `Error` when the discovery document responds with a non-2xx status.

**Example:**

```typescript
let metadata = await discover("https://sso.blog.sergiodxa.com");
```

### `createPkce(): Promise<Pkce>`

Generates a PKCE verifier and its S256 (SHA-256, base64url) challenge.

**Returns:**

- A `Pkce` pair `{ verifier, challenge }` — keep `verifier` in the session, send `challenge` on the authorization request

**Example:**

```typescript
let pkce = await createPkce();
```

### `buildAuthorizationUrl(metadata: OidcMetadata, input): string`

Builds the authorization redirect URL for the authorization-code + PKCE flow.

**Parameters:**

- `metadata`: Discovered provider metadata
- `input.clientId`: The relying-party client id
- `input.redirectUri`: The absolute callback URL registered with the IdP
- `input.state`: Opaque CSRF/state value echoed back on the callback
- `input.challenge`: The PKCE S256 challenge from `createPkce`
- `input.scopes`: Requested scopes (optional; defaults to `openid profile email`)

**Returns:**

- The fully-qualified authorization URL to redirect the browser to

**Example:**

```typescript
let url = buildAuthorizationUrl(metadata, {
	clientId,
	redirectUri: "https://app.example.com/auth/callback",
	state,
	challenge: pkce.challenge,
});
```

### `exchangeCode(metadata: OidcMetadata, input): Promise<{ idToken: string }>`

Exchanges an authorization code for tokens using HTTP Basic client authentication
(confidential client).

**Parameters:**

- `metadata`: Discovered provider metadata
- `input.clientId`: The relying-party client id
- `input.clientSecret`: The relying-party client secret
- `input.code`: The authorization code returned on the callback
- `input.codeVerifier`: The PKCE verifier stored at authorization time
- `input.redirectUri`: The same callback URL used to obtain `code`

**Returns:**

- `{ idToken }` — the raw ID token string, ready for `verifyIdToken`

**Throws:** `Error` when the token endpoint errors or omits `id_token`.

**Example:**

```typescript
let { idToken } = await exchangeCode(metadata, {
	clientId,
	clientSecret,
	code,
	codeVerifier: transaction.codeVerifier,
	redirectUri,
});
```

### `verifyIdToken(idToken: string, expected): OidcProfile`

Validates an ID token's claims and extracts the authenticated profile. The
signature is **not** verified — the token was received directly from the token
endpoint over TLS, so the mandatory `iss`/`aud`/`exp`/`sub` claims are validated
in place of a signature check for this confidential-client flow.

**Parameters:**

- `idToken`: The compact JWS ID token returned by `exchangeCode`
- `expected.issuer`: The expected issuer (trailing slashes ignored)
- `expected.clientId`: The expected audience (this relying party)

**Returns:**

- The validated `OidcProfile` (`subject`, `email`, `displayName`)

**Throws:** `Error` when the token is malformed or any claim fails validation
(`Malformed ID token`, `Issuer mismatch`, `Audience mismatch`,
`Token expired or missing expiration`, `Missing subject`).

**Example:**

```typescript
let profile = verifyIdToken(idToken, { issuer, clientId });
```

### `createProvider(config: OIDCConfig, redirectUri: string)`

Builds the `remix/auth` OIDC provider for a request. The redirect URI is derived
from the request so one build serves any hostname.

**Parameters:**

- `config`: The relying-party configuration (`issuer`, `clientId`, `clientSecret`, optional `metadata`/`scopes`/`admins`)
- `redirectUri`: The absolute `/auth/callback` URL for this request's host

**Returns:**

- A configured `remix/auth` OIDC auth provider for `startExternalAuth`/`finishExternalAuth`

**Example:**

```typescript
let provider = createProvider(ctx.oidc, callbackUri(ctx.request));
return startExternalAuth(provider, ctx);
```

### `resolveEndSessionEndpoint(config: OIDCConfig): Promise<string | null>`

Resolves the provider's `end_session_endpoint` (for `id_token_hint` logout) from
inline metadata or OIDC discovery, cached per issuer.

**Parameters:**

- `config`: The relying-party configuration

**Returns:**

- The end-session endpoint, or `null` when the provider offers none

**Example:**

```typescript
let endSession = await resolveEndSessionEndpoint(ctx.oidc);
```

### `toAuthProfile(profile: OIDCAuthProfile): NormalizedAuthProfile`

Maps a `remix/auth` OIDC profile to the normalized field names the SaaS user
models consume. `username` falls back to the email local-part, then the subject;
`email` and `displayName` fall back to empty strings.

**Parameters:**

- `profile`: The raw OIDC profile from `remix/auth`

**Returns:**

- The `NormalizedAuthProfile` (`subjectId`, `email`, `username`, `displayName`, `avatar`)

**Example:**

```typescript
let user = await User.findOrCreateFromAuthProfile(db, toAuthProfile(result.profile));
```

### Types

#### `OidcMetadata`

```typescript
interface OidcMetadata {
	authorization_endpoint: string;
	token_endpoint: string;
	end_session_endpoint?: string;
}
```

#### `Pkce`

```typescript
interface Pkce {
	verifier: string;
	challenge: string;
}
```

#### `OidcProfile`

```typescript
interface OidcProfile {
	subject: string;
	email: string;
	displayName: string | null;
}
```

#### `OIDCConfig`

```typescript
interface OIDCConfig {
	issuer: string;
	clientId: string;
	clientSecret: string;
	metadata?: OIDCMetadata;
	scopes?: string[];
	admins?: string[];
}
```

#### `OIDCMetadata`

`remix/auth`'s `OIDCAuthProviderMetadata`, re-exported for use with the adapter.

#### `NormalizedAuthProfile`

```typescript
interface NormalizedAuthProfile {
	subjectId: string;
	email: string;
	avatar: string;
	username: string;
	displayName: string;
}
```

## Pattern: Confidential client, no signature verification

Both layers deliberately skip JWS signature verification. The relying party
receives the ID token straight from the token endpoint over a TLS connection it
authenticated to with its client credentials, so there is no attacker-in-the-middle
to forge a token. Per OIDC §3.1.3.7 the claim checks (`iss`/`aud`/`exp`/`sub`)
suffice for this confidential-client authorization-code flow. Do **not** reuse
`verifyIdToken` for tokens obtained via the implicit flow or received from an
untrusted channel — those require signature verification.

## Pattern: Two layers, one flow

Prefer the standalone helpers when you own the redirect/callback handlers and want
minimal machinery. Prefer the `remix/auth` adapter when you already build on
`remix/auth` and want its transaction storage, provider abstraction, and typed
callback results. The two share the same discovery cache semantics but keep
independent caches.

## Related Packages

- [`@pkg/oidc-provider`](/packages/oidc-provider) - The OpenID Connect **provider** (the other side of this flow)
- [`@pkg/blog-engine`](/packages/blog-engine) - Re-exports the `remix/auth` adapter for its admin panel
- [`@pkg/service-container`](/packages/service-container) - Dependency injection used by the consumers

## Tips

1. **Cache is per-isolate** - `discover` and `resolveEndSessionEndpoint` cache in
   module-level maps, so a fresh isolate re-discovers once. This is intentional and
   safe because discovery documents are effectively static.
2. **Signature is not checked** - `verifyIdToken` trusts TLS + client auth. Only
   use it for tokens fetched directly from the token endpoint of a confidential
   client, never for tokens from an untrusted source.
3. **`state` and PKCE `verifier` are yours to store** - the standalone helpers do
   not touch the session; persist them yourself between the authorize and callback
   requests.
4. **`redirectUri` must match** - the `redirectUri` passed to `buildAuthorizationUrl`
   and `exchangeCode` must be identical and registered with the IdP.
