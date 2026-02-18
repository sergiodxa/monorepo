# ADR-002: SSO Logout with ID Token Hint

## Status

**Proposed** - 2026-02-18

## Background

The monorepo uses a centralized OAuth 2.0 / OpenID Connect authorization server (`apps/auth`) for authentication across multiple client applications (`apps/uptime`, `apps/blog`). Users can log in once and be authenticated across all apps (Single Sign-On).

However, when a user logs out of a client application, they remain logged in to the auth server and other client apps. This breaks the expected SSO logout behavior where logging out of one app should log the user out everywhere.

## Context

### Current Logout Flow

1. User clicks "Logout" in a client app (e.g., uptime)
2. Client app destroys its local session
3. Client app redirects user to its home page
4. User is still logged in to auth server
5. User is still logged in to other client apps
6. Visiting the client app again auto-logs the user back in via SSO

### Expected Logout Flow (OIDC RP-Initiated Logout)

1. User clicks "Logout" in a client app
2. Client app redirects to auth server's `/oidc/logout` endpoint with:
   - `id_token_hint`: The ID token received during authentication
   - `post_logout_redirect_uri`: Where to redirect after logout
3. Auth server validates the request and revokes the user's session
4. Auth server redirects back to the client's `post_logout_redirect_uri`
5. User is now logged out of auth server and all client apps

### Technical Issues Identified

1. **Client apps don't store the ID token**: Both `apps/uptime` and `apps/blog` verify the ID token during authentication but don't store the raw JWT string needed for logout.

2. **Client apps don't redirect to auth server**: Both apps only destroy their local session without initiating OIDC logout.

3. **Auth server validates wrong URI**: The `/oidc/logout` endpoint validates `post_logout_redirect_uri` against the client's `redirectUri` instead of `logoutUri`.

## Decision

Implement OIDC RP-Initiated Logout by:

1. **Storing the ID token** in client app sessions during authentication
2. **Redirecting to auth server** on logout with `id_token_hint` and `post_logout_redirect_uri`
3. **Fixing URI validation** in auth server to use `logoutUri`

### Apps/Uptime Changes

#### 1. Update Session Type (`apps/uptime/app/session.ts`)

Add `idToken` field to store the raw JWT string:

```typescript
export interface SessionData {
	id: string;
	name: string;
	email: string;
	avatar: string;
	idToken: string; // Raw ID token JWT for OIDC logout
}
```

#### 2. Store ID Token on Auth (`apps/uptime/app/routes/auth.tsx`)

After verifying the ID token, store the raw JWT:

```typescript
session.set("idToken", tokens.id); // Store raw JWT string
```

#### 3. Update Logout Function (`apps/uptime/app/modules/auth.ts`)

Redirect to auth server instead of just destroying local session:

```typescript
export async function logout() {
	let session = getSession();
	let idToken = session.get("idToken");

	// Build auth server logout URL
	let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
	if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
	logoutUrl.searchParams.set("post_logout_redirect_uri", "https://uptime.sergiodxa.com/");

	return redirect(logoutUrl.toString(), {
		headers: {
			"Set-Cookie": await sessionStorage.destroySession(session),
			"Clear-Site-Data": '"*"',
		},
	});
}
```

### Apps/Blog Changes

#### 1. Update Session Schema (`apps/blog/app/middleware/session.ts`)

Add `idToken` field:

```typescript
export const SessionDataSchema = z.object({
	user: UserSchema.optional(),
	idToken: z.string().optional(), // Raw ID token JWT for OIDC logout
});
```

#### 2. Store ID Token on Auth (`apps/blog/app/routes/_.auth_.callback/route.tsx`)

After authentication, store the raw JWT:

```typescript
session.set("idToken", tokens.idToken()); // Store raw JWT string
```

#### 3. Update Logout Function (`apps/blog/app/middleware/session.ts`)

Redirect to auth server:

```typescript
export async function logout() {
	let session = getSession();
	let idToken = session.get("idToken");

	// Build auth server logout URL
	let logoutUrl = new URL("https://auth.sergiodxa.com/oidc/logout");
	if (idToken) logoutUrl.searchParams.set("id_token_hint", idToken);
	logoutUrl.searchParams.set("post_logout_redirect_uri", "https://sergiodxa.com/");

	return redirect(logoutUrl.toString(), {
		headers: {
			"Set-Cookie": await sessionStorage.destroySession(session),
			"Clear-Site-Data": '"*"',
		},
	});
}
```

### Apps/Auth Fix

#### Fix URI Validation (`apps/auth/app/modules/oauth2.ts`)

Change validation from `redirectUri` to `logoutUri`:

```typescript
// Before (incorrect):
if (client.redirectUri !== args.postLogoutRedirectUri) {
	throw new InvalidRequestError("Invalid redirect uri");
}

// After (correct):
if (args.postLogoutRedirectUri && client.logoutUri !== args.postLogoutRedirectUri) {
	throw new InvalidRequestError("Invalid redirect uri");
}
```

## Consequences

### Positive

- **True SSO logout**: Logging out of any app logs the user out everywhere
- **OIDC compliant**: Follows the OIDC RP-Initiated Logout specification
- **Security**: Session is properly revoked on the auth server
- **User expectation**: Behavior matches what users expect from SSO

### Negative

- **Extra redirect**: Logout now requires a round-trip to the auth server
- **Session storage**: ID tokens add ~1KB to session size
- **Token expiration**: Stored ID tokens may expire, but this doesn't affect logout functionality

### Neutral

- **Backwards compatible**: Existing sessions without `idToken` will still work (logout just won't have the hint)

## Alternatives Considered

### 1. Make `id_token_hint` Optional

Instead of storing ID tokens, we could modify the auth server to accept logout requests without `id_token_hint`, using only the session cookie to identify the user.

**Rejected because**: The `id_token_hint` provides additional security by proving the client actually authenticated this user. It also identifies which client is initiating logout.

### 2. Use Client ID Instead

Pass `client_id` parameter instead of `id_token_hint` to identify the client.

**Rejected because**: This would require modifying the OIDC logout endpoint to accept non-standard parameters, and we'd lose the cryptographic proof that the client authenticated the user.

### 3. Backchannel Logout

Implement OIDC Backchannel Logout where the auth server notifies all client apps when a user logs out.

**Rejected because**: This adds significant complexity (webhook endpoints, logout tokens, retry logic) and isn't necessary for our use case where users typically stay on one app.

## Implementation Plan

1. Fix auth server URI validation (independent, can deploy first)
2. Update `apps/uptime` session and logout
3. Update `apps/blog` session and logout
4. Test SSO logout flow across all apps
5. Deploy all changes

## References

- [OIDC RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
