# ADR-005: Auth Package Redesign

## Status

**Accepted** - 2026-02-25

## Background

The monorepo has a shared package `@pkg/auth-sdk` that provides an OAuth client for interacting with the auth server at `auth.sergiodxa.com`. The current implementation has several limitations:

1. The server URL is hardcoded, making local development and testing difficult
2. Only two methods are supported: client credentials authentication and fetching subjects by ID
3. The auth server supports a full OAuth 2.0 / OIDC implementation that the SDK does not expose

As more applications in the monorepo need to integrate with the auth server, a more complete SDK is needed that supports all authentication flows.

## Context

### Current SDK Implementation

The existing `@pkg/auth-sdk` package provides:

```typescript
class AuthSDK extends APIClient {
	constructor(options: { client: { id: string; secret: string } });

	// Client credentials grant
	authenticate(...resources: string[]): Promise<Result<string, AuthenticationError>>;

	// Subject API
	fetchSubjectById(
		subjectId: string,
		token: string,
	): Promise<Result<Subject, SubjectNotFoundError>>;
}
```

### Issues Identified

| Issue                                      | Impact                                       |
| ------------------------------------------ | -------------------------------------------- |
| Hardcoded URL `https://auth.sergiodxa.com` | Cannot test against local auth server        |
| No Authorization Code flow                 | Browser-based apps cannot use OAuth properly |
| No PKCE support                            | Security best practice not available         |
| No token refresh                           | Apps must re-authenticate when tokens expire |
| No token verification                      | Apps cannot verify JWTs locally              |
| No OIDC logout                             | True SSO logout not possible from SDK        |

### Auth Server Capabilities

The auth server at `apps/auth` supports these OAuth 2.0 / OIDC features:

| Feature            | Endpoint                                      | Status      |
| ------------------ | --------------------------------------------- | ----------- |
| Authorization Code | `GET /authorize`                              | Implemented |
| Token Exchange     | `POST /oauth/token`                           | Implemented |
| Client Credentials | `POST /oauth/token`                           | Implemented |
| Refresh Token      | `POST /oauth/token`                           | Implemented |
| OIDC Logout        | `GET /oidc/logout`                            | Implemented |
| JWKS               | `GET /.well-known/jwks.json`                  | Implemented |
| Discovery          | `GET /.well-known/oauth-authorization-server` | Implemented |
| Subject API        | `GET /api/subjects/:id`                       | Implemented |

## Decision

Redesign the auth package with the following changes:

### 1. Rename Package

Rename from `@pkg/auth-sdk` to `@pkg/auth` for simplicity.

### 2. Configurable Server URL

Make the server URL a required constructor option with no default:

```typescript
interface AuthOptions {
	kv?: KVNamespace; // For JWKS caching
	url: string | URL;
	credentials: { id: string; secret: string };
}

let auth = new Auth({
	kv: env.KV,
	url: "http://localhost:8787", // or "https://auth.sergiodxa.com"
	credentials: { id: env.CLIENT_ID, secret: env.CLIENT_SECRET },
});
```

### 3. Complete OAuth/OIDC Support

Implement all authentication flows the server supports:

#### Authorization Code Flow with PKCE

```typescript
interface AuthorizeParams {
  redirectUri: string;
  state?: string;      // Auto-generated if not provided
  provider?: string;   // Optional - auto-redirect to provider (e.g., "github")
}

interface AuthorizeResult {
  url: URL;
  state: string;
  codeVerifier: string;  // Store for token exchange
}

// Generate authorization URL
auth.createAuthorizationUrl(params: AuthorizeParams): AuthorizeResult

// Exchange code for tokens
interface ExchangeCodeParams {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;  // Normalized to seconds
}

auth.exchangeCode(params: ExchangeCodeParams): Promise<Result<TokenResponse, ExchangeCodeError>>
```

#### Client Credentials

Renamed from `authenticate()` for clarity:

```typescript
interface ClientCredentialsResponse {
  accessToken: string;
  expiresIn: number;  // Normalized to seconds
}

auth.authenticateClient(...resources: string[]): Promise<Result<ClientCredentialsResponse, AuthenticationError>>
```

#### Refresh Token

```typescript
interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;  // May or may not be rotated
  idToken?: string;
  expiresIn: number;
}

auth.refreshToken(refreshToken: string): Promise<Result<RefreshTokenResponse, RefreshTokenError>>
```

#### OIDC Logout

```typescript
interface LogoutParams {
  idTokenHint: string;
  postLogoutRedirectUri?: string;
}

auth.createLogoutUrl(params: LogoutParams): URL
```

#### Token Verification

Verify JWTs using the JWKS endpoint with optional KV caching:

```typescript
interface VerifyOptions {
  audience?: string | string[];
}

interface TokenPayload {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  jti: string;
  // OIDC claims (present in ID tokens)
  email?: string;
  picture?: string;
  preferred_username?: string;
  name?: string;
  email_verified?: boolean;
}

auth.verifyToken(token: string, options?: VerifyOptions): Promise<Result<TokenPayload, TokenVerificationError>>
```

#### Subject API

Unchanged from current implementation:

```typescript
auth.fetchSubjectById(subjectId: string, token: string): Promise<Result<Subject, SubjectNotFoundError>>
```

### 4. JWKS Caching

When a `KVNamespace` is provided, cache JWKS keys to reduce requests:

- Cache key: `cache:jwks`
- TTL: 24 hours
- If verification fails with cached keys, fetch fresh keys and retry

### 5. Response Normalization

The auth server returns `expires_in` in milliseconds (non-standard). The SDK normalizes this to seconds to match the OAuth specification.

### 6. Error Types

```typescript
// Base error
class AuthError extends Error {
	code: string;
}

// Specific errors
class AuthenticationError extends AuthError {} // Client credentials failure
class ExchangeCodeError extends AuthError {} // Code exchange failure
class RefreshTokenError extends AuthError {} // Token refresh failure
class TokenVerificationError extends AuthError {} // JWT verification failure
class SubjectNotFoundError extends AuthError {} // Subject API 404
```

### 7. File Structure

```
packages/auth/
├── src/
│   ├── index.ts           # Main exports
│   ├── auth.ts            # Auth class
│   ├── errors.ts          # Error types
│   ├── types.ts           # Interfaces
│   ├── pkce.ts            # PKCE utilities
│   └── jwks.ts            # JWKS fetching and caching
├── package.json
├── tsconfig.json
└── README.md
```

## Consequences

### Positive

- **Local development**: Configurable URL enables testing against local auth server
- **Complete OAuth support**: All standard flows available to consuming apps
- **Security**: PKCE support for browser-based apps
- **Performance**: JWKS caching reduces verification latency
- **Spec compliance**: Response normalization matches OAuth standards
- **Clearer naming**: `@pkg/auth` is simpler than `@pkg/auth-sdk`

### Negative

- **Breaking change**: Consumers must update imports and constructor calls
- **KV dependency**: Token verification benefits require KV binding
- **Larger package**: More code to maintain

### Neutral

- **No default URL**: Forces explicit configuration, preventing accidental production calls during development
- **State/PKCE generation**: SDK handles this internally, reducing consumer complexity but hiding implementation details

## Implementation Plan

### Phase 1: Create New Package

**Priority:** High
**Estimated Effort:** 2-3 hours

1. Create `packages/auth/` directory structure
2. Implement `Auth` class with all methods
3. Implement PKCE utilities
4. Implement JWKS fetching and caching
5. Write comprehensive documentation

### Phase 2: Migrate Consumers

**Priority:** High
**Estimated Effort:** 30 minutes

1. Update `apps/uptime` to use `@pkg/auth`
2. Add `baseUrl` configuration
3. Update method calls (`authenticate` -> `authenticateClient`)

### Phase 3: Cleanup

**Priority:** Medium
**Estimated Effort:** 15 minutes

1. Delete `packages/auth-sdk/`
2. Update ADR and documentation references

## Alternatives Considered

### 1. Add URL as Optional Parameter with Default

Allow `baseUrl` to be optional, defaulting to production:

```typescript
new Auth({
  baseUrl: "http://localhost:8787",  // Optional, defaults to prod
  client: { ... }
})
```

**Rejected because**: Implicit defaults can lead to accidental production calls during development. Explicit configuration is safer.

### 2. Environment-Based URL Detection

Detect environment (development vs production) and set URL automatically.

**Rejected because**: Environment detection is unreliable in edge runtimes and adds magic behavior that's hard to debug.

### 3. Separate Clients per Flow

Create separate classes for each OAuth flow:

```typescript
new AuthorizationCodeClient({ ... })
new ClientCredentialsClient({ ... })
```

**Rejected because**: Most apps need multiple flows, and a single client with all methods is simpler to use and configure.

### 4. Keep Package Name as `@pkg/auth-sdk`

Maintain backwards compatibility with existing name.

**Rejected because**: "SDK" adds no value and makes the import longer. This is a breaking change anyway, so renaming is low-cost.

## References

- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [OIDC RP-Initiated Logout](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
- [ADR-002: SSO Logout with ID Token Hint](./ADR-002-sso-logout-with-id-token-hint.md)
- [Auth Server ADR-005: OAuth2/OIDC Spec Compliance](./auth/ADR-005-oauth2-oidc-spec-compliance.md)

## Current Progress

- [ ] Phase 1: Create New Package
  - [ ] Create directory structure
  - [ ] Implement Auth class
  - [ ] Implement PKCE utilities
  - [ ] Implement JWKS caching
  - [ ] Write README
- [ ] Phase 2: Migrate Consumers
  - [ ] Update apps/uptime
- [ ] Phase 3: Cleanup
  - [ ] Delete packages/auth-sdk
  - [ ] Update documentation references
