/**
 * Value Object for OpenID Connect ID Tokens.
 *
 * Wraps a signed JWT with typed accessors for identity claims and a factory that
 * mints a one-hour ID token, including only the profile/email claims permitted by
 * the requested scopes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@sdxc/jwt";

/** ID token time-to-live in milliseconds (1 hour). */
const ID_TOKEN_TTL = 60 * 60 * 1000;

/**
 * Value Object for OpenID Connect ID Tokens.
 * Extends JWT with identity claims for authentication.
 */
export default class IdToken extends JWT {
	/**
	 * Subject identifier (sub claim).
	 */
	override get subject() {
		return this.parser.string("sub");
	}

	/**
	 * Client ID that requested this token (aud claim).
	 */
	override get audience() {
		return this.parser.string("aud");
	}

	/**
	 * User's full name (name claim).
	 */
	get name() {
		return this.parser.string("name");
	}

	/**
	 * User's email address (email claim).
	 */
	get email() {
		return this.parser.string("email");
	}

	/**
	 * URL to user's profile picture (picture claim).
	 */
	get picture() {
		return this.parser.string("picture");
	}

	/**
	 * User's preferred username (preferred_username claim).
	 */
	get username() {
		return this.parser.string("preferred_username");
	}

	/**
	 * Whether the user's email has been verified (email_verified claim).
	 */
	get emailVerified() {
		return this.parser.boolean("email_verified");
	}

	/**
	 * Client-provided nonce for replay protection (nonce claim).
	 */
	get nonce() {
		return this.parser.string("nonce");
	}

	/**
	 * Time of original authentication (auth_time claim).
	 */
	get authTime() {
		return this.parser.number("auth_time");
	}

	/**
	 * Session identifier (sid claim).
	 */
	get sessionId() {
		return this.parser.string("sid");
	}

	/**
	 * Token not-before time as Date (nbf claim).
	 */
	override get notBefore() {
		return new Date(this.parser.number("nbf") * 1000);
	}

	/**
	 * Generates a new ID token with the given parameters. Adds email and
	 * email_verified when scope includes "email", and name, preferred_username,
	 * and picture when scope includes "profile".
	 * @param issuer - Token issuer URL
	 * @param subject - User identity data
	 * @param client - Client requesting the token
	 * @param options - Optional nonce, scope, authTime, and sessionId
	 * @returns New IdToken instance
	 * @example
	 * let idToken = IdToken.generate(issuer, subject, client, { scope: ["openid", "email"] });
	 */
	static generate(
		issuer: string,
		subject: {
			id: string;
			email: string;
			avatar: string;
			username: string;
			displayName: string;
			emailVerified: boolean;
		},
		client: { id: string },
		options?: { nonce?: string | null; scope?: string[]; authTime?: number; sessionId?: string },
	) {
		let scope = options?.scope ?? ["openid"];
		let now = Math.floor(Date.now() / 1000);
		let expiresAt = now + Math.floor(ID_TOKEN_TTL / 1000);

		return new IdToken({
			sub: subject.id,
			iss: issuer,
			aud: client.id,
			jti: crypto.randomUUID(),
			exp: expiresAt,
			iat: now,
			nbf: now,
			...(options?.sessionId && { sid: options.sessionId }),
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
