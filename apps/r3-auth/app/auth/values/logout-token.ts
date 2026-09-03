/**
 * The OIDC back-channel logout token this server sends to relying parties: a short
 * lived JWT carrying the subject, the audience, an optional session id, and the
 * `events` claim the specification requires. Modelled as a value object so the logout
 * fan-out mints and reads one well-defined token shape.
 *
 * @see https://openid.net/specs/openid-connect-backchannel-1_0.html
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@sdxc/jwt";

import { ISSUER } from "~/app/config";

/** How long a logout token stays acceptable: the two minutes the specification caps it at. */
const LOGOUT_TOKEN_TTL = 2 * 60 * 1000;

/** A back-channel logout notification addressed to one relying party. */
export default class LogoutToken extends JWT {
	/** The person being logged out (`sub`). */
	override get subject() {
		return this.parser.string("sub");
	}

	/** The relying party being notified (`aud`). */
	override get audience() {
		return this.parser.string("aud");
	}

	/** The session being ended, present only for clients that require session-specific logout. */
	get sessionId() {
		return this.parser.string("sid");
	}

	/**
	 * The back-channel logout event claim, whose presence is what distinguishes a
	 * logout token from any other JWT this server signs.
	 */
	get events() {
		return this.parser.object("events") as unknown as {
			"http://schemas.openid.net/event/backchannel-logout": Record<string, never>;
		};
	}

	/**
	 * Mints a logout token for one relying party.
	 *
	 * `sid` is written only when a session id is supplied, so the session identifier
	 * reaches only the clients that require session-specific logout.
	 *
	 * @param subjectId - The person being logged out.
	 * @param clientId - The relying party receiving the notification.
	 * @param sessionId - Session to name, when the client requires session-specific logout.
	 */
	static generate(subjectId: string, clientId: string, sessionId?: string) {
		let now = Date.now();

		return new LogoutToken({
			iss: ISSUER,
			sub: subjectId,
			aud: clientId,
			iat: now,
			exp: now + LOGOUT_TOKEN_TTL,
			jti: crypto.randomUUID(),
			...(sessionId && { sid: sessionId }),
			events: {
				"http://schemas.openid.net/event/backchannel-logout": {},
			},
		});
	}
}
