/**
 * Verifies platform-issued ID tokens for the onboarding callback: fetches the
 * platform tenant's JWKS, checks the ES256 signature, and requires the issuer,
 * audience, and time claims before trusting any claim to mint a dashboard
 * session. The echoed nonce lets the caller match it against the value stored
 * when the flow started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@pkg/types";

import { JWK, JWT } from "@pkg/jwt";

/**
 * Clock skew tolerance (in seconds) allowed when verifying the ID token's time claims,
 * covering minor drift between the platform tenant and the worker.
 */
const ID_TOKEN_CLOCK_TOLERANCE = 60;

/** The verified ID token's claims plus its echoed nonce (for the caller's nonce check). */
export interface VerifiedIdToken {
	/** The full, verified claim set (safe to read from once verification succeeds). */
	claims: JSONValue;
	nonce: string | null;
}

/**
 * Fetches the platform tenant's JWKS, then verifies the token's ES256
 * signature, issuer, audience, and time claims, confirming the algorithm
 * before any key is chosen. The caller still checks the returned nonce.
 *
 * @param idToken - The raw ID token (JWT) from the token response.
 * @param options - JWKS location and expected issuer/audience.
 * @param options.jwksUrl - URL of the platform tenant's `/.well-known/jwks.json`.
 * @param options.issuer - Expected `iss` claim (e.g. `https://auth.example.com`).
 * @param options.audience - Expected `aud` claim (the dashboard client id).
 * @returns The verified claims and nonce, or `null` when verification fails.
 * @example
 * let verified = await verifyIdToken(idToken, { jwksUrl, issuer, audience: "dashboard" });
 * if (!verified || verified.nonce !== expectedNonce) return renderError(...);
 */
export async function verifyIdToken(
	idToken: string,
	options: { jwksUrl: string; issuer: string; audience: string },
): Promise<VerifiedIdToken | null> {
	try {
		let jwksResponse = await fetch(options.jwksUrl);
		if (!jwksResponse.ok) return null;

		let jwks = (await jwksResponse.json()) as { keys?: unknown[] };
		if (!jwks.keys || jwks.keys.length === 0) return null;

		let publicKeys = await JWK.importLocal(jwks as Parameters<typeof JWK.importLocal>[0]);

		let verified = await JWT.verify(idToken, publicKeys, {
			issuer: options.issuer,
			audience: options.audience,
			clockTolerance: ID_TOKEN_CLOCK_TOLERANCE,
			algorithms: [JWK.Algorithm.ES256],
		});

		let nonce = typeof verified.payload.nonce === "string" ? verified.payload.nonce : null;
		return { claims: verified.payload as JSONValue, nonce };
	} catch {
		return null;
	}
}
