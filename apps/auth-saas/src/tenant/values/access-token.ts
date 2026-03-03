import { JWT } from "@edgefirst-dev/jwt";

const ACCESS_TOKEN_TTL = 60 * 60 * 1000; // 1 hour in ms

export default class AccessToken extends JWT {
	override get id() {
		return this.parser.string("jti");
	}

	override get audience(): string | string[] | null {
		let aud = this.payload.aud;
		if (Array.isArray(aud)) return aud;
		if (typeof aud === "string") return aud;
		return null;
	}

	override get expiresIn() {
		return this.parser.number("exp");
	}

	override get issuedAt() {
		return new Date(this.parser.number("iat") * 1000);
	}

	override get issuer() {
		return this.parser.string("iss");
	}

	override get notBefore() {
		return new Date(this.parser.number("nbf") * 1000);
	}

	override get subject() {
		return this.parser.string("sub");
	}

	get scope() {
		return this.parser.string("scope");
	}

	static generate(
		issuer: string,
		audience: string | string[],
		subjectId: string,
		scope?: string[],
	) {
		let now = Math.floor(Date.now() / 1000);
		let expiresAt = now + Math.floor(ACCESS_TOKEN_TTL / 1000);

		return new AccessToken({
			aud: audience,
			exp: expiresAt,
			iat: now,
			iss: issuer,
			jti: crypto.randomUUID(),
			nbf: now, // Token is valid immediately
			sub: subjectId,
			...(scope && { scope: scope.join(" ") }),
		});
	}

	static get ttl() {
		return Math.floor(ACCESS_TOKEN_TTL / 1000);
	}
}
