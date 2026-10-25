/**
 * Canonical JSON per RFC 8785 (JCS): the one byte-exact serialization of a JSON value that
 * hashing, signing and request fingerprinting can rely on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { CanonicalJsonError, canonicalize } from "./canonicalize.js";
