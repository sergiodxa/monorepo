/**
 * The registered numbers SCITT messages are written in: COSE header parameters from RFC 9942,
 * CWT claim keys from RFC 8392, and the Verifiable Data Structure and proof identifiers of
 * RFC 9942's registries, plus the media types SCRAPI exchanges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** COSE header parameter: Receipts attached to a Transparent Statement's unprotected header. */
export const RECEIPTS = 394;

/** COSE header parameter: the Verifiable Data Structure a Receipt's proofs belong to. */
export const VDS = 395;

/** COSE header parameter: a Receipt's Verifiable Data Structure Proofs, by proof type. */
export const VDP = 396;

/** CWT claim key for the issuer. */
export const ISS = 1;

/** CWT claim key for the subject, the Artifact a statement is about. */
export const SUB = 2;

/** CWT claim key for the time of issue, in seconds since the epoch. */
export const IAT = 6;

/** The RFC 9162 binary Merkle tree over SHA-256, the one Verifiable Data Structure RFC 9942 defines. */
export const RFC9162_SHA256 = 1;

/** Proof type label for inclusion proofs under `vdp`. */
export const INCLUSION_PROOFS = -1;

/** Proof type label for consistency proofs under `vdp`. */
export const CONSISTENCY_PROOFS = -2;

/** Media type SCRAPI registers Signed Statements and returns Receipts under. */
export const COSE_MEDIA_TYPE = "application/cose";

/** Media type of a Transparency Service's key set and keys. */
export const CBOR_MEDIA_TYPE = "application/cbor";

/** Media type of an RFC 9290 Concise Problem Details error body. */
export const PROBLEM_MEDIA_TYPE = "application/concise-problem-details+cbor";
