/**
 * The OIDC ID token this server issues: a JWT with typed accessors for the standard
 * identity claims, plus the generator that builds one for a subject and a client.
 * Claims are gated by the granted scope per OIDC Core 1.0, so a relying party never
 * receives an attribute the person did not consent to share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@pkg/jwt";

import { ID_TOKEN_TTL, ISSUER } from "~/app/config";

/** An ID token, read from or minted for a relying party. */
export default class IdToken extends JWT {
	/** The person the token identifies (`sub`). */
	override get subject() {
		return this.parser.string("sub");
	}

	/** The relying party the token was issued to (`aud`). */
	override get audience() {
		return this.parser.string("aud");
	}

	/** Display name, present only when the `profile` scope was granted. */
	get name() {
		return this.parser.string("name");
	}

	/** Email address, present only when the `email` scope was granted. */
	get email() {
		return this.parser.string("email");
	}

	/** Avatar URL, present only when the `profile` scope was granted. */
	get picture() {
		return this.parser.string("picture");
	}

	/** Username, present only when the `profile` scope was granted. */
	get username() {
		return this.parser.string("preferred_username");
	}

	/** Whether the address in {@link email} has been verified. */
	get emailVerified() {
		return this.parser.boolean("email_verified");
	}

	/** The value echoed back from the authorization request, binding it to this token. */
	get nonce() {
		return this.parser.string("nonce");
	}

	/** When the person last authenticated, in seconds since the epoch. */
	get authTime() {
		return this.parser.number("auth_time");
	}

	/**
	 * Mints an ID token valid for {@link ID_TOKEN_TTL}.
	 *
	 * Only the claims the granted scope covers are written: `email` adds the address
	 * and its verification flag, `profile` adds name, username and picture, and
	 * everything else is always present. `nonce` and `auth_time` are written only when
	 * the authorization request supplied them.
	 *
	 * @param subject - The person being identified.
	 * @param client - The relying party the token is addressed to.
	 * @param options - Nonce to echo, granted scopes, and the authentication time.
	 */
	static generate(
		subject: {
			id: string;
			email: string;
			avatar: string;
			username: string;
			displayName: string;
			emailVerified: boolean;
		},
		client: { id: string },
		options?: { nonce?: string | null; scope?: string[]; authTime?: number },
	) {
		let scope = options?.scope ?? ["openid"];
		let now = Math.floor(Date.now() / 1000); // RFC 7519 NumericDate is in seconds
		let expiresAt = now + Math.floor(ID_TOKEN_TTL / 1000);

		return new IdToken({
			sub: subject.id,
			iss: ISSUER,
			aud: client.id,
			jti: crypto.randomUUID(),
			exp: expiresAt,
			iat: now,
			...(options?.authTime && { auth_time: options.authTime }),
			...(options?.nonce && { nonce: options.nonce }),
			...(scope.includes("email") && {
				email: subject.email,
				email_verified: subject.emailVerified,
			}),
			...(scope.includes("profile") && {
				name: subject.displayName,
				preferred_username: subject.username,
				picture: subject.avatar,
			}),
		});
	}
}
