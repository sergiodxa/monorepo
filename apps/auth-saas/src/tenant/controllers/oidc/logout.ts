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

export default action<"GET", "/oidc/logout">(async ({ db, request }) => {
	let url = new URL(request.url);
	let params = Object.fromEntries(url.searchParams);

	let result = await validate(params, LogoutSchema);
	if (isFailure(result)) {
		return reject("invalid_request", "Invalid parameters");
	}

	let { id_token_hint, post_logout_redirect_uri, client_id, state } = result.data;

	let subjectId: string | undefined;
	let clientId: string | undefined;

	// Get issuer
	let issuer = await TenantMeta.getIssuer(db);
	if (!issuer) {
		return reject("server_error", "Issuer not configured");
	}

	// If id_token_hint is provided, extract subject and validate
	if (id_token_hint) {
		let signingKeys = await SigningKey.getAll(db);
		if (signingKeys.length === 0) {
			return reject("server_error", "No signing keys available");
		}

		try {
			let idToken = await IdToken.verify(id_token_hint, signingKeys, {
				issuer: `https://${issuer}`,
				algorithms: [JWK.Algoritm.ES256],
			});

			subjectId = idToken.subject;
			let tokenAudience = idToken.audience;

			// Validate client_id matches if provided
			if (client_id && client_id !== tokenAudience) {
				return reject("invalid_request", "client_id does not match id_token_hint audience");
			}

			clientId = typeof tokenAudience === "string" ? tokenAudience : tokenAudience?.[0];
		} catch {
			return reject("invalid_request", "Invalid id_token_hint");
		}
	} else if (client_id) {
		// Without id_token_hint, client_id must be provided
		clientId = client_id;
	} else {
		return reject("invalid_request", "Either id_token_hint or client_id is required");
	}

	// Validate client exists
	let client = clientId ? await Client.show(db, { id: clientId }) : null;
	if (clientId && !client) {
		return reject("invalid_client", "Client not found");
	}

	// Validate post_logout_redirect_uri if provided
	if (post_logout_redirect_uri && clientId) {
		let logoutUris = await LogoutUri.list(db, clientId);
		let isValidUri = logoutUris.some((uri) => uri.uri === post_logout_redirect_uri);
		if (!isValidUri) {
			return reject("invalid_request", "Invalid post_logout_redirect_uri");
		}
	}

	// Delete sessions for the subject
	if (subjectId) {
		let subject = await Subject.show(db, { id: subjectId });
		if (subject) {
			await Session.destroyBySubject(db, subject.id);
		}
	}

	// Redirect to post_logout_redirect_uri if provided, otherwise show success message
	if (post_logout_redirect_uri) {
		let redirectUrl = new URL(post_logout_redirect_uri);
		if (state) {
			redirectUrl.searchParams.set("state", state);
		}
		return Response.redirect(redirectUrl.toString(), 302);
	}

	// No redirect URI - return success response
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
