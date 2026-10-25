/**
 * COSE (RFC 9052): keys and COSE_Sign1 signatures over WebCrypto, built on this package's
 * deterministic CBOR so a signer's protected header encodes the same bytes every time.
 * Import it as a namespace, `import * as COSE from "@sdxc/cbor/cose"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { COSEErrorCode } from "./cose/errors.js";
export type { Key } from "./cose/key.js";
export type { Header, Sign1, Sign1Options, VerifyOptions } from "./cose/sign1.js";

export * as Algorithm from "./cose/algorithm.js";
export * as HeaderParameter from "./cose/header.js";
export { COSEError } from "./cose/errors.js";
export { fromJWK, importKey, thumbprint, toJWK } from "./cose/key.js";
export {
	decodeSign1,
	encodeSign1,
	fromValue,
	SIGN1_TAG,
	sign1,
	verifySign1,
} from "./cose/sign1.js";
