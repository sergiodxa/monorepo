import { JWT } from "@edgefirst-dev/jwt";

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

	static generate(issuer: string, subjectId: string, clientId: string, sessionId?: string) {
		let now = Math.floor(Date.now() / 1000);
		return new LogoutToken({
			iss: issuer,
			sub: subjectId,
			aud: clientId,
			iat: now,
			exp: now + 2 * 60, // 2 minutes max per spec
			jti: crypto.randomUUID(),
			...(sessionId && { sid: sessionId }),
			events: {
				"http://schemas.openid.net/event/backchannel-logout": {},
			},
		});
	}
}
