/**
 * The signature algorithms tokens are signed with and verified against, one
 * export each, kept in a module of its own so a caller that needs only the
 * names carries nothing else to read them.
 *
 * Import the whole set as a namespace, or a single name on its own:
 *
 * @example
 * import * as Algorithm from "@sdxc/jwt/algorithm";
 * Object.values(Algorithm);
 * @example
 * import { ES256 } from "@sdxc/jwt/algorithm";
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Issued here, and the only algorithm this repository's own tokens carry. */
export const ES256 = "ES256";

/** Verifies tokens from upstream identity providers. */
export const RS256 = "RS256";

/**
 * EdDSA over the Ed25519 curve, under the fully-specified name RFC 9864 registers;
 * its nonce derives from the key and message, keeping the ECDSA nonce-reuse leak
 * that exposes a private key out of reach.
 */
export const Ed25519 = "Ed25519";
