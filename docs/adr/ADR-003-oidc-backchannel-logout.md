# ADR-003: OIDC Backchannel Logout

## Status

**Deferred** - 2026-02-18

## Background

ADR-002 implements OIDC RP-Initiated Logout, where client apps redirect users to the auth server to log out. This works well for most cases but has a limitation: if a user has multiple apps open in different tabs, logging out of one app doesn't immediately invalidate sessions in the other tabs until the user interacts with them.

Backchannel Logout is an OIDC specification that allows the auth server to proactively notify all client apps when a user logs out, enabling immediate session revocation across all apps.

## Context

### Current State (After ADR-002)

With RP-Initiated Logout:

1. User logs out of App A
2. App A redirects to auth server
3. Auth server revokes user's session
4. Auth server redirects back to App A
5. App B (open in another tab) still has a valid local session until:
   - User interacts with App B (triggers session validation)
   - Session cookie expires
   - User manually refreshes

### Desired Future State

With Backchannel Logout:

1. User logs out of App A
2. App A redirects to auth server
3. Auth server revokes user's session
4. Auth server notifies App B (and all other apps) via HTTP POST
5. App B immediately revokes the user's local session
6. Auth server redirects back to App A
7. If user switches to App B tab, they're already logged out

## Decision

Defer implementation of Backchannel Logout until there's a clear need. Document the implementation plan here for future reference.

### Prerequisites

Before implementing Backchannel Logout, the following must be in place:

1. **Server-side session storage**: Client apps must store sessions server-side (D1, KV, or similar) with the ability to query and revoke by subject ID
2. **Client registration for logout URI**: Auth server must track `backchannel_logout_uri` for each client
3. **Grants tracking**: Auth server must know which clients a user has active sessions with (partially implemented via `grants` table)

### Implementation Plan

#### Phase 1: Database Schema Changes

**Auth Server (`apps/auth`)**

Add `backchannel_logout_uri` to clients table:

```sql
ALTER TABLE clients ADD COLUMN backchannel_logout_uri TEXT;
```

Update schema:

```typescript
// apps/auth/db/schema.ts
export const clients = sqliteTable("clients", {
	// ... existing fields
	backchannelLogoutUri: text("backchannel_logout_uri"),
});
```

**Client Apps**

Add server-side session storage with subject ID tracking:

```typescript
// Example: apps/uptime/db/schema.ts
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // session ID (from cookie)
  subjectId: text("subject_id").notNull(), // auth server subject ID
  data: text("data").notNull(), // encrypted session data
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

// Index for efficient lookup by subject
CREATE INDEX idx_sessions_subject_id ON sessions(subject_id);
```

#### Phase 2: Logout Token Entity

Create a Logout Token entity following the OIDC spec:

```typescript
// apps/auth/app/entities/logout-token.ts
import { JWK, JWT } from "@edgefirst-dev/jwt";

interface LogoutTokenPayload {
	iss: string; // Issuer (auth server)
	sub: string; // Subject (user ID)
	aud: string; // Audience (client ID)
	iat: number; // Issued at
	jti: string; // Unique token ID (prevents replay)
	events: {
		"http://schemas.openid.net/event/backchannel-logout": {};
	};
	sid?: string; // Optional: specific session ID
}

export class LogoutToken {
	constructor(private payload: LogoutTokenPayload) {}

	static async create(
		signingKey: JWK.PrivateKey,
		payload: Omit<LogoutTokenPayload, "iat" | "jti">,
	): Promise<string> {
		return await JWT.sign(
			{
				...payload,
				iat: Math.floor(Date.now() / 1000),
				jti: crypto.randomUUID(),
			},
			signingKey,
			{ algorithm: JWK.Algoritm.ES256 },
		);
	}

	static async verify(
		token: string,
		keys: JWK.KeyPair[],
		options: { issuer: string; audience: string },
	): Promise<LogoutToken> {
		let payload = await JWT.verify<LogoutTokenPayload>(token, keys, {
			issuer: options.issuer,
			audience: options.audience,
			algorithms: [JWK.Algoritm.ES256],
		});

		// Validate required claims
		if (!payload.events?.["http://schemas.openid.net/event/backchannel-logout"]) {
			throw new Error("Missing backchannel logout event");
		}

		return new LogoutToken(payload);
	}

	get subject(): string {
		return this.payload.sub;
	}

	get sessionId(): string | undefined {
		return this.payload.sid;
	}
}
```

#### Phase 3: Auth Server Logout Notification Service

```typescript
// apps/auth/app/services/backchannel-logout.ts
import { db } from "~/middleware/drizzle";
import Client from "~/models/client";
import Grant from "~/models/grant";
import { LogoutToken } from "~/entities/logout-token";

interface NotificationResult {
	clientId: string;
	success: boolean;
	error?: string;
}

export async function notifyClientsOfLogout(
	subjectId: string,
	signingKey: JWK.PrivateKey,
	issuer: string,
): Promise<NotificationResult[]> {
	// Find all clients the user has granted access to
	let grants = await Grant.findBySubjectId(db(), subjectId);
	let results: NotificationResult[] = [];

	for (let grant of grants) {
		let client = await Client.findById(db(), grant.clientId);

		// Skip clients without backchannel logout configured
		if (!client?.backchannelLogoutUri) {
			continue;
		}

		try {
			let logoutToken = await LogoutToken.create(signingKey, {
				iss: issuer,
				sub: subjectId,
				aud: client.id,
				events: {
					"http://schemas.openid.net/event/backchannel-logout": {},
				},
			});

			let response = await fetch(client.backchannelLogoutUri, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `logout_token=${encodeURIComponent(logoutToken)}`,
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			results.push({ clientId: client.id, success: true });
		} catch (error) {
			results.push({
				clientId: client.id,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return results;
}
```

#### Phase 4: Client App Backchannel Logout Endpoint

```typescript
// apps/uptime/app/routes/backchannel-logout.tsx
import { badRequest, ok } from "@pkg/response";
import { LogoutToken } from "~/entities/logout-token";
import Session from "~/models/session";
import { env } from "cloudflare:workers";

export async function action({ request }: Route.ActionArgs) {
	// Only accept POST
	if (request.method !== "POST") {
		return new Response(null, { status: 405 });
	}

	// Extract logout_token from form body
	let formData = await request.formData();
	let token = formData.get("logout_token");

	if (typeof token !== "string") {
		return badRequest({ error: "Missing logout_token" });
	}

	try {
		// Verify the logout token
		let logoutToken = await LogoutToken.verify(token, await getAuthServerJWKS(), {
			issuer: "auth.sergiodxa.com",
			audience: env.CLIENT_ID,
		});

		// Revoke all sessions for this subject
		await Session.deleteBySubjectId(db(), logoutToken.subject);

		return ok({});
	} catch (error) {
		return badRequest({ error: "Invalid logout_token" });
	}
}

async function getAuthServerJWKS() {
	return await JWK.importRemote(new URL("https://auth.sergiodxa.com/.well-known/jwks.json"), {
		alg: JWK.Algoritm.ES256,
	});
}
```

#### Phase 5: Integrate with Auth Server Logout Flow

Update the OIDC logout route to send backchannel notifications:

```typescript
// apps/auth/app/routes/oidc.logout.tsx
import { notifyClientsOfLogout } from "~/services/backchannel-logout";

export async function loader({ request, context }: Route.LoaderArgs) {
	// ... existing logout logic ...

	// After revoking session, notify clients
	let notifications = await notifyClientsOfLogout(
		result.subjectId,
		await getSigningKey(),
		"auth.sergiodxa.com",
	);

	// Log results (don't block on failures)
	for (let notification of notifications) {
		if (notification.success) {
			logger.info("backchannel_logout_success", { clientId: notification.clientId });
		} else {
			logger.warn("backchannel_logout_failed", {
				clientId: notification.clientId,
				error: notification.error,
			});
		}
	}

	// ... redirect to post_logout_redirect_uri ...
}
```

#### Phase 6: Admin UI for Backchannel Logout URI

Add field to client create/edit forms in the admin panel to configure `backchannel_logout_uri`.

### Queue-Based Notification (Optional Enhancement)

For better reliability, use Cloudflare Queues to handle notifications asynchronously with retries:

```typescript
// apps/auth/app/services/backchannel-logout.ts
export async function queueBackchannelLogout(
  queue: Queue,
  subjectId: string
) {
  await queue.send({
    type: "backchannel_logout",
    subjectId,
    timestamp: Date.now(),
  });
}

// In queue consumer
export async function handleBackchannelLogout(message: BackchannelLogoutMessage) {
  let results = await notifyClientsOfLogout(message.subjectId, ...);

  // Retry failed notifications
  let failures = results.filter(r => !r.success);
  if (failures.length > 0 && message.retryCount < 3) {
    await queue.send({
      ...message,
      retryCount: (message.retryCount || 0) + 1,
    });
  }
}
```

## Consequences

### Positive

- **Immediate logout**: All apps are notified instantly when user logs out
- **Better security**: No window where revoked sessions are still valid
- **Works with background tabs**: Apps don't need user interaction to log out
- **OIDC compliant**: Follows the OIDC Backchannel Logout 1.0 specification

### Negative

- **Complexity**: Significant implementation effort across all apps
- **Infrastructure**: Requires server-side session storage in client apps
- **Reliability**: Network failures can delay logout notifications
- **Latency**: Adds HTTP calls to the logout flow (can be mitigated with queues)

### Neutral

- **Database growth**: Session tables in client apps need periodic cleanup
- **Monitoring**: Need to track backchannel notification success rates

## When to Implement

Consider implementing Backchannel Logout when:

1. **Security requirements increase**: Handling sensitive data that requires immediate session revocation
2. **Multi-app usage grows**: Users frequently have multiple apps open simultaneously
3. **Long session lifetimes**: Sessions last days or weeks, increasing the risk window
4. **Compliance requirements**: Regulations require immediate logout capability

## Alternatives

### 1. Session Polling

Client apps periodically check with auth server if the session is still valid.

**Pros**: Simpler than backchannel logout
**Cons**: Not immediate, adds load to auth server

### 2. WebSocket/SSE

Auth server pushes logout events to connected clients via WebSocket or Server-Sent Events.

**Pros**: Real-time, bidirectional
**Cons**: Requires persistent connections, more complex infrastructure

### 3. Short Session Lifetimes

Keep sessions very short (e.g., 15 minutes) so revoked sessions expire quickly.

**Pros**: Simple, no additional infrastructure
**Cons**: Poor UX (frequent re-authentication), doesn't solve the problem

## References

- [OIDC Backchannel Logout 1.0](https://openid.net/specs/openid-connect-backchannel-1_0.html)
- [OIDC RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
- [ADR-002: SSO Logout with ID Token Hint](./ADR-002-sso-logout-with-id-token-hint.md)
