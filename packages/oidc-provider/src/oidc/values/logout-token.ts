/**
 * Value Object for OpenID Connect Back-Channel Logout Tokens.
 *
 * Builds the short-lived, signed JWT sent to a client's back-channel logout
 * endpoint to notify it that a subject's session has been terminated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@pkg/jwt";

/**
 * Value Object for OpenID Connect Back-Channel Logout Tokens.
 * Used to notify clients of session termination.
 * @see https://openid.net/specs/openid-connect-backchannel-1_0.html
 */
export default class LogoutToken extends JWT {
	/**
	 * Subject identifier being logged out (sub claim).
	 */
	override get subject() {
		return this.parser.string("sub");
	}

	/**
	 * Client ID to notify (aud claim).
	 */
	override get audience() {
		return this.parser.string("aud");
	}

	/**
	 * Session identifier being terminated (sid claim).
	 */
	get sessionId() {
		return this.parser.string("sid");
	}

	/**
	 * Logout event payload (events claim).
	 * Contains the back-channel logout event type.
	 */
	get events() {
		return this.parser.object("events") as unknown as {
			"http://schemas.openid.net/event/backchannel-logout": Record<string, never>;
		};
	}

	/**
	 * Generates a new logout token for back-channel logout.
	 * Token expires in 2 minutes per OpenID Connect spec.
	 * @param issuer - Token issuer URL
	 * @param subjectId - Subject identifier being logged out
	 * @param clientId - Client to notify
	 * @param sessionId - Optional session identifier
	 * @returns New LogoutToken instance
	 * @example
	 * let token = LogoutToken.generate(issuer, subject.id, client.id, session.id);
	 */
	static generate(issuer: string, subjectId: string, clientId: string, sessionId?: string) {
		let now = Math.floor(Date.now() / 1000);
		return new LogoutToken({
			iss: issuer,
			sub: subjectId,
			aud: clientId,
			iat: now,
			exp: now + 2 * 60,
			jti: crypto.randomUUID(),
			...(sessionId && { sid: sessionId }),
			events: {
				"http://schemas.openid.net/event/backchannel-logout": {},
			},
		});
	}
}
