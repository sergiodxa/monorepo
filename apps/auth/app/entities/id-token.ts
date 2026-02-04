import { JWT } from "@edgefirst-dev/jwt";

import { ID_TOKEN_TTL, ISSUER } from "~/config";

export default class IdToken extends JWT {
	override get subject() {
		return this.parser.string("sub");
	}

	override get audience() {
		return this.parser.string("aud");
	}

	get name() {
		return this.parser.string("name");
	}

	get email() {
		return this.parser.string("email");
	}

	get picture() {
		return this.parser.string("picture");
	}

	get username() {
		return this.parser.string("preferred_username");
	}

	get emailVerified() {
		return this.parser.boolean("email_verified");
	}

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
	) {
		return new IdToken({
			sub: subject.id,
			iss: ISSUER,
			aud: client.id,
			jti: crypto.randomUUID(),
			exp: Date.now() + ID_TOKEN_TTL,
			iat: Date.now(),
			// Extra claims
			email: subject.email,
			picture: subject.avatar,
			preferred_username: subject.username,
			name: subject.displayName,
			email_verified: subject.emailVerified,
		});
	}
}
