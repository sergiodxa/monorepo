/**
 * Verifies the platform-issued ID token the onboarding callback receives against the
 * keys the provider publishes and the identifier it writes into every `iss`. The
 * answer is a value the callback branches on, so one path covers every failed check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IdToken } from "@sdxc/auth/id-token";

import { Issuer } from "@sdxc/auth/issuer";
import { JWK } from "@sdxc/jwt";
import { isFailure, wrap } from "@sdxc/result";
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
const ID_TOKEN_ALGORITHMS: JWK.Algorithm[] = [JWK.Algorithm.ES256];

/**
 * Verifies the token's signature, `iss`, `aud`, and lifetime claims, reading the provider's
 * documents from the origin serving them while holding the token to the identifier the
 * platform domain publishes, so a local run verifies against keys it can actually reach.
 *
 * @param raw - The ID token as the token response carried it.
 * @param options - Where the signing provider answers, and the client it issued to.
 * @param options.origin - Scheme and host the provider serves its documents on.
 * @param options.audience - The client id the token carries as its audience.
 * @returns The verified token, and `null` where a check on it failed. Its echoed `nonce`
 *   reaches the caller unchecked, since only the login that started the flow knows the
 *   value it has to match.
 * @example
 * let idToken = await verifyIdToken(raw, { origin: baseUrl, audience: "dashboard" });
 * if (!idToken || idToken.nonce !== expectedNonce) return renderError("…");
 */
export async function verifyIdToken(
	raw: string,
	options: { origin: string; audience: string },
): Promise<IdToken | null> {
	let issuer = Issuer.for(options.origin, { identifier: `https://${env.PLATFORM_DOMAIN}` });

	let verified = await wrap(() =>
		issuer.verifyIdToken(raw, {
			audience: options.audience,
			algorithms: ID_TOKEN_ALGORITHMS,
			clockTolerance: ID_TOKEN_CLOCK_TOLERANCE,
		}),
	);

	if (isFailure(verified)) return null;

	return verified.data;
}
