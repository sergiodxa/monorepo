/**
 * COSE signature algorithm identifiers (RFC 9053, RFC 9864) and the WebCrypto parameters
 * each one imports, signs and verifies with, so one table decides which key a signature
 * algorithm may run under.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** ECDSA with SHA-256 over P-256. */
export const ES256 = -7;

/** ECDSA with SHA-384 over P-384. */
export const ES384 = -35;

/** ECDSA with SHA-512 over P-521. */
export const ES512 = -36;

/** EdDSA, the polymorphic identifier RFC 9864 deprecates; verified as Ed25519 only. */
export const EDDSA = -8;

/** Ed25519, the fully specified EdDSA identifier from RFC 9864. */
export const ED25519 = -19;

/** RSASSA-PSS with SHA-256 and a 32-byte salt. */
export const PS256 = -37;

/** RSASSA-PSS with SHA-384 and a 48-byte salt. */
export const PS384 = -38;

/** RSASSA-PSS with SHA-512 and a 64-byte salt. */
export const PS512 = -39;
