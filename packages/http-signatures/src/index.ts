/**
 * Signs and verifies HTTP requests with RFC 9421 message signatures or draft-cavage-12,
 * and parses and serializes their fields. Both schemes share one coverage rule, one
 * freshness window and Web Crypto keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { HttpSignatureErrorCode } from "./errors.js";
export type {
	AcceptSignature,
	AcceptSignatureParameters,
	Algorithm,
	CavageSignature,
	Component,
	ComponentParameters,
	KeyLookup,
	Scheme,
	SignatureInput,
	SignatureParameters,
	SignOptions,
	SigningKey,
	Verified,
	VerifyOptions,
} from "./types.js";

export { parseCavageSignature, stringifyCavageSignature } from "./cavage-field.js";
export { HttpSignatureError } from "./errors.js";
export {
	parseAcceptSignature,
	parseSignature,
	parseSignatureInput,
	stringifyAcceptSignature,
	stringifySignature,
	stringifySignatureInput,
} from "./fields.js";
export { sign } from "./sign.js";
export { verify } from "./verify.js";
