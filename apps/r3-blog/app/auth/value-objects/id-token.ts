/**
 * Value object wrapping an OpenID Connect ID token. The `IdToken` class extends
 * JWT to expose strongly-typed getters for standard claims (sub, aud, name,
 * email, picture, preferred_username, email_verified), and `verifyIdToken`
 * validates a raw token's signature against the sergiodxa auth issuer/audience.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT } from "@edgefirst-dev/jwt";

/**
 * Wraps an OpenID Connect ID token and exposes strongly-typed claim getters.
 */
export default class IdToken extends JWT {
	/**
	 * Returns the stable user identifier from the `sub` claim.
	 */
	override get subject() {
		return this.parser.string("sub");
	}

	/**
	 * Returns the token audience from the `aud` claim.
	 */
	override get audience() {
		return this.parser.string("aud");
	}

	/**
	 * Returns the display name from the `name` claim.
	 */
	get name() {
		return this.parser.string("name");
	}

	/**
	 * Returns the email address from the `email` claim.
	 */
	get email() {
		return this.parser.string("email");
	}

	/**
	 * Returns the avatar URL from the `picture` claim.
	 */
	get picture() {
		return this.parser.string("picture");
	}

	/**
	 * Returns the username from the `preferred_username` claim.
	 */
	get username() {
		return this.parser.string("preferred_username");
	}

	/**
	 * Returns whether the `email` claim is marked as verified.
	 */
	get emailVerified() {
		return this.parser.boolean("email_verified");
	}
}

/**
 * Verifies an ID token signature and expected audience/issuer.
 * @param token Raw JWT string from the auth callback.
 * @param verificationKey Imported remote JWK used to validate the signature.
 * @param clientId OAuth client id expected in the `aud` claim.
 * @returns A verified `IdToken` instance when the token is valid.
 * @example
 * let idToken = await verifyIdToken(rawToken, jwk, env.CLIENT_ID)
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
