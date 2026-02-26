# ADR-006: Auth App Codebase Simplification

## Status

**Accepted** - 2026-02-25

## Background

After completing ADR-005 (OAuth 2.0/OIDC Spec Compliance), a staff engineer code review revealed that while the auth app is now spec-compliant, the codebase has accumulated unnecessary complexity. With 93 TypeScript files across 22 directories, the architecture has too many abstraction layers and scattered responsibilities.

The auth app should follow a simple MVC-like pattern where routes act as controllers/views and models handle database access, with the OIDC module containing all OAuth/OIDC business logic.

## Context

### Current Directory Structure

```
app/
├── clients/          # External API wrappers (GitHub, Polar)
├── components/       # View partials
├── entities/         # JWT token wrappers (4 files)
├── errors/           # OAuth error classes (11 files)
├── helpers/          # Just 1 file (api.ts)
├── jobs/             # Background jobs
├── locales/          # i18n translations
├── middleware/       # React Router middleware
├── models/           # Database queries (7 files)
├── modules/          # OAuth2 provider (2 files)
├── providers/        # OAuth strategies for external auth
├── routes/           # Route handlers (32 files, flat structure)
├── services/         # Business logic (5 files)
└── utils/            # Small utilities (4 files)
```

### Issues Identified

| Issue                         | Impact                                     |
| ----------------------------- | ------------------------------------------ |
| 11 separate error files       | Could be static properties on one class    |
| 4 entity files for JWT tokens | Could be private methods in OIDC class     |
| services/ duplicates logic    | Should live in OIDC class or models        |
| utils/ has OIDC-specific code | Should be in OIDC class or helpers         |
| providers/ naming confusion   | Conflicts with "OIDC Provider" terminology |
| Flat routes in single folder  | Hard to navigate 32+ route files           |
| helpers/ has only 1 file      | Under-utilized directory                   |

### Current Request Flow

```
Request → Route (loader/action) → Service → OIDC Module → Entity → Model
```

Too many layers. A token exchange traverses:

1. `routes/oauth.token.ts`
2. `services/oidc.ts`
3. `modules/oauth2.ts`
4. `entities/access-token.ts`
5. `models/session.ts`

## Decision

Simplify to a clear MVC-like architecture:

```
Request → Route (controller/view) → OIDC Module → Repository (models via DI)
```

### Target Directory Structure

```
app/
├── middleware/         # Keep (required for React Router)
├── models/             # Keep (1 per DB table, MVC pattern)
├── modules/
│   └── oauth2.ts       # Consolidate: OIDC class with errors, tokens, all logic
├── helpers/            # HTTP helpers for loaders/actions
│   ├── api-auth.ts     # API authorization (from api.ts)
│   ├── form-post.ts    # form_post response mode (from utils/)
│   └── decode-token.ts # Decode access tokens (from utils/)
├── routes/             # Multi-directory organization
│   ├── _index/route.ts
│   ├── authorize/route.tsx
│   ├── healthcheck/route.ts
│   ├── $/route.tsx
│   ├── auth/           # prefix: "auth"
│   ├── oauth/          # prefix: "oauth"
│   ├── oidc/           # prefix: "oidc"
│   ├── well-known/     # prefix: ".well-known"
│   ├── account/        # prefix: "account"
│   ├── admin/          # prefix: "admin"
│   └── api/            # prefix: "api"
├── components/         # Keep (view partials)
├── locales/            # Keep
├── jobs/               # Keep
├── clients/            # Keep (external API wrappers)
└── strategies/         # Rename from providers/
```

### OIDC Class Structure

Consolidate everything into a single `OIDC` class:

```typescript
export class OIDC {
  // Static error classes
  static Error = class OAuth2Error { ... }
  static InvalidClientError = class extends OIDC.Error { ... }
  static InvalidGrantError = class extends OIDC.Error { ... }
  static InvalidRequestError = class extends OIDC.Error { ... }
  static InvalidScopeError = class extends OIDC.Error { ... }
  static UnauthorizedClientError = class extends OIDC.Error { ... }
  static UnsupportedGrantTypeError = class extends OIDC.Error { ... }
  static UnsupportedResponseTypeError = class extends OIDC.Error { ... }
  static AccessDeniedError = class extends OIDC.Error { ... }
  static InternalServerError = class extends OIDC.Error { ... }
  static MissingValidationError = class extends OIDC.Error { ... }

  constructor(issuer: string, repository: OIDC.Repository) { ... }

  // Token endpoint
  token(args): Promise<TokenResponse>
  revoke(args): Promise<void>
  introspect(args): Promise<IntrospectResponse>

  // OIDC endpoints
  userinfo(args): Promise<UserinfoResponse>
  logout(args): Promise<LogoutResult>

  // Authorization (from services/login/)
  generateAuthzCode(args): Promise<Result<AuthzCodeResult>>
  loginWithCredential(args): Promise<Result<AuthzCodeResult>>
  loginWithProvider(args): Promise<Result<AuthzCodeResult>>

  // Logout notifications (from services/)
  sendBackchannelLogoutTokens(subjectId, excludeClientId?): Promise<void>
  getFrontchannelLogoutUrls(subjectId, excludeClientId?): Promise<FrontchannelLogoutUrl[]>

  // Session management
  generateSessionState(clientId, redirectUri, opBrowserState): Promise<string>
  generateOpBrowserState(): string

  // Discovery
  get wellKnown(): WellKnownConfig
  get jwks(): Promise<JWKS>

  // Private (from entities/)
  private signJWT(jwt: JWT): Promise<string>
  private authorizationCodeGrant(args): Promise<TokenResponse>
  private refreshTokenGrant(args): Promise<TokenResponse>
  private clientCredentialsGrant(args): Promise<TokenResponse>
}

export namespace OIDC {
  // Types only (no runtime code in namespace)
  export interface Repository { ... }
  export interface TokenResponse { ... }
  export interface AuthzCodeResult { ... }
}
```

### Repository Interface Expansion

The OIDC class uses dependency injection for database access. Expand the repository interface to support login flows:

```typescript
export namespace OIDC {
	export interface Repository {
		// Existing
		getSigningKey(): Promise<JWK.KeyPair[]>;
		findClientById(clientId: string): Promise<Client | null>;
		findSessionById(sessionId: string): Promise<Session | null>;
		findAuthorizationCodeData(code: string): Promise<AuthzCodeData>;
		findSubjectById(subjectId: string): Promise<Subject | null>;
		deleteSessionById(sessionId: string): Promise<void>;
		deleteSessionBySubjectId(subjectId: string): Promise<void>;
		touchSession(sessionId: string): Promise<void>;

		// New (for login flows)
		findSubjectByEmail(email: string): Promise<Subject | null>;
		createSubject(data: CreateSubjectInput): Promise<Subject>;
		findCredential(subjectId: string): Promise<Credential | null>;
		createCredential(subjectId: string, passwordHash: string): Promise<void>;
		createSession(subjectId, clientId, ip, ua): Promise<{ id: string }>;
		findOrCreateGrant(subjectId: string, clientId: string): Promise<Grant>;
		storeAuthorizationCode(code, data, ttlSeconds): Promise<void>;
		consumeAuthorizationCode(code: string): Promise<AuthzCodeData | null>;

		// New (for logout)
		findSessionsWithBackchannelLogout(subjectId, excludeClientId?): Promise<SessionWithClient[]>;
		findSessionsWithFrontchannelLogout(subjectId, excludeClientId?): Promise<SessionWithClient[]>;
	}
}
```

### Route Organization

Use React Router's multi-directory pattern with `flatRoutes()`:

```typescript
// app/routes.ts
import type { RouteConfig } from "@react-router/dev/routes";
import { prefix } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

let [authRoutes, oauthRoutes, oidcRoutes, wellKnownRoutes, accountRoutes, adminRoutes, apiRoutes] =
	await Promise.all([
		flatRoutes({ rootDirectory: "./routes/auth" }),
		flatRoutes({ rootDirectory: "./routes/oauth" }),
		flatRoutes({ rootDirectory: "./routes/oidc" }),
		flatRoutes({ rootDirectory: "./routes/well-known" }),
		flatRoutes({ rootDirectory: "./routes/account" }),
		flatRoutes({ rootDirectory: "./routes/admin" }),
		flatRoutes({ rootDirectory: "./routes/api" }),
	]);

let rootRoutes = await flatRoutes();

export default [
	...rootRoutes,
	...prefix("auth", authRoutes),
	...prefix("oauth", oauthRoutes),
	...prefix("oidc", oidcRoutes),
	...prefix(".well-known", wellKnownRoutes),
	...prefix("account", accountRoutes),
	...prefix("admin", adminRoutes),
	...prefix("api", apiRoutes),
] satisfies RouteConfig;
```

Each route becomes a folder with `route.ts(x)` inside:

- `routes/_index/route.ts` → `/`
- `routes/authorize/route.tsx` → `/authorize`
- `routes/auth/$provider/route.ts` → `/auth/:provider`
- `routes/account/_.tsx` → layout with auth middleware
- `routes/account/_.profile/route.tsx` → `/account/profile`
- `routes/admin/_.tsx` → layout with auth + role middleware

### Directories to Remove

| Directory    | Destination                           |
| ------------ | ------------------------------------- |
| `services/`  | Methods on OIDC class                 |
| `entities/`  | Private methods on OIDC class         |
| `errors/`    | Static properties on OIDC class       |
| `utils/`     | Split between OIDC class and helpers/ |
| `providers/` | Renamed to `strategies/`              |

## Consequences

### Positive

- **Simpler mental model**: Request → Route → OIDC → Repository
- **Single source of truth**: All OAuth/OIDC logic in one class
- **Easier navigation**: Routes organized by feature/prefix
- **Fewer files**: ~20 files consolidated into OIDC class
- **Better testability**: One class to test with mocked repository
- **Clear boundaries**: OIDC class doesn't know about HTTP, helpers handle that

### Negative

- **Large file**: oauth2.ts will grow to ~1500+ lines
- **Migration effort**: All imports need updating
- **Route renames**: May break bookmarks during transition

### Neutral

- **services/oidc.ts remains**: Still needed to instantiate OIDC with repository
- **Models unchanged**: Still 1 model per table
- **Test updates required**: Tests must be updated as code moves

## Implementation Plan

### Phase 1: Consolidate Errors

**Priority:** High
**Estimated Effort:** 30 minutes

1. Move all error classes from `errors/` to static properties on OIDC class
2. Update all imports
3. Delete `errors/` directory
4. Update tests

### Phase 2: Consolidate Entities

**Priority:** High
**Estimated Effort:** 1 hour

1. Move token generation/verification from `entities/` to private methods
2. Keep interfaces in OIDC namespace
3. Update all imports
4. Delete `entities/` directory
5. Update tests

### Phase 3: Move Utils

**Priority:** Medium
**Estimated Effort:** 30 minutes

1. Move `session-state.ts` methods to OIDC class
2. Move `form-post-response.ts` to `helpers/form-post.ts`
3. Move `decode-access-token.ts` to `helpers/decode-token.ts`
4. Move `user-agent.ts` to `helpers/user-agent.ts`
5. Delete `utils/` directory

### Phase 4: Consolidate Services

**Priority:** High
**Estimated Effort:** 2 hours

1. Expand OIDC.Repository interface with new methods
2. Move `services/login/generate-code.ts` logic to OIDC class
3. Move `services/login/with-credential.ts` logic to OIDC class
4. Move `services/login/with-provider.ts` logic to OIDC class
5. Move `services/backchannel-logout.ts` logic to OIDC class
6. Move `services/frontchannel-logout.ts` logic to OIDC class
7. Update `services/oidc.ts` repository implementation
8. Delete `services/login/` directory
9. Update tests

### Phase 5: Rename Providers

**Priority:** Low
**Estimated Effort:** 15 minutes

1. Rename `providers/` to `strategies/`
2. Update all imports

### Phase 6: Reorganize Routes

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Create new `app/routes.ts` with multi-directory config
2. Create route subdirectories: `auth/`, `oauth/`, `oidc/`, `well-known/`, `account/`, `admin/`, `api/`
3. Move and rename route files to folder/route.ts pattern
4. Add layout routes with middleware for `account/` and `admin/`
5. Update all internal route references

### Phase 7: Cleanup and Verify

**Priority:** High
**Estimated Effort:** 30 minutes

1. Run full test suite
2. Run typecheck
3. Run linter
4. Manual smoke test of key flows
5. Commit and push

## Alternatives Considered

### 1. Split OIDC into Multiple Module Files

Create `modules/oauth2/` folder with separate files for errors, tokens, provider, etc.

**Rejected because**: Adds indirection without benefit. A single well-organized file is easier to navigate than jumping between files.

### 2. Keep Services Layer

Keep services as a thin orchestration layer between routes and OIDC.

**Rejected because**: Services add no value when they just pass through to OIDC. Routes can call OIDC directly.

### 3. Use Namespace for Runtime Code

Put errors and helper functions in the OIDC namespace.

**Rejected because**: Namespaces should only contain types. Runtime code belongs on the class as static or instance members.

## References

- [ADR-005: OAuth 2.0/OIDC Spec Compliance](./ADR-005-oauth2-oidc-spec-compliance.md)
- [Multi-Directory Route Organization Tutorial](https://sergiodxa.com/tutorials/create-a-multi-directory-route-organization-in-react-router)
- [React Router Flat Routes Convention](https://v2.remix.run/docs/file-conventions/routes)

## Current Progress

All phases complete.

- [x] Phase 1: Consolidate Errors - All 11 error classes moved to static properties on OIDC class
- [x] Phase 2: Consolidate Entities - AuthzCode deleted (logic inlined in repository), JWT token classes kept in entities/
- [x] Phase 3: Move Utils - HTTP helpers moved from utils/ to helpers/ (decode-token.ts, form-post.ts, user-agent.ts)
- [x] Phase 4: Consolidate Services - All services consolidated into single OIDC class
- [x] Phase 5: Rename Providers - providers/ renamed to strategies/
- [x] Phase 6: Reorganize Routes - Multi-directory structure with flatRoutes() and prefix()
- [x] Phase 7: Cleanup and Verify - All tests pass, typecheck clean, linting clean

### Final Directory Structure

```
app/
├── clients/            # External API wrappers (GitHub, Polar)
├── components/         # View partials
├── entities/           # JWT token classes (AccessToken, IdToken, LogoutToken)
├── helpers/            # HTTP helpers (api-auth, decode-token, form-post, user-agent)
├── jobs/               # Background jobs
├── locales/            # i18n translations
├── middleware/         # React Router middleware
├── models/             # Database queries (1 per table)
├── modules/            # OIDC class with all OAuth/OIDC logic
├── routes/             # Multi-directory route organization
├── services/           # Repository implementation (oidc.ts only)
└── strategies/         # OAuth strategies for external auth (GitHub)
```

### Notes

- Class renamed from OIDCProvider to OIDC (OIDCProvider kept as alias for backward compatibility)
- OAuth2Provider base class removed - OIDC is now a single class without inheritance
- URL changes in Phase 6: /profile -> /account/profile, /sessions -> /account/sessions, /grants -> /account/grants
- Deleted directories: services/login/, utils/, errors/
- Deleted files: services/backchannel-logout.ts, services/frontchannel-logout.ts, utils/session-state.ts, entities/authz-code.ts
- services/oidc.ts remains as the repository implementation instantiating the OIDC class
- entities/ kept for JWT token classes that extend @edgefirst-dev/jwt
