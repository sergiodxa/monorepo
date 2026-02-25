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

	get nonce() {
		return this.parser.string("nonce");
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
		options?: { nonce?: string | null; scope?: string[] },
	) {
		let scope = options?.scope ?? ["openid"];

		return new IdToken({
			sub: subject.id,
			iss: ISSUER,
			aud: client.id,
			jti: crypto.randomUUID(),
			exp: Date.now() + ID_TOKEN_TTL,
			iat: Date.now(),
			// OIDC nonce - echo back from authorization request
			...(options?.nonce && { nonce: options.nonce }),
			// Scope-based claims per OIDC Core 1.0
			// email scope: email, email_verified
			...(scope.includes("email") && {
				email: subject.email,
				email_verified: subject.emailVerified,
			}),
			// profile scope: name, preferred_username, picture
			...(scope.includes("profile") && {
				name: subject.displayName,
				preferred_username: subject.username,
				picture: subject.avatar,
			}),
		});
	}
}
