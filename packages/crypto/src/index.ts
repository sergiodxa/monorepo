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

export type { BinaryLike, Bytes } from "./lib/bytes";

export { Base64Url, Hex } from "./encoding";
export {
	CryptoError,
	DecryptionError,
	InvalidEncodingError,
	InvalidEnvelopeError,
	InvalidKeyError,
	MalformedHashError,
	UnsupportedAlgorithmError,
} from "./errors";
export { sha256 } from "./hash";
export { hmac } from "./hmac";
export { password } from "./password";
export { randomBytes, randomToken } from "./random";
export { importKey, open, seal } from "./seal";
export { timingSafeEqual } from "./timing-safe-equal";
export { totp } from "./totp";
