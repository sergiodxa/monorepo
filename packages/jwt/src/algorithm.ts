/**
 * The signature algorithms tokens are signed with and verified against, kept in
 * a module of their own so a caller that needs only the names carries nothing
 * else to read them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * ES256 is issued here; RS256 verifies tokens from upstream identity
 * providers; EdDSA derives its nonce from the key and message, keeping the
 * ECDSA nonce-reuse leak that exposes a private key out of reach.
 */
export const Algorithm = { ES256: "ES256", RS256: "RS256", EdDSA: "EdDSA" } as const;

/** One of the supported signature algorithms. */
export type Algorithm = (typeof Algorithm)[keyof typeof Algorithm];
