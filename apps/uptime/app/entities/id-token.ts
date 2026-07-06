/**
 * OIDC ID token entity. It extends the JWT class to expose typed accessors for
 * standard claims (subject, audience, name, email, picture, username, email
 * verification) and provides verifyIdToken, which validates a token against the
 * auth provider's remote JWKS, audience, and issuer. It authenticates users.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT } from "@edgefirst-dev/jwt";
import { env } from "cloudflare:workers";

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
}

export async function verifyIdToken(token: string) {
	return await IdToken.verify(
		token,
		await JWK.importRemote(new URL("https://auth.sergiodxa.com/.well-known/jwks.json"), {
			alg: JWK.Algoritm.ES256,
		}),
		{ audience: env.CLIENT_ID, issuer: "auth.sergiodxa.com" },
	);
}
