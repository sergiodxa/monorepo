import { decodeJwt } from "jose";

interface DecodedAccessToken {
	sub: string;
	exp: number;
	iat: number;
	iss: string;
	aud: string;
}

/**
 * Decodes an access token JWT without verifying the signature.
 * This is safe because we trust our own tokens stored in our cookie session.
 *
 * @param accessToken - The JWT access token string
 * @returns The decoded token payload with sub, exp, iat, iss, aud
 */
export function decodeAccessToken(accessToken: string): DecodedAccessToken {
	let payload = decodeJwt(accessToken);

	if (
		typeof payload.sub !== "string" ||
		typeof payload.exp !== "number" ||
		typeof payload.iat !== "number" ||
		typeof payload.iss !== "string" ||
		typeof payload.aud !== "string"
	) {
		throw new Error("Invalid access token payload");
	}

	return {
		sub: payload.sub,
		exp: payload.exp,
		iat: payload.iat,
		iss: payload.iss,
		aud: payload.aud,
	};
}

/**
 * Checks if an access token is expired or will expire within the given threshold.
 *
 * @param accessToken - The JWT access token string
 * @param thresholdMs - Time in milliseconds before expiration to consider "expiring soon" (default: 5 minutes)
 * @returns true if the token is expired or expiring soon
 */
export function isAccessTokenExpiringSoon(
	accessToken: string,
	thresholdMs = 5 * 60 * 1000,
): boolean {
	let { exp } = decodeAccessToken(accessToken);
	let expiresAt = exp * 1000; // Convert to milliseconds
	let now = Date.now();
	return expiresAt - now < thresholdMs;
}

/**
 * Extracts the subject (user ID) from an access token.
 *
 * @param accessToken - The JWT access token string
 * @returns The subject ID
 */
export function getSubjectFromAccessToken(accessToken: string): string {
	return decodeAccessToken(accessToken).sub;
}
