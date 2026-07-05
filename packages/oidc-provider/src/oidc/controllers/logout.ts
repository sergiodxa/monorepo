import { JWK } from "@edgefirst-dev/jwt";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Client from "../../clients/models/client";
import LogoutUri from "../../clients/models/logout-uri";
import TenantMeta from "../../management/models/tenant-meta";
import Session from "../../oauth/models/session";
import IdToken from "../../oauth/values/id-token";
import routes from "../../routes";
import { reject } from "../../shared/lib/reject";
import SigningKey from "../../signing-keys/models/signing-key";
import Subject from "../../subjects/models/subject";

let LogoutSchema = s.object({
	id_token_hint: s.optional(s.string()),
	post_logout_redirect_uri: s.optional(s.string()),
	client_id: s.optional(s.string()),
	state: s.optional(s.string()),
});

/**
 * OpenID Connect RP-Initiated Logout 1.0 endpoint.
 * Destroys all sessions for the subject identified by the id_token_hint.
 */
export default createAction(
	routes.oidc.logout,
	inject([Database] as const, async (db) => {
		let { request, logger } = getContext();
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
					log.info("Client ID mismatch", { providedClientId: client_id, tokenAudience });
					return reject("invalid_request", "client_id does not match id_token_hint audience");
				}

				clientId = typeof tokenAudience === "string" ? tokenAudience : tokenAudience?.[0];
			} catch {
				log.info("ID token verification failed");
				return reject("invalid_request", "Invalid id_token_hint");
			}
		} else if (client_id) {
			log.info("Processing logout with client_id only", { clientId: client_id });
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

		log.info("Logout successful, showing success page", { subjectId, clientId });

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
	}),
);
