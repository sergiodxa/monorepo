/**
 * OpenID Connect RP-Initiated Logout endpoint controller (RP-Initiated Logout 1.0).
 *
 * Identifies the subject from the `id_token_hint` (or client from `client_id`),
 * destroys all of the subject's sessions, and either redirects to a validated
 * `post_logout_redirect_uri` or renders a logged-out page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "../../clients/models/client.js";
import LogoutUri from "../../clients/models/logout-uri.js";
import TenantMeta from "../../management/models/tenant-meta.js";
import Session from "../../oauth/models/session.js";
import IdToken from "../../oauth/values/id-token.js";
import routes from "../../routes.js";
import { reject } from "../../shared/lib/reject.js";
import SigningKey from "../../signing-keys/models/signing-key.js";
import Subject from "../../subjects/models/subject.js";

let LogoutSchema = s.object({
	id_token_hint: s.optional(s.string()),
	post_logout_redirect_uri: s.optional(s.string()),
	client_id: s.optional(s.string()),
	state: s.optional(s.string()),
});

/**
 * OpenID Connect RP-Initiated Logout 1.0 endpoint.
 * Destroys all sessions for the subject identified by the id_token_hint.
 * @returns A redirect `Response` to the post-logout URI, an HTML logged-out page, or an OAuth error `Response`.
 */
export default createAction(
	routes.oidc.logout,
	inject([Database] as const, async (db) => {
		let { request, log } = getContext();

		let url = new URL(request.url);
		let params = Object.fromEntries(url.searchParams);

		let result = await validate(params, LogoutSchema);
		if (isFailure(result)) {
			log.warn("oidc.logout.invalid_params");
			return reject("invalid_request", "Invalid parameters");
		}

		let { id_token_hint, post_logout_redirect_uri, client_id, state } = result.data;

		let subjectId: string | undefined;
		let clientId: string | undefined;

		if (id_token_hint) {
			log.set({ oidc: { logout_hint: "id_token" } });

			let [issuer, signingKeys] = await Promise.all([
				TenantMeta.getIssuer(db),
				SigningKey.getAll(db),
			]);

			if (!issuer) {
				log.fail(new Error("Issuer not configured"));
				return reject("server_error", "Issuer not configured");
			}

			if (signingKeys.length === 0) {
				log.fail(new Error("No signing keys available"));
				return reject("server_error", "No signing keys available");
			}

			try {
				let idToken = await IdToken.verify(id_token_hint, signingKeys, {
					issuer: `https://${issuer}`,
					algorithms: [JWK.Algorithm.ES256],
				});

				subjectId = idToken.subject;
				let tokenAudience = idToken.audience;

				log.set({ subject: { id: subjectId } });
				log.note("oidc.logout.id_token_verified");

				if (client_id && client_id !== tokenAudience) {
					log.warn("client.id_mismatch", {
						provided_client_id: client_id,
						expected_client_id: tokenAudience,
					});
					return reject("invalid_request", "client_id does not match id_token_hint audience");
				}

				clientId = typeof tokenAudience === "string" ? tokenAudience : tokenAudience?.[0];
				log.set({ client: { id: clientId } });
			} catch {
				log.warn("oidc.logout.id_token_invalid");
				return reject("invalid_request", "Invalid id_token_hint");
			}
		} else if (client_id) {
			log.set({ oidc: { logout_hint: "client_id" }, client: { id: client_id } });
			clientId = client_id;
		} else {
			log.warn("oidc.logout.params_missing");
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
			log.warn("client.not_found");
			return reject("invalid_client", "Client not found");
		}

		if (post_logout_redirect_uri && clientId) {
			let isValidUri = logoutUris.some((uri) => uri.uri === post_logout_redirect_uri);
			if (!isValidUri) {
				log.warn("oidc.logout.invalid_redirect_uri");
				return reject("invalid_request", "Invalid post_logout_redirect_uri");
			}
		}

		if (subjectId && subject) {
			await Session.destroyBySubject(db, subject.id);
			log.note("oidc.logout.sessions_destroyed");
		} else if (subjectId) {
			log.warn("subject.not_found");
		}

		if (post_logout_redirect_uri) {
			let redirectUrl = new URL(post_logout_redirect_uri);
			if (state) {
				redirectUrl.searchParams.set("state", state);
			}
			log.note("oidc.logout.completed", { redirect: true });
			return Response.redirect(redirectUrl.toString(), 302);
		}

		log.note("oidc.logout.completed", { redirect: false });

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
