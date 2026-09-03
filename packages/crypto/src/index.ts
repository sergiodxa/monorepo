/**
 * WebCrypto primitives with `Result`-based errors, portable to any runtime.
 *
 * Encoding, digests, HMAC, random tokens, password hashing, TOTP, and authenticated
 * encryption live here once, so security-relevant details are decided in one place
 * instead of being re-derived at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { BinaryLike, Bytes } from "./lib/bytes.js";

export { Base64, Base64Url, Hex } from "./encoding.js";
export {
	CryptoError,
	DecryptionError,
	InvalidEncodingError,
	InvalidEnvelopeError,
	InvalidKeyError,
	MalformedHashError,
	UnsupportedAlgorithmError,
} from "./errors.js";
export { sha256, sha384, sha512 } from "./hash.js";
export { hmac } from "./hmac.js";
export { password } from "./password.js";
export { randomBytes, randomToken } from "./random.js";
export { importKey, open, seal } from "./seal.js";
export { timingSafeEqual } from "./timing-safe-equal.js";
export { totp } from "./totp.js";
