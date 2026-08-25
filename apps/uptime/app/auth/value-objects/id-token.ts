/**
 * Value object wrapping an OpenID Connect ID token issued by auth.sergiodxa.com.
 * `IdToken` exposes typed getters for the claims this app relies on, and
 * `verifyIdToken` checks a raw token's signature against the issuer's remote JWKS
 * plus its audience and issuer claims before trusting any of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT } from "@pkg/jwt";

/**
 * Wraps a verified OpenID Connect ID token and exposes typed claim getters.
 */
export default class IdToken extends JWT {
	/** The stable user identifier from the `sub` claim. */
	override get subject() {
		return this.parser.string("sub");
	}

	/** The token audience from the `aud` claim. */
	override get audience() {
		return this.parser.string("aud");
	}

	/** The display name from the `name` claim. */
	get name() {
		return this.parser.string("name");
	}

	/** The email address from the `email` claim. */
	get email() {
		return this.parser.string("email");
	}

	/** The avatar URL from the `picture` claim. */
	get picture() {
		return this.parser.string("picture");
	}

	/** The username from the `preferred_username` claim. */
	get username() {
		return this.parser.string("preferred_username");
	}

	/** Whether the `email` claim is marked as verified. */
	get emailVerified() {
		return this.parser.boolean("email_verified");
	}
}

/**
 * Verifies an ID token's signature against the auth server's remote JWKS, and its
 * audience/issuer claims. Pins verification to ES256, the algorithm the auth server
 * publishes today, so every token is checked against one fixed algorithm.
 *
 * @param token Raw JWT string from the OAuth callback.
 * @param verificationKey Resolver for the auth server's published keys.
 * @param clientId OAuth client id expected in the `aud` claim.
 * @returns A verified `IdToken` instance when the token is valid.
 * @example
 * let idToken = await verifyIdToken(rawToken, await verificationKey.value, env.CLIENT_ID);
 */
export async function verifyIdToken(
	token: string,
	verificationKey: Awaited<ReturnType<typeof JWK.importRemote>>,
	clientId: string,
) {
	return await IdToken.verify(token, verificationKey, {
		audience: clientId,
		issuer: "auth.sergiodxa.com",
		algorithms: [JWK.Algorithm.ES256],
	});
}
