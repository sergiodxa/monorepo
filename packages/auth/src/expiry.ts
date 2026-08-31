/**
 * When a credential stops being accepted. One reading serves both a cached service
 * token and a signed-in session, so the same token gets the same answer wherever it
 * is held, and one rule covers a lifetime nobody stated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWT } from "@pkg/jwt";
import { isFailure, wrap } from "@pkg/result";

/** Milliseconds in a second, the unit every claim here is counted in. */
const MS_PER_SECOND = 1000;

/**
 * The `exp` a credential carries in its own claims, in seconds since the epoch.
 *
 * @param credential - The credential as the issuer serialized it.
 * @returns The claimed expiry, and `null` for a credential whose claims no holder
 *   can read — an opaque token, or a token stating no `exp`.
 * @example let expiry = signedExpiry(tokens.idToken);
 */
export function signedExpiry(credential: string): number | null {
	let claims = wrap(() => JWT.decode(credential));
	if (isFailure(claims)) return null;
	return claims.data.expirationTime;
}

/**
 * When an access token stops being accepted, in seconds since the epoch. The token's
 * own signed `exp` answers first, since that is the value a resource server enforces;
 * a lifetime the token endpoint stated answers for an opaque token.
 *
 * @param credential - The access token as the issuer serialized it.
 * @param stated - Seconds since the epoch derived from `expires_in`, and `null`
 *   where the token endpoint stated no lifetime.
 * @returns The expiry, and `null` when neither source states one.
 * @example let expiry = accessTokenExpiry(tokens.accessToken, tokens.expiresAt);
 */
export function accessTokenExpiry(credential: string, stated: number | null): number | null {
	return signedExpiry(credential) ?? stated;
}

/**
 * Whether a token has less life left than the reserve its holder needs, which is the
 * question behind reusing a cached token and behind renewing a stored one. An expiry
 * no source states reads as already spent, since nothing vouches for the credential.
 *
 * @param expiry - Seconds since the epoch the token expires at, absent as `null`.
 * @param reserve - Seconds of life a token must still have to be worth handing on,
 *   covering the request it authenticates and the clock skew at the far end.
 * @example if (spent(expiry, RESERVE_SECONDS)) await renew();
 */
export function spent(expiry: number | null, reserve: number): boolean {
	if (expiry === null) return true;
	return expiry - reserve <= Math.floor(Date.now() / MS_PER_SECOND);
}
