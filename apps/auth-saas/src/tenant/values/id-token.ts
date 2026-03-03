import { JWT } from "@edgefirst-dev/jwt";

const ID_TOKEN_TTL = 60 * 60 * 1000; // 1 hour in ms

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

	get nonce() {
		return this.parser.string("nonce");
	}

	get authTime() {
		return this.parser.number("auth_time");
	}

	override get notBefore() {
		return new Date(this.parser.number("nbf") * 1000);
	}

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
		options?: { nonce?: string | null; scope?: string[]; authTime?: number },
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
			nbf: now, // Token is valid immediately
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
