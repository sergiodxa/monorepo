/**
 * Reads the claims of an access token this server itself issued and kept in its own
 * cookie session. The signature is not checked, and deliberately so: the token never
 * left the signed, httpOnly session record, so verifying it would only re-prove the
 * cookie signature at the cost of an R2 read on every request.
 *
 * Never use this on a token that arrived from a client — those go through
 * `AccessToken.verify` in the engine, which checks the signature, issuer and expiry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@pkg/crypto";
import { isFailure } from "@pkg/result";

/** How long before expiry a token counts as expiring soon, in milliseconds. */
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

/** The claims this server writes into its own access tokens. */
export interface AccessTokenClaims {
	sub: string;
	exp: number;
	iat: number;
	iss: string;
	aud: string;
}

/**
 * Decodes an access token's payload without verifying its signature.
 *
 * @param accessToken - A compact JWT taken from this server's own session.
 * @returns The claims, or `null` when the value is not a readable token.
 */
export function decodeAccessToken(accessToken: string): AccessTokenClaims | null {
	let segment = accessToken.split(".")[1];
	if (!segment) return null;

	let decoded = Base64Url.decode(segment);
	if (isFailure(decoded)) return null;

	let payload: unknown;
	try {
		payload = JSON.parse(new TextDecoder().decode(decoded.data));
	} catch {
		return null;
	}

	if (typeof payload !== "object" || payload === null) return null;

	let claims = payload as Partial<AccessTokenClaims>;
	if (typeof claims.sub !== "string") return null;
	if (typeof claims.exp !== "number") return null;
	if (typeof claims.iat !== "number") return null;
	if (typeof claims.iss !== "string") return null;
	if (typeof claims.aud !== "string") return null;

	return claims as AccessTokenClaims;
}

/**
 * The subject an access token was issued for.
 *
 * @returns The subject id, or `null` when the token cannot be read.
 */
export function getSubjectFromAccessToken(accessToken: string): string | null {
	return decodeAccessToken(accessToken)?.sub ?? null;
}

/**
 * Whether a token has expired or is close enough to expiry to be worth refreshing
 * now rather than mid-request.
 *
 * An unreadable token counts as expiring, so the caller refreshes or signs out
 * instead of carrying a value it cannot reason about.
 */
export function isAccessTokenExpiringSoon(accessToken: string): boolean {
	let claims = decodeAccessToken(accessToken);
	if (!claims) return true;
	return claims.exp * 1000 - Date.now() < REFRESH_THRESHOLD_MS;
}
