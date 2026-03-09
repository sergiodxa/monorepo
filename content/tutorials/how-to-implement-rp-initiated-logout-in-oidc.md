---
title: How to Implement RP-Initiated Logout in OIDC
excerpt: Build an OIDC logout endpoint that verifies the client and safely redirects after sign out.
tech: "@edgefirst-dev/jwt@1.0.0"
---

Users expect sign out to end their session in your app and at the OpenID Provider. RP-Initiated Logout gives you a standard way to do that by redirecting the browser to a logout endpoint that knows which client started the request.

In this tutorial, you will build an `/oidc/logout` endpoint that validates the request, verifies `id_token_hint`, destroys the subject's sessions, and redirects back to a registered `post_logout_redirect_uri`.

## Create the Logout Schema

```ts {% path="app/oidc/logout/schema.ts" %}
import * as s from "remix/data-schema";

export let LogoutSchema = s.object({
	id_token_hint: s.optional(s.string()),
	post_logout_redirect_uri: s.optional(s.string()),
	client_id: s.optional(s.string()),
	state: s.optional(s.string()),
});
```

Start by parsing the query string into a known shape. This keeps the route module focused on the logout flow instead of ad hoc parameter checks.

## Add the Route Module

```ts {% path="app/routes/oidc.logout.ts" %}
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

import action from "~/lib/action";
import { reject } from "~/lib/reject";
import { LogoutSchema } from "~/oidc/logout/schema";

export default action<"GET", "/oidc/logout">(async ({ request }) => {
	let url = new URL(request.url);
	let params = Object.fromEntries(url.searchParams);

	let result = await validate(params, LogoutSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Invalid parameters");
	}

	let { id_token_hint, client_id } = result.data;

	if (!id_token_hint && !client_id) {
		return reject("invalid_request", "Either id_token_hint or client_id is required");
	}

	return new Response(null, { status: 204 });
});
```

This gives you a valid endpoint before adding the rest of the behavior. The key rule is that the request must identify the client with `id_token_hint`, `client_id`, or both.

## Verify the ID Token Hint

```ts {% path="app/oidc/logout/verify-id-token-hint.ts" %}
import { JWK } from "@edgefirst-dev/jwt";

import SigningKey from "~/tenant/models/signing-key";
import TenantMeta from "~/tenant/models/tenant-meta";
import IdToken from "~/tenant/values/id-token";

interface VerifiedLogoutRequest {
	subjectId: string;
	clientId: string | undefined;
}

export async function verifyIdTokenHint(
	db: Database,
	idTokenHint: string,
	providedClientId?: string,
): Promise<VerifiedLogoutRequest | null> {
	let [issuer, signingKeys] = await Promise.all([TenantMeta.getIssuer(db), SigningKey.getAll(db)]);

	if (!issuer || signingKeys.length === 0) {
		return null;
	}

	let idToken = await IdToken.verify(idTokenHint, signingKeys, {
		issuer: `https://${issuer}`,
		algorithms: [JWK.Algoritm.ES256],
	}).catch(() => null);

	if (!idToken) {
		return null;
	}

	let audience = idToken.audience;
	let clientId = typeof audience === "string" ? audience : audience?.[0];

	if (providedClientId && providedClientId !== clientId) {
		return null;
	}

	return {
		subjectId: idToken.subject,
		clientId,
	};
}
```

The ID token gives you the `sub` and the client audience in one step. Accepting an expired token can still be reasonable here because logout needs proof that the token was issued by your provider, not proof that it can still authenticate requests.

## Validate the Redirect URI

```ts {% path="app/oidc/logout/validate-post-logout-redirect-uri.ts" %}
import Client from "~/tenant/models/client";
import LogoutUri from "~/tenant/models/client/logout-uri";

export async function validatePostLogoutRedirectUri(
	db: Database,
	clientId: string,
	postLogoutRedirectUri: string,
) {
	let client = await Client.show(db, clientId);
	if (!client) {
		return false;
	}

	let logoutUris = await LogoutUri.list(db, clientId);
	return logoutUris.some((uri) => uri.uri === postLogoutRedirectUri);
}
```

Use exact matching against registered logout URIs. That prevents open redirects while still allowing the client to control where the browser lands after logout.

## Destroy the Subject's Sessions

```ts {% path="app/oidc/logout/destroy-subject-sessions.ts" %}
import Session from "~/tenant/models/session";
import Subject from "~/tenant/models/subject";

export async function destroySubjectSessions(db: Database, subjectId: string) {
	let subject = await Subject.show(db, subjectId);
	if (!subject) {
		return;
	}

	await Session.destroyBySubject(db, subject.id);
}
```

This keeps single sign out simple. Once you know the subject, you can remove every active session tied to that identity.

## Finish the Logout Route

```ts {% path="app/routes/oidc.logout.ts" %}
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

import action from "~/lib/action";
import { reject } from "~/lib/reject";
import { destroySubjectSessions } from "~/oidc/logout/destroy-subject-sessions";
import { LogoutSchema } from "~/oidc/logout/schema";
import { validatePostLogoutRedirectUri } from "~/oidc/logout/validate-post-logout-redirect-uri";
import { verifyIdTokenHint } from "~/oidc/logout/verify-id-token-hint";

export default action<"GET", "/oidc/logout">(async ({ db, logger, request }) => {
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
	let clientId = client_id;

	if (id_token_hint) {
		let verifiedRequest = await verifyIdTokenHint(db, id_token_hint, client_id);
		if (!verifiedRequest) {
			log.info("Invalid id_token_hint");
			return reject("invalid_request", "Invalid id_token_hint");
		}

		subjectId = verifiedRequest.subjectId;
		clientId = verifiedRequest.clientId;
	}

	if (!clientId) {
		log.info("Missing logout client identifier");
		return reject("invalid_request", "Either id_token_hint or client_id is required");
	}

	if (post_logout_redirect_uri) {
		let isValidRedirectUri = await validatePostLogoutRedirectUri(
			db,
			clientId,
			post_logout_redirect_uri,
		);

		if (!isValidRedirectUri) {
			log.info("Invalid post_logout_redirect_uri", { clientId });
			return reject("invalid_request", "Invalid post_logout_redirect_uri");
		}
	}

	if (subjectId) {
		await destroySubjectSessions(db, subjectId);
		log.info("Destroyed subject sessions", { clientId, subjectId });
	}

	if (post_logout_redirect_uri) {
		let redirectUrl = new URL(post_logout_redirect_uri);
		if (state) {
			redirectUrl.searchParams.set("state", state);
		}

		return Response.redirect(redirectUrl.toString(), 302);
	}

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

Now the route handles the full RP-Initiated Logout flow. The browser arrives with query parameters, the provider validates them, removes sessions, and either redirects or shows a confirmation page.

## Send the User to the Logout Endpoint

```ts {% path="app/auth/logout.ts" %}
export function initiateLogout(idToken: string, state?: string) {
	let logoutUrl = new URL("https://auth.example.com/oidc/logout");

	logoutUrl.searchParams.set("id_token_hint", idToken);
	logoutUrl.searchParams.set("post_logout_redirect_uri", "https://app.example.com/logged-out");

	if (state) {
		logoutUrl.searchParams.set("state", state);
	}

	clearLocalSession();
	window.location.href = logoutUrl.toString();
}
```

The relying party still clears its local session before redirecting away. That avoids leaving the app in a signed in state while the provider logout is still in flight.

## Final Thoughts

You now have a logout endpoint that matches the OIDC RP-Initiated Logout flow and produces a practical result: users sign out at the provider and return safely to the client. You can extend this further by adding [backchannel logout](/tutorials/implement-oidc-backchannel-logout) for clients that need server to server session invalidation.
