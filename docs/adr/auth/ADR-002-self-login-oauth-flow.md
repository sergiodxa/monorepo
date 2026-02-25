# ADR-002: Auth Server Self-Login via Real OAuth Flow

## Status

Accepted

## Context

The auth server needs to support "standalone login" where users can log into the auth server itself (not through a client app's OAuth flow). This enables:

1. Pre-authentication for faster SSO when later logging into client apps
2. Session management UI at `/sessions` where users can view and revoke their sessions

Previously, standalone login was implemented as a special case that bypassed the normal OAuth flow, creating inconsistencies in how sessions were created and managed.

## Decision

Make the auth server login to itself using a real OAuth flow, treating itself as a first-party OAuth client. This means:

1. **Auth Server as OAuth Client**: Create a dedicated OAuth client representing the auth server itself with:
   - Fixed Client ID: `d12d3901-3cbe-468b-adf5-ac3d3e015728`
   - Dynamically generated secret (created on first run, stored in DB)
   - Redirect URI: `/auth/callback`
   - Logout URI: `/authorize`

2. **Token Storage**: Store `accessToken` and `refreshToken` in the cookie session (same as any client app would store tokens)

3. **Session Management**: The `refreshToken` doubles as the session ID, allowing us to identify the current session for the sessions UI

4. **Token Refresh**: A layout route middleware automatically refreshes the access token when it has < 5 minutes remaining

## Implementation

### Files Changed

| File                                               | Action                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/auth/app/config.ts`                          | Update `AUTH_SERVER_CLIENT_ID`                                            |
| `apps/auth/app/session.ts`                         | Replace `sub`/`sessionId` with `accessToken`/`refreshToken`               |
| `apps/auth/app/models/client.ts`                   | Update `ensureAuthServerClient` to accept request URL and generate secret |
| `apps/auth/app/utils/decode-access-token.ts`       | New utility to decode JWT and extract `sub`/expiration                    |
| `apps/auth/app/routes/authorize.tsx`               | Handle self-redirect for standalone login                                 |
| `apps/auth/app/routes/auth.$provider.callback.tsx` | Remove standalone login special case                                      |
| `apps/auth/app/routes/auth.callback.tsx`           | New OAuth callback for self-login                                         |
| `apps/auth/app/routes/_authenticated.tsx`          | New layout with token refresh middleware                                  |
| `apps/auth/app/routes/_authenticated.sessions.tsx` | Renamed from `sessions.tsx`, updated token handling                       |
| `apps/auth/app/routes/oidc.logout.tsx`             | Delete only current session, redirect to `/authorize`                     |

### Flow: Standalone Login

```
User visits /authorize (no params)
    │
    ▼
Has valid accessToken in session?
    │
    ├─ Yes ──► Redirect to /sessions
    │
    └─ No ──► ensureAuthServerClient()
              Generate state, store in session as authz
              Redirect to /authorize?response_type=code&client_id=...&redirect_uri=/auth/callback&state=...
                  │
                  ▼
              Normal OAuth flow (user clicks "Login with GitHub")
                  │
                  ▼
              /auth/github/callback (has authz session, normal flow)
                  │
                  ▼
              Redirect to /auth/callback?code=xxx&state=xxx
                  │
                  ▼
              Validate state, exchange code for tokens
              Store accessToken and refreshToken in session
              Clear authz from session
              Redirect to /sessions
```

### Flow: Token Refresh (in \_authenticated layout middleware)

```
Request to /_authenticated/* route
    │
    ▼
Has accessToken in session?
    │
    ├─ No ──► Redirect to /authorize
    │
    └─ Yes ──► Decode token, check expiration
                  │
                  ├─ Expires in < 5 min ──► Use refreshToken to get new tokens
                  │                              │
                  │                              ├─ Success ──► Update session, continue
                  │                              │
                  │                              └─ Failure ──► Clear session, redirect to /authorize
                  │
                  └─ Valid ──► Continue to route
```

### Flow: Logout

```
User clicks "Logout" on /sessions (POST to /oidc/logout)
    │
    ▼
Decode sub from accessToken
Delete session by refreshToken (current session only)
Clear accessToken and refreshToken from session
Redirect to /authorize
```

## Consequences

### Positive

1. **Single code path**: No special-casing for standalone vs client app logins
2. **Real security**: Actual client secret validation, proper token exchange
3. **Consistency**: The auth server "eats its own dog food"
4. **Sessions work properly**: Created through the same flow as any other client
5. **Token refresh**: Access tokens are automatically refreshed, improving security

### Negative

1. **Slightly more complex**: Requires understanding that the auth server is both the provider and a client
2. **Database dependency**: The auth server client must exist in the database (auto-created on first run)

### Neutral

1. **Logout behavior change**: Now only deletes the current session, not all sessions for the user. Users must manually revoke other sessions via the sessions UI.
