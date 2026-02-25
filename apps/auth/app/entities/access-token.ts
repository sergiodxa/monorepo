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
		// iat is in seconds per RFC 7519
		return new Date(this.parser.number("iat") * 1000);
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
		let now = Math.floor(Date.now() / 1000); // RFC 7519 NumericDate is in seconds
		let expiresAt = now + Math.floor(ACCESS_TOKEN_TTL / 1000);

		return new AccessToken({
			aud: audience,
			exp: expiresAt,
			iat: now,
			iss: ISSUER,
			jti: crypto.randomUUID(),
			sub: subjectId,
			// Scope as space-separated string per RFC 9068
			...(scope && { scope: scope.join(" ") }),
		});
	}

	/** TTL in seconds for use in token responses */
	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
