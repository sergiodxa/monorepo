import { JWT } from "@edgefirst-dev/jwt";

import { ACCESS_TOKEN_TTL, ISSUER } from "../config";

export default class AccessToken extends JWT {
	override get id() {
		return this.parser.string("jti");
	}

	override get audience() {
		return this.parser.string("aud");
	}

	override get expiresIn() {
		return this.parser.number("exp");
	}

	override get issuedAt() {
		return new Date(this.parser.number("iat"));
	}

	override get issuer() {
		return this.parser.string("iss");
	}

	override get subject() {
		return this.parser.string("sub");
	}

	get scope() {
		return this.parser.string("scope");
	}

	static generate(audience: string | string[], subjectId: string, scope?: string[]) {
		return new AccessToken({
			aud: audience,
			exp: Date.now() + ACCESS_TOKEN_TTL,
			iat: Date.now(),
			iss: ISSUER,
			jti: crypto.randomUUID(),
			sub: subjectId,
			// Scope as space-separated string per RFC 9068
			...(scope && { scope: scope.join(" ") }),
		});
	}

	static get ttl() {
		return ACCESS_TOKEN_TTL;
	}
}
