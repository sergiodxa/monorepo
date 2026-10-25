/**
 * SCITT (RFC 9943) for issuers and verifiers: Signed Statements over COSE_Sign1, Receipts
 * with RFC 9162 inclusion proofs (RFC 9942), Transparent Statements, and a SCRAPI client for
 * registering statements with a Transparency Service and reading its keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type {
	Registration,
	ReceiptStatus,
	RequestOptions,
	TransparencyServiceOptions,
} from "./client.js";
export type { SCITTErrorCode, ServiceErrorCode } from "./errors.js";
export type { InclusionProof } from "./merkle.js";
export type {
	Receipt,
	ReceiptKeys,
	ReceiptVerifyOptions,
	TransparentStatementOptions,
	VerifiedReceipt,
	VerifiedTransparentStatement,
} from "./receipt.js";
export type { SignedStatement, SigningKey, StatementOptions } from "./statement.js";

export * as Label from "./labels.js";
export { TransparencyService } from "./client.js";
export { SCITTError, ServiceError } from "./errors.js";
export { leafHash, rootFromInclusionProof } from "./merkle.js";
export { readReceipt, verifyReceipt, verifyTransparentStatement } from "./receipt.js";
export {
	attachReceipts,
	readStatement,
	registeredEntry,
	signStatement,
	verifyStatement,
} from "./statement.js";
