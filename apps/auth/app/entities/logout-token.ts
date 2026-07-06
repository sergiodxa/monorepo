/**
 * OIDC back-channel logout token entity: a JWT subclass exposing sub, aud, sid and
 * the required back-channel-logout events claim, plus a generator that mints a
 * short-lived logout token notifying a relying party that a user has logged out.
 * Exists to model the token this provider sends to RPs during back-channel logout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@edgefirst-dev/jwt";

import { ISSUER } from "~/config";

/**
 * OIDC Logout Token for Back-Channel Logout
 *
 * A Logout Token is a JWT that is sent from the OP to an RP to notify
 * it that a user has logged out. It MUST contain the `events` claim
 * with the back-channel logout event.
 *
 * @see https://openid.net/specs/openid-connect-backchannel-1_0.html
 */
export default class LogoutToken extends JWT {
	override get subject() {
		return this.parser.string("sub");
	}

	override get audience() {
		return this.parser.string("aud");
	}

	get sessionId() {
		return this.parser.string("sid");
	}

	get events() {
		return this.parser.object("events") as unknown as {
			"http://schemas.openid.net/event/backchannel-logout": Record<string, never>;
		};
	}

	/**
	 * Generate a Logout Token for back-channel logout
	 *
	 * @param subjectId - The subject (user) ID being logged out
	 * @param clientId - The audience (client) receiving the logout token
	 * @param sessionId - Optional session ID if session-specific logout is required
	 */
	static generate(subjectId: string, clientId: string, sessionId?: string) {
		let now = Date.now();
		return new LogoutToken({
			iss: ISSUER,
			sub: subjectId,
			aud: clientId,
			iat: now,
			exp: now + 2 * 60 * 1000, // 2 minutes max per spec
			jti: crypto.randomUUID(),
			// Session ID for session-specific logout
			...(sessionId && { sid: sessionId }),
			// Required events claim for back-channel logout
			events: {
				"http://schemas.openid.net/event/backchannel-logout": {},
			},
		});
	}
}
