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

	// If id_token_hint is provided, fetch issuer and signing keys in parallel, then extract subject
	if (id_token_hint) {
		log.info("Processing logout with id_token_hint");

		// Fetch issuer and signing keys in parallel for better performance
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

			// Validate client_id matches if provided
			if (client_id && client_id !== tokenAudience) {
				log.info("Client ID mismatch", { providedClientId: client_id, tokenAudience });
				return reject("invalid_request", "client_id does not match id_token_hint audience");
			}

			clientId = typeof tokenAudience === "string" ? tokenAudience : tokenAudience?.[0];
		} catch {
			log.info("ID token verification failed");
			return reject("invalid_request", "Invalid id_token_hint");
		}
	} else if (client_id) {
		// Without id_token_hint, client_id must be provided
		log.info("Processing logout with client_id only", { clientId: client_id });
		clientId = client_id;
	} else {
		log.info("Missing required parameters for logout");
		return reject("invalid_request", "Either id_token_hint or client_id is required");
	}

	// Fetch client, logout URIs (if needed), and subject (if needed) in parallel
	let clientPromise = clientId ? Client.show(db, clientId) : Promise.resolve(null);
	let logoutUrisPromise =
		post_logout_redirect_uri && clientId ? LogoutUri.list(db, clientId) : Promise.resolve([]);
	let subjectPromise = subjectId ? Subject.show(db, subjectId) : Promise.resolve(null);

	let [client, logoutUris, subject] = await Promise.all([
		clientPromise,
		logoutUrisPromise,
		subjectPromise,
	]);

	// Validate client exists
	if (clientId && !client) {
		log.info("Client not found", { clientId });
		return reject("invalid_client", "Client not found");
	}

	// Validate post_logout_redirect_uri if provided
	if (post_logout_redirect_uri && clientId) {
		let isValidUri = logoutUris.some((uri) => uri.uri === post_logout_redirect_uri);
		if (!isValidUri) {
			log.info("Invalid post_logout_redirect_uri", { clientId });
			return reject("invalid_request", "Invalid post_logout_redirect_uri");
		}
	}

	// Delete sessions for the subject
	if (subjectId && subject) {
		await Session.destroyBySubject(db, subject.id);
		log.info("Sessions destroyed for subject", { subjectId: subject.id });
	} else if (subjectId) {
		log.info("Subject not found for session destruction", { subjectId });
	}

	// Redirect to post_logout_redirect_uri if provided, otherwise show success message
	if (post_logout_redirect_uri) {
		let redirectUrl = new URL(post_logout_redirect_uri);
		if (state) {
			redirectUrl.searchParams.set("state", state);
		}
		log.info("Logout successful, redirecting", { subjectId, clientId });
		return Response.redirect(redirectUrl.toString(), 302);
	}

	log.info("Logout successful, showing success page", { subjectId, clientId });

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
