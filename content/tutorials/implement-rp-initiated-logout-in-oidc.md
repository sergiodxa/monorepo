---
title: How to Implement RP-Initiated Logout in OIDC
excerpt: Build an OIDC logout endpoint with id_token_hint and post logout redirect support.
tech: "@edgefirst-dev/jwt@1.0.0" zod@3.0.0
---

When users sign out of your application, they expect to be signed out everywhere. OpenID Connect defines RP-Initiated Logout as a standardized way for relying parties (clients) to request that the OpenID Provider terminate the user's session. Without this, users might think they logged out but remain authenticated at the identity provider, creating confusion and potential security issues.

The OIDC RP-Initiated Logout specification defines how clients redirect users to the provider's logout endpoint, optionally passing the ID token they received during authentication. The provider verifies this token, terminates all sessions for that user, and redirects back to the client. Let's build the `/oidc/logout` endpoint with proper validation and security controls.

## Define the Logout Request Schema

```ts {% path="app/oidc/logout/schema.ts" %}
import { object, optional, string } from "zod";

let LogoutSchema = object({
	id_token_hint: optional(string()),
	post_logout_redirect_uri: optional(string()),
	client_id: optional(string()),
	state: optional(string()),
});
```

The `id_token_hint` is the ID token previously issued to the client. It tells the provider which user to log out and which client is making the request. The `post_logout_redirect_uri` is where to send the user after logout completes. The `client_id` parameter identifies the client when no ID token hint is provided. The `state` parameter is opaque data that gets passed back to the client on redirect.

According to the spec, at least one of `id_token_hint` or `client_id` must be present. The provider needs to know which client is initiating the logout to validate the redirect URI.

## Parse and Validate Request Parameters

```ts {% path="app/oidc/logout/handler.ts" %}
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

export async function handleLogout(request: Request, db: Database) {
	let url = new URL(request.url);
	let params = Object.fromEntries(url.searchParams);

	let result = await validate(params, LogoutSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Invalid parameters");
	}

	let { id_token_hint, post_logout_redirect_uri, client_id, state } = result.data;

	// At least one identifier is required
	if (!id_token_hint && !client_id) {
		return reject("invalid_request", "Either id_token_hint or client_id is required");
	}

	// Continue with logout flow...
}
```

The logout endpoint uses GET requests since it's initiated via a browser redirect. The user's browser navigates to this URL, so the parameters come from the query string rather than a POST body.

## Verify the ID Token Hint

When an ID token hint is provided, verify it was issued by this provider. The token contains the subject (user) and audience (client) claims needed to perform the logout.

```ts {% path="app/oidc/logout/verify.ts" %}
import { JWK } from "@edgefirst-dev/jwt";
import IdToken from "~/tenant/values/id-token";
import SigningKey from "~/tenant/models/signing-key";
import TenantMeta from "~/tenant/models/tenant-meta";

async function verifyIdTokenHint(db: Database, idTokenHint: string, providedClientId?: string) {
	let [issuer, signingKeys] = await Promise.all([TenantMeta.getIssuer(db), SigningKey.getAll(db)]);

	if (!issuer) {
		throw new Error("Issuer not configured");
	}

	if (signingKeys.length === 0) {
		throw new Error("No signing keys available");
	}

	let idToken = await IdToken.verify(idTokenHint, signingKeys, {
		issuer: `https://${issuer}`,
		algorithms: [JWK.Algoritm.ES256],
	});

	let subjectId = idToken.subject;
	let tokenAudience = idToken.audience;

	// If client_id was also provided, it must match the token audience
	if (providedClientId && providedClientId !== tokenAudience) {
		throw new Error("client_id does not match id_token_hint audience");
	}

	let clientId = typeof tokenAudience === "string" ? tokenAudience : tokenAudience?.[0];

	return { subjectId, clientId };
}
```

The verification step is intentionally lenient about token expiration. The spec recommends accepting expired ID tokens for logout since the user might be logging out days or weeks after their last authentication. What matters is that the token was genuinely issued by this provider for this subject.

## Validate the Post Logout Redirect URI

Before redirecting anywhere, verify the redirect URI is registered for this client. Open redirects are a serious security vulnerability.

```ts {% path="app/oidc/logout/validate-redirect.ts" %}
import Client from "~/tenant/models/client";
import LogoutUri from "~/tenant/models/client/logout-uri";

async function validateRedirectUri(db: Database, clientId: string, postLogoutRedirectUri: string) {
	let client = await Client.show(db, clientId);
	if (!client) {
		throw new Error("Client not found");
	}

	let logoutUris = await LogoutUri.list(db, clientId);
	let isValidUri = logoutUris.some((uri) => uri.uri === postLogoutRedirectUri);

	if (!isValidUri) {
		throw new Error("Invalid post_logout_redirect_uri");
	}

	return true;
}
```

The redirect URI validation uses exact string matching. Unlike OAuth2 redirect URIs where some implementations allow prefix matching, logout redirect URIs should match exactly. This prevents attackers from registering `https://example.com` and redirecting to `https://example.com.evil.com`.

Clients must pre-register their logout redirect URIs, just like they register OAuth2 redirect URIs. The `LogoutUri` model stores these with a type field that distinguishes post-logout redirects from backchannel and frontchannel logout endpoints.

```ts {% path="app/tenant/models/client/logout-uri.ts" %}
static table = createTable({
  name: "client_logout_uris",
  primaryKey: ["id"],
  columns: {
    id: s.string(),
    client_id: s.string(),
    uri: s.string(),
    type: s.enum_(["post_logout", "backchannel", "frontchannel"]),
    session_required: s.defaulted(s.boolean(), false),
    environment: s.nullable(s.string()),
    created_at: s.string(),
  },
});
```

## Terminate User Sessions

Once you've identified the user and validated the request, destroy all their sessions.

```ts {% path="app/oidc/logout/terminate.ts" %}
import Session from "~/tenant/models/session";
import Subject from "~/tenant/models/subject";

async function terminateSessions(db: Database, subjectId: string) {
	let subject = await Subject.show(db, subjectId);

	if (subject) {
		await Session.destroyBySubject(db, subject.id);
		return true;
	}

	return false;
}
```

The `destroyBySubject` method deletes all sessions for a user, not just the one associated with the current client.

```ts {% path="app/tenant/models/session.ts" %}
static async destroyBySubject(db: Database, subjectId: string) {
  let sessions = await db.findMany(Session.table, {
    where: { subject_id: subjectId },
  });

  if (sessions.length === 0) return 0;

  await Promise.all(
    sessions.map((session) => db.delete(Session.table, { id: session.id }))
  );

  return sessions.length;
}
```

This behavior is intentional for single sign-out. When a user logs out from one application, they expect to be logged out everywhere.

## Handle the Redirect Response

After terminating sessions, redirect back to the client if a valid redirect URI was provided.

```ts {% path="app/oidc/logout/response.ts" %}
function createLogoutResponse(postLogoutRedirectUri?: string, state?: string) {
	if (postLogoutRedirectUri) {
		let redirectUrl = new URL(postLogoutRedirectUri);
		if (state) {
			redirectUrl.searchParams.set("state", state);
		}
		return Response.redirect(redirectUrl.toString(), 302);
	}

	// No redirect URI, show a confirmation page
	return new Response(
		`<!DOCTYPE html>
<html>
<head><title>Logged Out</title></head>
<body>
<h1>Successfully logged out</h1>
<p>You have been logged out of the application.</p>
</body>
</html>`,
		{
			status: 200,
			headers: { "Content-Type": "text/html" },
		},
	);
}
```

The state parameter passes through to the redirect URL unchanged. Clients use this to restore application state after logout.

When no redirect URI is provided, display a simple confirmation page. This happens when clients initiate logout without registering a post-logout redirect or when they simply want to end the session without returning to their application.

## Put It All Together

```ts {% path="app/oidc/logout/route.ts" %}
import { JWK } from "@edgefirst-dev/jwt";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import { reject } from "~/lib/reject";
import Client from "~/tenant/models/client";
import LogoutUri from "~/tenant/models/client/logout-uri";
import Session from "~/tenant/models/session";
import SigningKey from "~/tenant/models/signing-key";
import Subject from "~/tenant/models/subject";
import TenantMeta from "~/tenant/models/tenant-meta";
import IdToken from "~/tenant/values/id-token";

let LogoutSchema = s.object({
	id_token_hint: s.optional(s.string()),
	post_logout_redirect_uri: s.optional(s.string()),
	client_id: s.optional(s.string()),
	state: s.optional(s.string()),
});

export default action<"GET", "/oidc/logout">(async ({ db, request, logger }) => {
	let log = logger.loader("/oidc/logout");

	let url = new URL(request.url);
	let params = Object.fromEntries(url.searchParams);

	let result = await validate(params, LogoutSchema);
	if (isFailure(result)) {
		log.info("Invalid logout parameters");
		return reject("invalid_request", "Invalid parameters");
	}

	let { id_token_hint, post_logout_redirect_uri, client_id, state } = result.data;

	let subjectId: string | undefined;
	let clientId: string | undefined;

	if (id_token_hint) {
		log.info("Processing logout with id_token_hint");

		let [issuer, signingKeys] = await Promise.all([
			TenantMeta.getIssuer(db),
			SigningKey.getAll(db),
		]);

		if (!issuer) {
			log.error("Issuer not configured");
			return reject("server_error", "Issuer not configured");
		}

		if (signingKeys.length === 0) {
			log.error("No signing keys available");
			return reject("server_error", "No signing keys available");
		}

		try {
			let idToken = await IdToken.verify(id_token_hint, signingKeys, {
				issuer: `https://${issuer}`,
				algorithms: [JWK.Algoritm.ES256],
			});

			subjectId = idToken.subject;
			let tokenAudience = idToken.audience;

			log.info("ID token verified", { subjectId, clientId: tokenAudience });

			if (client_id && client_id !== tokenAudience) {
				log.info("Client ID mismatch", {
					providedClientId: client_id,
					tokenAudience,
				});
				return reject("invalid_request", "client_id does not match id_token_hint audience");
			}

			clientId = typeof tokenAudience === "string" ? tokenAudience : tokenAudience?.[0];
		} catch {
			log.info("ID token verification failed");
			return reject("invalid_request", "Invalid id_token_hint");
		}
	} else if (client_id) {
		log.info("Processing logout with client_id only", {
			clientId: client_id,
		});
		clientId = client_id;
	} else {
		log.info("Missing required parameters for logout");
		return reject("invalid_request", "Either id_token_hint or client_id is required");
	}

	let clientPromise = clientId ? Client.show(db, clientId) : Promise.resolve(null);
	let logoutUrisPromise =
		post_logout_redirect_uri && clientId ? LogoutUri.list(db, clientId) : Promise.resolve([]);
	let subjectPromise = subjectId ? Subject.show(db, subjectId) : Promise.resolve(null);

	let [client, logoutUris, subject] = await Promise.all([
		clientPromise,
		logoutUrisPromise,
		subjectPromise,
	]);

	if (clientId && !client) {
		log.info("Client not found", { clientId });
		return reject("invalid_client", "Client not found");
	}

	if (post_logout_redirect_uri && clientId) {
		let isValidUri = logoutUris.some((uri) => uri.uri === post_logout_redirect_uri);
		if (!isValidUri) {
			log.info("Invalid post_logout_redirect_uri", { clientId });
			return reject("invalid_request", "Invalid post_logout_redirect_uri");
		}
	}

	if (subjectId && subject) {
		await Session.destroyBySubject(db, subject.id);
		log.info("Sessions destroyed for subject", { subjectId: subject.id });
	} else if (subjectId) {
		log.info("Subject not found for session destruction", { subjectId });
	}

	if (post_logout_redirect_uri) {
		let redirectUrl = new URL(post_logout_redirect_uri);
		if (state) {
			redirectUrl.searchParams.set("state", state);
		}
		log.info("Logout successful, redirecting", { subjectId, clientId });
		return Response.redirect(redirectUrl.toString(), 302);
	}

	log.info("Logout successful, showing success page", {
		subjectId,
		clientId,
	});

	return new Response(
		`<!DOCTYPE html>
<html>
<head><title>Logged Out</title></head>
<body>
<h1>Successfully logged out</h1>
<p>You have been logged out of the application.</p>
</body>
</html>`,
		{
			status: 200,
			headers: { "Content-Type": "text/html" },
		},
	);
});
```

The implementation uses `Promise.all` to fetch the client, logout URIs, and subject in parallel. This reduces latency compared to sequential database calls.

## Implement Client Side Logout

On the client side, implementing logout involves redirecting to the provider's logout endpoint with the appropriate parameters.

```ts {% path="app/auth/logout.ts" %}
function initiateLogout(idToken: string, state?: string) {
	let logoutUrl = new URL("https://auth.example.com/oidc/logout");

	logoutUrl.searchParams.set("id_token_hint", idToken);
	logoutUrl.searchParams.set("post_logout_redirect_uri", "https://app.example.com/logged-out");

	if (state) {
		logoutUrl.searchParams.set("state", state);
	}

	// Clear local session before redirecting
	clearLocalSession();

	// Redirect to the provider
	window.location.href = logoutUrl.toString();
}
```

The client should clear its own session state before redirecting to prevent the user from being able to use the back button to access the application.

## Security Considerations

Never redirect to unregistered URIs. Open redirect vulnerabilities allow attackers to phish users by making it appear they're logging out of a legitimate application.

Log all logout attempts for security auditing. Unusual patterns might indicate account compromise.

Consider implementing logout confirmation pages for sensitive applications. A malicious site could embed an image tag pointing to your logout endpoint, logging users out without their knowledge. The confirmation page requires explicit user action.

The ID token hint validation intentionally accepts expired tokens. If you reject expired tokens, users who haven't authenticated in a while cannot use single logout. The signature verification ensures the token was issued by your provider, which is sufficient for logout purposes.

## Final Thoughts

RP-Initiated Logout completes the authentication lifecycle. Users expect that logging out of one application signs them out everywhere, and this endpoint makes that possible. The implementation balances security (validating redirect URIs, verifying token signatures) with usability (accepting expired tokens, providing confirmation pages).

For production deployments, consider adding [backchannel logout](/tutorials/implement-oidc-backchannel-logout) to notify other clients when a user logs out. This provides immediate session termination across all applications rather than waiting for token expiration.
