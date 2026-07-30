/**
 * Value object wrapping an OpenID Connect ID token issued by auth.sergiodxa.com. The
 * `IdToken` class extends JWT to expose strongly-typed getters for the standard claims
 * this app relies on (subject, audience, name, email, picture, username, email
 * verification), and `verifyIdToken` validates a raw token's signature against the
 * issuer's remote JWKS plus its audience and issuer claims. Never trust these claims
 * without going through `verifyIdToken` first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT } from "@edgefirst-dev/jwt";

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
 * audience/issuer claims.
 *
 * @param token Raw JWT string from the OAuth callback.
 * @param verificationKey Imported remote JWK used to validate the signature.
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
	});
}
