/**
 * The confidential client that signs an editor in: the authorization redirect, the
 * callback that verifies the ID token, the provider logout, and the session scheme the
 * auth middleware resolves a user through. Built per request so the callback URL it
 * presents is the origin the request arrived on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RelyingParty } from "@pkg/auth/relying-party";
import { JWK } from "@pkg/jwt";
import * as s from "remix/data-schema";

import type { User } from "~/app/repositories/user";

import { issuer } from "~/app/auth/issuer";
import { getEnv } from "~/app/http/middleware/env";
import routes from "~/routes/web";

/**
 * The claims a local account is filled from. Every one is required, because the row
 * has no room for an absent value, so a provider that stops sending one refuses the
 * login instead of writing a blank field over a real one.
 */
const PROFILE_CLAIMS = s.object({
	email: s.string(),
	name: s.string(),
	preferred_username: s.string(),
	picture: s.string(),
});

/**
 * What a completed login carries about the person: a local account without the subject
 * id, which the flow resolves separately and the callback pairs it with.
 */
export type AuthProfile = Omit<User.AuthProfile, "subjectId">;

/**
 * The client for the request's own origin, so a local run and production each present
 * the callback URL they are registered under. A login that names no destination, or one
 * naming another origin, comes back to the dashboard.
 *
 * @param url The current request's URL, which the callback URL is built against.
 * @returns The client the login, callback, logout, and session scheme run through.
 * @example let grant = await relyingParty(ctx.url).callback(ctx);
 */
export function relyingParty(url: URL | string): RelyingParty<AuthProfile> {
	return new RelyingParty<AuthProfile>(issuer(), {
		clientId: getEnv("CLIENT_ID"),
		clientSecret: getEnv("CLIENT_SECRET"),
		redirectUri: new URL(routes.auth.callback.href(), url),
		clientAuth: "client_secret_basic",
		algorithms: [JWK.Algorithm.ES256],
		fallbackReturnTo: routes.cms.dashboard.href(),

		/**
		 * Maps the verified claims onto the fields a local account holds.
		 *
		 * @param claims The claim set the login resolved.
		 * @returns The account fields, ready to reconcile with the stored row.
		 * @throws {ValidationError} When a claim the account needs is absent.
		 */
		mapProfile(claims) {
			let profile = s.parse(PROFILE_CLAIMS, claims);

			return {
				email: profile.email,
				avatar: profile.picture,
				username: profile.preferred_username,
				displayName: profile.name,
			};
		},
	});
}
