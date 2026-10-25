/**
 * COSE header parameter labels from the IANA registry that signed messages commonly carry,
 * named so a header map reads `[HeaderParameter.ALG, ES256]` rather than `[1, -7]`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Signature algorithm (RFC 9052). */
export const ALG = 1;

/** Labels a verifier must understand to accept the message (RFC 9052). */
export const CRIT = 2;

/** Payload content type: a media type string or a CoAP content format number (RFC 9052). */
export const CONTENT_TYPE = 3;

/** Key identifier, a byte string (RFC 9052). */
export const KID = 4;

/** CWT claims about the message, such as its issuer and subject (RFC 9597). */
export const CWT_CLAIMS = 15;

/** Media type of the whole COSE object (RFC 9596). */
export const TYP = 16;

/** An X.509 certificate chain, leaf first (RFC 9360). */
export const X5CHAIN = 33;

/** Hash of the signer's X.509 certificate (RFC 9360). */
export const X5T = 34;
