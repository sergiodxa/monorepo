/**
 * Verifies the platform-issued ID token the onboarding callback receives against the
 * keys the provider publishes and the identifier it writes into every `iss`. The
 * answer is a value the callback branches on, so one path covers every failed check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IdToken } from "@pkg/auth/id-token";
import { Issuer } from "@pkg/auth/issuer";
import { JWK } from "@pkg/jwt";
import { isFailure, wrap } from "@pkg/result";
import { env } from "cloudflare:workers";

/**
 * Clock skew tolerated on the token's lifetime claims, covering the drift between the
 * tenant that signed the token and the worker reading it.
 */
const ID_TOKEN_CLOCK_TOLERANCE = 60;

/**
 * The algorithm the provider signs ID tokens with, stated so a token presenting any
 * other one is refused before a key is chosen for it.
 */
const ID_TOKEN_ALGORITHMS = [JWK.Algorithm.ES256];

/**
 * Providers kept by the origin serving them, so the discovery document and the key set
 * are read once however many logins one isolate answers.
 */
const ISSUERS = new Map<string, Issuer>();

/**
 * The provider serving the given origin, whose documents are read there while every
 * token it signs is held to the identifier the platform domain publishes, so a local
 * run verifies against the keys it can actually reach.
 *
 * @param origin - Scheme and host the provider's endpoints answer on.
 */
function platformIssuer(origin: string): Issuer {
	let held = ISSUERS.get(origin);
	if (held) return held;

	let issuer = new Issuer(origin, { identifier: `https://${env.PLATFORM_DOMAIN}` });
	ISSUERS.set(origin, issuer);

	return issuer;
}

/**
 * Verifies the token's signature, `iss`, `aud`, and lifetime claims. The echoed
 * `nonce` reaches the caller unchecked, since only the login that started the flow
 * knows the value it has to match.
 *
 * @param raw - The ID token as the token response carried it.
 * @param options - Where the signing provider answers, and the client it issued to.
 * @param options.origin - Scheme and host the provider serves its documents on.
 * @param options.audience - The client id the token carries as its audience.
 * @returns The verified token, and `null` where a check on it failed.
 * @example
 * let idToken = await verifyIdToken(raw, { origin: baseUrl, audience: "dashboard" });
 * if (!idToken || idToken.nonce !== expectedNonce) return renderError("…");
 */
export async function verifyIdToken(
	raw: string,
	options: { origin: string; audience: string },
): Promise<IdToken | null> {
	let verified = await wrap(async () => {
		let issuer = platformIssuer(options.origin);
		let [identifier, keys] = await Promise.all([issuer.identifier(), issuer.keys()]);

		return await IdToken.verify(raw, keys, {
			issuer: identifier,
			audience: options.audience,
			algorithms: ID_TOKEN_ALGORITHMS,
			clockTolerance: ID_TOKEN_CLOCK_TOLERANCE,
		});
	});

	if (isFailure(verified)) return null;

	return verified.data;
}
