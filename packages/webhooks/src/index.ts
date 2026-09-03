/**
 * Standard Webhooks signing and verification, with `Result`-based failures.
 *
 * One implementation of the specification covers both directions: inbound
 * requests are verified against the exact bytes received, with timestamp
 * tolerance, secret rotation, optional schema parsing, and optional delivery-id
 * deduplication; outbound deliveries are signed into the same three headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { KVReplayStoreOptions, ReplayKVNamespace, ReplayStore } from "./replay-store.js";
export type { SecretOptions } from "./secret.js";
export type { SignOptions, SignedDelivery } from "./sign.js";
export type { VerifiedDelivery, VerifiedPayload, VerifyOptions } from "./verify.js";

export {
	DuplicateDeliveryError,
	InvalidDeliveryError,
	InvalidSecretError,
	MalformedSignatureError,
	MalformedTimestampError,
	MissingHeaderError,
	PayloadValidationError,
	ReplayStoreError,
	SignatureComputationError,
	SignatureMismatchError,
	StaleTimestampError,
	UnreadableBodyError,
	WebhookError,
} from "./errors.js";
export { KVReplayStore } from "./replay-store.js";
export { sign } from "./sign.js";
export { verify } from "./verify.js";
