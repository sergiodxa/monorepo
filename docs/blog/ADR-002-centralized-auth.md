# ADR-002: Migrate to Centralized Authentication

## Status

**Implemented** - 2026-02-16

## Background

The monorepo contains a centralized authentication service at `apps/auth/` that implements OAuth 2.0 and OpenID Connect. It serves as the central identity provider for all applications, supporting multiple authentication methods (GitHub, Google, email/password).

The `apps/blog/` application currently has its own authentication system that directly integrates with GitHub OAuth, maintaining its own user database and session management.

## Context

### Current Blog Authentication

The blog implements authentication independently:

| Component         | Implementation                                    |
| ----------------- | ------------------------------------------------- |
| OAuth Provider    | Direct GitHub integration via `remix-auth-oauth2` |
| Session Storage   | Cloudflare Workers KV (`AUTH` binding)            |
| User Database     | Local D1 `users` table                            |
| OAuth Connections | Local D1 `connections` table                      |
| Session Cookie    | `sdx:session` with 1-year expiry                  |
| Special Features  | GitHub sponsor status check via GraphQL API       |

**Key Files:**

- `app/modules/auth.server.ts` - GitHub OAuth strategy
- `app/middleware/session.ts` - Session management with user schema
- `app/middleware/rolling-cookie.ts` - Cookie expiry extension
- `app/routes/_.auth_.github.callback/route.tsx` - GitHub OAuth callback
- `app/routes/_.auth_.login/route.tsx` - Login page
- `app/routes/_.auth_.logout/route.tsx` - Logout page
- `app/db/schema.ts` - Users and connections tables

**Current User Schema:**

```typescript
const UserSchema = z.object({
	id: z.string().uuid(),
	role: z.enum(["admin", "guest"]),
	email: z.string().email().max(320),
	avatar: z.string().url().max(2048),
	username: z.string().min(1).max(39),
	displayName: z.string().min(1).max(255),
	githubId: z.string().min(1),
	isSponsor: z.boolean(),
});
```

### Centralized Auth Service

The `apps/auth/` application provides:

| Feature        | Details                                                             |
| -------------- | ------------------------------------------------------------------- |
| Production URL | `https://auth.sergiodxa.com`                                        |
| Protocol       | OAuth 2.0 + OpenID Connect                                          |
| Providers      | GitHub, Google, email/password                                      |
| Token Format   | ES256 JWT (access tokens, ID tokens)                                |
| Discovery      | `/.well-known/oauth-authorization-server`, `/.well-known/jwks.json` |
| SDK            | `@pkg/auth-sdk` for client integration                              |

**Key Endpoints:**

- `/authorize` - OAuth authorization endpoint
- `/oauth/token` - Token exchange endpoint
- `/userinfo` - OIDC userinfo endpoint
- `/oidc/logout` - OIDC logout endpoint
- `/api/subjects/:id` - Subject (user) API

**ID Token Claims:**

```typescript
{
	sub: string; // Subject ID (user ID in auth system)
	iss: string; // Issuer (auth.sergiodxa.com)
	aud: string; // Audience (client ID)
	email: string;
	picture: string; // Avatar URL
	preferred_username: string;
	name: string; // Display name
	email_verified: boolean;
}
```

### Issues with Current Approach

1. **Duplicate User Management** - Blog maintains its own user database that duplicates auth's subjects
2. **Direct Provider Coupling** - Blog is tightly coupled to GitHub; adding new providers requires blog changes
3. **Inconsistent Auth Flow** - Different from other apps that use centralized auth
4. **Maintenance Burden** - OAuth implementation maintained separately from auth app
5. **No SSO** - Users must log in separately to blog even if authenticated elsewhere

### Reference Implementation

The `apps/uptime/` application demonstrates proper integration with centralized auth:

```typescript
// apps/uptime/app/modules/auth.ts
let oauth = new OAuth2Strategy(
	{
		clientId: env.CLIENT_ID,
		clientSecret: env.CLIENT_SECRET,
		redirectURI: new URL("/auth", url),
		authorizationEndpoint: new URL("https://auth.sergiodxa.com/authorize"),
		tokenEndpoint: new URL("https://auth.sergiodxa.com/oauth/token"),
		scopes: ["openid", "profile", "email"],
	},
	async (args) => {
		let idToken = await verifyIdToken(tokens.id);
		// ...
	},
);
```

## Decision

### Migrate Blog to Centralized Auth

Replace the blog's direct GitHub OAuth integration with OAuth 2.0 flow through `auth.sergiodxa.com`.

### Keep Local User Profiles

The blog will maintain a local `users` table for blog-specific data (role), linked to auth subjects via `subject_id`. This is necessary because:

1. **Role Separation** - Auth's `role` field is for auth system administration, not app-specific authorization
2. **Data Integrity** - The `posts` table has `author_id` FK to `users.id` with `ON DELETE CASCADE`
3. **Performance** - Cache user profile data locally to avoid API calls on every request

### Remove GitHub Sponsor Feature

The GitHub sponsor check feature will be removed as it adds complexity and can be re-implemented differently if needed.

### Require Re-authentication

Existing users will need to log in again after migration. This is acceptable because:

1. Simpler migration (no data transfer)
2. Ensures clean linkage to auth subjects
3. Blog has relatively few registered users

## Implementation

### Phase 1: Database Migration

**Priority:** High
**Estimated Effort:** 30 minutes

#### Step 1.1: Create Migration File

**File:** `apps/blog/db/migrations/0002_AddSubjectIdAndDropConnections.sql`

```sql
-- Migration number: 0002 	 2026-02-16T00:00:00.000Z

-- Add subject_id column to users table for linking to auth.sergiodxa.com
-- This links local blog profiles to centralized auth subjects
ALTER TABLE users ADD COLUMN subject_id VARCHAR(36) UNIQUE;

-- Create index for efficient subject_id lookups during authentication
CREATE UNIQUE INDEX idx_users_subject_id ON users (subject_id);

-- Drop connections table (auth handles OAuth connections now)
-- Safe to drop: no other tables reference connections
DROP TABLE IF EXISTS connections;

-- Clean up orphaned index from connections table
DROP INDEX IF EXISTS idx_connections_provider;
```

#### Step 1.2: Update Schema

**File:** `apps/blog/app/db/schema.ts`

```typescript
// Add subjectId to users table
export let users = sqliteTable("users", {
	id,
	createdAt,
	updatedAt,
	// Link to auth.sergiodxa.com subject
	subjectId: text("subject_id", { mode: "text", length: UUID_LENGTH }).unique(),
	// Blog-specific authorization (NOT the same as auth app's role)
	role: text("role", { enum: ["guest", "admin"] })
		.notNull()
		.default("guest"),
	// Cached from ID token for display purposes
	email: text("email", { mode: "text", length: 320 }).notNull(),
	avatar: text("avatar", { mode: "text", length: 2048 }).notNull(),
	username: text("username", { mode: "text", length: 39 }).notNull(),
	displayName: text("display_name", { mode: "text", length: 255 }).notNull(),
});

// Remove connections table and connectionsRelation
// Keep usersRelation but remove connections reference
```

### Phase 2: Create Auth Integration

**Priority:** High
**Estimated Effort:** 2 hours

#### Step 2.1: Create ID Token Entity

**File:** `apps/blog/app/entities/id-token.ts`

```typescript
import { JWK, JWT } from "@edgefirst-dev/jwt";
import { env } from "cloudflare:workers";

export default class IdToken extends JWT {
	override get subject() {
		return this.parser.string("sub");
	}

	override get audience() {
		return this.parser.string("aud");
	}

	get name() {
		return this.parser.string("name");
	}

	get email() {
		return this.parser.string("email");
	}

	get picture() {
		return this.parser.string("picture");
	}

	get username() {
		return this.parser.string("preferred_username");
	}

	get emailVerified() {
		return this.parser.boolean("email_verified");
	}
}

export async function verifyIdToken(token: string) {
	return await IdToken.verify(
		token,
		await JWK.importRemote(new URL("https://auth.sergiodxa.com/.well-known/jwks.json"), {
			alg: JWK.Algoritm.ES256,
		}),
		{ audience: env.CLIENT_ID, issuer: "auth.sergiodxa.com" },
	);
}
```

#### Step 2.2: Create Auth Module

**File:** `apps/blog/app/modules/auth.ts`

```typescript
import { env } from "cloudflare:workers";
import { OAuth2Strategy } from "remix-auth-oauth2";
import { Authenticator } from "remix-auth";

type OAuth2Tokens = OAuth2Strategy.VerifyOptions["tokens"];

export function authenticate(request: Request) {
	let url = new URL(request.url);

	let authenticator = new Authenticator<OAuth2Tokens>();
	authenticator.use(
		new OAuth2Strategy(
			{
				clientId: env.CLIENT_ID,
				clientSecret: env.CLIENT_SECRET,
				redirectURI: new URL("/auth/callback", url),
				authorizationEndpoint: new URL("https://auth.sergiodxa.com/authorize"),
				tokenEndpoint: new URL("https://auth.sergiodxa.com/oauth/token"),
				scopes: ["openid", "profile", "email"],
			},
			async ({ tokens }) => tokens,
		),
	);

	return authenticator.authenticate("oauth2", request);
}
```

### Phase 3: Update Session Management

**Priority:** High
**Estimated Effort:** 1 hour

#### Step 3.1: Update User Schema

**File:** `apps/blog/app/middleware/session.ts`

```typescript
// Updated UserSchema - remove githubId and isSponsor
export const UserSchema = z.object({
	id: z.string().uuid(), // Local user/profile ID
	subjectId: z.string().uuid(), // Auth subject ID
	role: z.enum(["admin", "guest"]), // Blog-specific role
	email: z.string().email().max(320),
	avatar: z.string().url().max(2048),
	username: z.string().min(1).max(39),
	displayName: z.string().min(1).max(255),
});
```

### Phase 4: Update Auth Routes

**Priority:** High
**Estimated Effort:** 2 hours

#### Step 4.1: Update Login Route

**File:** `apps/blog/app/routes/_.auth_.login/route.tsx`

No significant changes needed - action still calls `authenticate(request)` which now redirects to auth.sergiodxa.com.

#### Step 4.2: Create Auth Callback Route

**File:** `apps/blog/app/routes/_.auth_.callback/route.tsx`

```typescript
import { eq } from "drizzle-orm";
import { data, href, redirect } from "react-router";
import { OAuth2RequestError } from "remix-auth-oauth2";

import { users } from "~/db/schema";
import { verifyIdToken } from "~/entities/id-token";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { getSession } from "~/middleware/session";
import { authenticate } from "~/modules/auth";
import { generateUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
  try {
    let tokens = await authenticate(request);
    let idToken = await verifyIdToken(tokens.idToken());
    let session = getSession();

    // Find or create local user profile
    let [user] = await db()
      .select()
      .from(users)
      .where(eq(users.subjectId, idToken.subject))
      .limit(1);

    if (!user) {
      // Create new user profile with default guest role
      [user] = await db()
        .insert(users)
        .values({
          id: generateUUID(),
          subjectId: idToken.subject,
          role: "guest",
          email: idToken.email,
          avatar: idToken.picture,
          username: idToken.username,
          displayName: idToken.name,
        })
        .returning();

      logger().info("user.created", { subjectId: idToken.subject });
    } else {
      // Update cached profile data from ID token
      [user] = await db()
        .update(users)
        .set({
          email: idToken.email,
          avatar: idToken.picture,
          username: idToken.username,
          displayName: idToken.name,
        })
        .where(eq(users.id, user.id))
        .returning();
    }

    // Set session
    session.set("user", {
      id: user.id,
      subjectId: user.subjectId,
      role: user.role,
      email: user.email,
      avatar: user.avatar,
      username: user.username,
      displayName: user.displayName,
    });

    logger().info("auth.success", { userId: user.id, subjectId: idToken.subject });

    return redirect(href("/"));
  } catch (error) {
    if (error instanceof OAuth2RequestError) {
      logger().error("auth.oauth_error", {
        code: error.code,
        description: error.description,
      });
      return data(
        { code: error.code, description: error.description },
        { status: 400 },
      );
    }
    throw error;
  }
}

export default function Component({ loaderData }: Route.ComponentProps) {
  if (!loaderData) return null;

  return (
    <main className="mx-auto max-w-screen-sm pt-10">
      <h1 className="text-2xl font-bold">Authentication Error</h1>
      <p>Code: {loaderData.code}</p>
      <p>{loaderData.description}</p>
    </main>
  );
}
```

#### Step 4.3: Delete GitHub Callback Route

**Delete:** `apps/blog/app/routes/_.auth_.github.callback/` directory

### Phase 5: Update Environment Configuration

**Priority:** High
**Estimated Effort:** 30 minutes

#### Step 5.1: Update Environment Variables

**File:** `apps/blog/.env.example`

```bash
# Auth (OAuth client for auth.sergiodxa.com)
CLIENT_ID=
CLIENT_SECRET=

# Session
COOKIE_SESSION_SECRET=

# Remove these:
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
# GH_APP_ID=
# GH_APP_PEM=
```

#### Step 5.2: Update Worker Configuration

**File:** `apps/blog/worker-configuration.d.ts`

```typescript
interface Env {
	// Bindings
	AUTH: KVNamespace;
	DB: D1Database;

	// Auth (centralized)
	CLIENT_ID: string;
	CLIENT_SECRET: string;
	COOKIE_SESSION_SECRET: string;

	// Remove:
	// GITHUB_CLIENT_ID: string;
	// GITHUB_CLIENT_SECRET: string;
	// GH_APP_ID: string;
	// GH_APP_PEM: string;
}
```

### Phase 6: Clean Up UI

**Priority:** Medium
**Estimated Effort:** 30 minutes

#### Step 6.1: Remove Sponsor UI

**File:** `apps/blog/app/routes/_/components/header.tsx`

Remove any references to `user?.isSponsor` and the sponsor link.

### Phase 7: Delete Obsolete Files

**Priority:** Medium
**Estimated Effort:** 15 minutes

**Delete:**

| File                                  | Reason                            |
| ------------------------------------- | --------------------------------- |
| `app/modules/auth.server.ts`          | Replaced by `app/modules/auth.ts` |
| `app/routes/_.auth_.github.callback/` | Replaced by `_.auth_.callback/`   |
| `app/middleware/rolling-cookie.ts`    | Optional - can keep or remove     |

### Phase 8: Register OAuth Client

**Priority:** High
**Estimated Effort:** 15 minutes

Register the blog as an OAuth client in the auth app's database:

```sql
INSERT INTO clients (id, name, secret, redirect_uri, logout_uri, created_at, updated_at)
VALUES (
  '<generate-uuid>',
  'Blog',
  '<generate-and-hash-secret>',
  'https://sergiodxa.com/auth/callback',
  'https://sergiodxa.com/',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

Store the `id` as `CLIENT_ID` and the unhashed secret as `CLIENT_SECRET` in the blog's environment.

## File Changes Summary

### Files to Create

| File                                                    | Purpose                             |
| ------------------------------------------------------- | ----------------------------------- |
| `db/migrations/0002_AddSubjectIdAndDropConnections.sql` | Database migration                  |
| `app/entities/id-token.ts`                              | ID token verification               |
| `app/modules/auth.ts`                                   | OAuth strategy for centralized auth |
| `app/routes/_.auth_.callback/route.tsx`                 | OAuth callback handler              |

### Files to Modify

| File                                  | Changes                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `app/db/schema.ts`                    | Add `subjectId` to users, remove `connections` table                  |
| `app/middleware/session.ts`           | Update `UserSchema` (remove `githubId`, `isSponsor`, add `subjectId`) |
| `app/routes/_.auth_.login/route.tsx`  | Minor updates if needed                                               |
| `app/routes/_.auth_.logout/route.tsx` | No changes needed                                                     |
| `app/routes/_/components/header.tsx`  | Remove sponsor UI                                                     |
| `app/root.tsx`                        | Remove `rollingCookieMiddleware` if deleting that file                |
| `worker-configuration.d.ts`           | Update `Env` interface                                                |
| `.env.example`                        | Update environment variables                                          |

### Files to Delete

| File                                  | Reason                       |
| ------------------------------------- | ---------------------------- |
| `app/modules/auth.server.ts`          | Replaced by centralized auth |
| `app/routes/_.auth_.github.callback/` | Replaced by generic callback |
| `app/middleware/rolling-cookie.ts`    | Optional deletion            |

## Data Flow

### Authentication Flow (After Migration)

```
1. User clicks "Login"
   └─> POST /auth/login
       └─> authenticate(request)
           └─> Redirect to auth.sergiodxa.com/authorize

2. User authenticates at auth.sergiodxa.com
   └─> (GitHub, Google, or email/password)

3. Auth redirects back with authorization code
   └─> GET /auth/callback?code=...&state=...
       └─> Exchange code for tokens at auth.sergiodxa.com/oauth/token
       └─> Verify ID token using JWKS
       └─> Find or create local user profile by subjectId
       └─> Update cached profile data from ID token
       └─> Set session with user data
       └─> Redirect to home
```

### Data Sources

| Data                                  | Source              | Storage                      |
| ------------------------------------- | ------------------- | ---------------------------- |
| Subject ID                            | ID token from auth  | Session + `users.subject_id` |
| Email, Avatar, Username, Display Name | ID token from auth  | Session + `users` (cached)   |
| Role (admin/guest)                    | Local `users` table | Session + D1                 |
| OAuth connections                     | auth.sergiodxa.com  | Auth's D1 (not blog's)       |

## Consequences

### Positive

- **Centralized Identity** - Single source of truth for user identity
- **SSO Ready** - Foundation for single sign-on across apps
- **Provider Flexibility** - New auth providers added to auth app benefit blog automatically
- **Reduced Maintenance** - OAuth implementation maintained in one place
- **Consistent Patterns** - Matches other apps in the monorepo

### Negative

- **User Re-authentication** - Existing users must log in again
- **Additional Latency** - Token verification requires JWKS fetch (can be cached)
- **Dependency** - Blog depends on auth.sergiodxa.com availability
- **Migration Effort** - Code changes and testing required

### Neutral

- **Local Profiles Retained** - Blog still maintains user profiles for blog-specific data
- **Role Separation** - Clear distinction between auth roles and app roles
- **Sponsor Feature Removed** - Can be re-implemented differently if needed

## Rollback Plan

If issues arise, rollback by:

1. Restore deleted files from git
2. Revert schema.ts changes
3. Do NOT run migration rollback (would lose `subject_id` data)
4. Restore environment variables

## Current Progress

- [x] Phase 1: Database Migration
  - [x] Create migration file
  - [x] Update schema
  - [x] Run migration locally (pending deployment)
- [x] Phase 2: Create Auth Integration
  - [x] Create ID token entity
  - [x] Create auth module
- [x] Phase 3: Update Session Management
  - [x] Update user schema
- [x] Phase 4: Update Auth Routes
  - [x] Update login route
  - [x] Create callback route
  - [x] Delete GitHub callback route
- [x] Phase 5: Update Environment Configuration
  - [x] Update .env.example
  - [x] Update worker-configuration.d.ts
- [x] Phase 6: Clean Up UI
  - [x] Remove sponsor UI from header
- [x] Phase 7: Delete Obsolete Files
  - [x] Delete auth.server.ts
  - [x] Delete GitHub callback route
  - [x] Keep rolling-cookie.ts (still useful for session expiry extension)
- [x] Phase 8: Register OAuth Client (Manual)
  - [x] Create client in auth database
  - [x] Configure environment secrets in Cloudflare

## Notes

- The blog's tagged UUID type should continue to work with the new `subjectId` column
- ID token claims are cached in the local `users` table and updated on each login
- The auth app's `role` field is for auth system administration, not for blog authorization
- Consider adding token refresh logic for long-lived sessions in the future
