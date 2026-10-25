/**
 * SCITT Receipts (RFC 9942, RFC 9943 Section 7): a Transparency Service's signature over the
 * Merkle root an inclusion proof leads to. Verifying one proves the entry sits in the log the
 * service signed, without asking the service.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CBORValue } from "@sdxc/cbor";
import type { Result } from "@sdxc/result";

import { decode } from "@sdxc/cbor";
import * as COSE from "@sdxc/cbor/cose";
import { Base64Url } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { InclusionProof } from "./merkle.js";
import type { SignedStatement } from "./statement.js";

import { SCITTError } from "./errors.js";
import { INCLUSION_PROOFS, ISS, RFC9162_SHA256, SUB, VDP, VDS } from "./labels.js";
import { leafHash, rootFromInclusionProof } from "./merkle.js";
import { readStatement, registeredEntry, verifyStatement } from "./statement.js";

/** A Receipt as read from its COSE_Sign1 message. */
export interface Receipt {
	/** The Transparency Service's issuer claim, when the receipt carries CWT claims. */
	issuer: string | undefined;
	/** The subject claim, when the receipt carries one. */
	subject: string | undefined;
	/** The service key's identifier; SCRAPI services may write it as text. */
	kid: Uint8Array | string | undefined;
	/** The COSE signature algorithm. */
	algorithm: number;
	/** The Verifiable Data Structure the proofs belong to. */
	vds: number;
	/** The inclusion proofs under `vdp`. */
	inclusionProofs: InclusionProof[];
	/** The underlying COSE_Sign1 message. */
	message: COSE.Sign1;
}

/** A Receipt whose proof and signature verified, with the root they agree on. */
export interface VerifiedReceipt extends Receipt {
	/** The signed Merkle root the entry is included under. */
	root: Uint8Array;
	/** The inclusion proof that led to it. */
	proof: InclusionProof;
}

/**
 * The keys a Receipt can verify under: one public key, or a Transparency Service's COSE key
 * set, searched by the receipt's `kid` and then by RFC 9679 thumbprint.
 */
export type ReceiptKeys = CryptoKey | COSE.Key[];

/** How `verifyReceipt` checks a receipt. */
export interface ReceiptVerifyOptions {
	/** The registered entry bytes the proof's leaf hash is taken over. */
	entry: Uint8Array;
	/** The service's key or key set. */
	keys: ReceiptKeys;
	/** The service's issuer claim the receipt must carry. Default: any. */
	issuer?: string;
	/** Signature algorithms to accept. Default: whichever one the key runs. */
	algorithms?: number[];
}

/** Nesting a receipt may reach: tag, message, headers, proofs. */
const RECEIPT_DEPTH = 16;

/**
 * Reads a Receipt without checking it. It must name a signature algorithm and a Verifiable
 * Data Structure in its protected header and carry at least one inclusion proof under `vdp`.
 * Only RFC9162_SHA256 proofs are understood; any other VDS fails `unsupported-vds`.
 *
 * @param receipt The receipt bytes.
 * @returns The receipt, or `malformed` / `unsupported-vds`.
 * @example
 * let receipt = readReceipt(bytes); // success({ vds: 1, inclusionProofs: [{ treeSize, leafIndex, path }], … })
 */
export function readReceipt(receipt: Uint8Array): Result<Receipt, SCITTError> {
	let message = COSE.decodeSign1(receipt);
	if (isFailure(message)) return failure(new SCITTError(message.error.code, message.error.message));
	let header = message.data.protected;

	let algorithm = header.get(COSE.HeaderParameter.ALG);
	if (typeof algorithm !== "number")
		return failure(new SCITTError("malformed", "receipt names no algorithm"));
	let vds = header.get(VDS);
	if (typeof vds !== "number") return failure(new SCITTError("malformed", "receipt names no vds"));
	if (vds !== RFC9162_SHA256)
		return failure(new SCITTError("unsupported-vds", `unsupported vds ${vds}`));

	let proofs = readInclusionProofs(message.data.unprotected.get(VDP));
	if (isFailure(proofs)) return proofs;

	let claims = header.get(COSE.HeaderParameter.CWT_CLAIMS);
	let claim = (key: number) => {
		let value = claims instanceof Map ? claims.get(key) : undefined;
		return typeof value === "string" ? value : undefined;
	};
	let kid = header.get(COSE.HeaderParameter.KID);

	return success({
		issuer: claim(ISS),
		subject: claim(SUB),
		kid: kid instanceof Uint8Array || typeof kid === "string" ? kid : undefined,
		algorithm,
		vds,
		inclusionProofs: proofs.data,
		message: message.data,
	});
}

/** The RFC9162_SHA256 inclusion proofs a `vdp` map holds, each `bstr .cbor [size, index, path]`. */
function readInclusionProofs(vdp: CBORValue): Result<InclusionProof[], SCITTError> {
	if (!(vdp instanceof Map)) return failure(new SCITTError("malformed", "receipt has no vdp map"));
	let encoded = vdp.get(INCLUSION_PROOFS);
	if (!Array.isArray(encoded) || encoded.length === 0) {
		return failure(new SCITTError("malformed", "receipt has no inclusion proofs"));
	}

	let proofs: InclusionProof[] = [];
	for (let item of encoded) {
		if (!(item instanceof Uint8Array))
			return failure(new SCITTError("malformed", "inclusion proof is not a byte string"));
		let decoded = decode(item, { maxDepth: RECEIPT_DEPTH });
		if (isFailure(decoded))
			return failure(new SCITTError("malformed", `inclusion proof: ${decoded.error.message}`));
		let content = decoded.data;
		if (!Array.isArray(content) || content.length !== 3) {
			return failure(
				new SCITTError("malformed", "inclusion proof is not [tree-size, leaf-index, path]"),
			);
		}
		let [treeSize, leafIndex, path] = content;
		if (typeof treeSize !== "number" || typeof leafIndex !== "number") {
			return failure(
				new SCITTError("malformed", "tree size and leaf index must be unsigned integers"),
			);
		}
		if (!Array.isArray(path) || !path.every((node) => node instanceof Uint8Array)) {
			return failure(new SCITTError("malformed", "inclusion path is not an array of byte strings"));
		}
		proofs.push({ treeSize, leafIndex, path: path as Uint8Array[] });
	}
	return success(proofs);
}

/**
 * Verifies a Receipt for `entry`: the inclusion proof leads from the entry's leaf hash to a
 * root, and the service's signature covers that root as the detached payload. One proof that
 * does both is enough.
 *
 * @param receipt Receipt bytes, or a receipt `readReceipt` already read.
 * @returns The receipt with its root, or `invalid-proof`, `invalid-signature`, `unknown-key`,
 * `untrusted-issuer` or a read failure.
 * @example
 * let verified = await verifyReceipt(receipt, { entry: registeredEntryBytes, keys: serviceKeys });
 */
export async function verifyReceipt(
	receipt: Uint8Array | Receipt,
	options: ReceiptVerifyOptions,
): Promise<Result<VerifiedReceipt, SCITTError>> {
	let read = receipt instanceof Uint8Array ? readReceipt(receipt) : success(receipt);
	if (isFailure(read)) return read;
	if (options.issuer !== undefined && read.data.issuer !== options.issuer) {
		return failure(new SCITTError("untrusted-issuer", `receipt issuer is not ${options.issuer}`));
	}

	let key = await resolveKey(read.data, options.keys);
	if (isFailure(key)) return key;

	let leaf = await leafHash(options.entry);
	let lastFailure = new SCITTError("invalid-proof", "no inclusion proof verifies");
	for (let proof of read.data.inclusionProofs) {
		let root = await rootFromInclusionProof(leaf, proof);
		if (isFailure(root)) {
			lastFailure = root.error;
			continue;
		}
		let verified = await COSE.verifySign1(read.data.message, key.data, {
			payload: root.data,
			algorithms: options.algorithms,
			understood: [COSE.HeaderParameter.CWT_CLAIMS, VDS],
		});
		if (isFailure(verified)) {
			if (verified.error.code !== "invalid-signature")
				return failure(new SCITTError(verified.error.code, verified.error.message));
			lastFailure = new SCITTError(
				"invalid-signature",
				"receipt signature does not cover the proof's root",
			);
			continue;
		}
		return success({ ...read.data, root: root.data, proof });
	}
	return failure(lastFailure);
}

/**
 * The key a receipt verifies under: the one `CryptoKey` given, or the key-set entry whose
 * `kid` (label 2) or RFC 9679 thumbprint equals the receipt's `kid`. A receipt with no `kid`
 * resolves only against a set of one.
 */
async function resolveKey(
	receipt: Receipt,
	keys: ReceiptKeys,
): Promise<Result<CryptoKey, SCITTError>> {
	if (!Array.isArray(keys)) return success(keys);

	let match: COSE.Key | undefined;
	if (receipt.kid !== undefined) match = await findKey(keys, kidForms(receipt.kid));
	else if (keys.length === 1) match = keys[0];
	if (!match)
		return failure(new SCITTError("unknown-key", "no service key matches the receipt's kid"));

	let imported = await COSE.importKey(match, receipt.algorithm);
	if (isFailure(imported))
		return failure(new SCITTError(imported.error.code, imported.error.message));
	return success(imported.data);
}

/**
 * The byte forms a receipt's `kid` may stand for. A text `kid` is matched as its UTF-8 bytes
 * and, when it reads as base64url, as the bytes it encodes, the form SCRAPI publishes keys by.
 */
function kidForms(kid: Uint8Array | string): Uint8Array[] {
	if (typeof kid !== "string") return [kid];
	let decoded = Base64Url.decode(kid);
	let forms: Uint8Array[] = [new TextEncoder().encode(kid)];
	if (!isFailure(decoded)) forms.push(decoded.data);
	return forms;
}

/** The key whose `kid` or RFC 9679 thumbprint equals one of `kids`. */
async function findKey(keys: COSE.Key[], kids: Uint8Array[]): Promise<COSE.Key | undefined> {
	let matches = (bytes: Uint8Array) => kids.some((kid) => sameBytes(bytes, kid));
	let byKid = keys.find((key) => {
		let own = key.get(2);
		return own instanceof Uint8Array && matches(own);
	});
	if (byKid) return byKid;
	for (let key of keys) {
		let thumbprint = await COSE.thumbprint(key);
		if (!isFailure(thumbprint) && matches(thumbprint.data)) return key;
	}
	return undefined;
}

/** Whether two byte strings hold the same bytes. */
function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
	return left.length === right.length && left.every((byte, index) => byte === right[index]);
}

/** What `verifyTransparentStatement` checks. */
export interface TransparentStatementOptions {
	/** The Transparency Service's key or key set its receipts verify under. */
	keys: ReceiptKeys;
	/** The service's issuer claim the receipts must carry. Default: any. */
	issuer?: string;
	/** The issuer's public key, to verify the statement's own signature too. */
	issuerKey?: CryptoKey;
	/** The payload of a detached statement, for the issuer signature check. */
	payload?: Uint8Array;
}

/** A Transparent Statement whose receipts verified. */
export interface VerifiedTransparentStatement {
	/** The statement. */
	statement: SignedStatement;
	/** The receipts that verified under the given keys. */
	receipts: VerifiedReceipt[];
}

/**
 * Verifies a Transparent Statement: each attached receipt whose key the caller holds must prove
 * the registered entry's inclusion, and at least one must. Receipts from services the caller
 * has no key for are skipped. With `issuerKey`, the issuer's own signature is checked first.
 *
 * @returns The statement and the receipts that verified, or the first failure.
 * @example
 * let result = await verifyTransparentStatement(bytes, { keys: serviceKeys, issuerKey });
 */
export async function verifyTransparentStatement(
	bytes: Uint8Array,
	options: TransparentStatementOptions,
): Promise<Result<VerifiedTransparentStatement, SCITTError>> {
	let statement = readStatement(bytes);
	if (isFailure(statement)) return statement;
	if (options.issuerKey) {
		let verified = await verifyStatement(statement.data, options.issuerKey, {
			payload: options.payload,
		});
		if (isFailure(verified)) return verified;
	}

	let entry = registeredEntry(bytes);
	if (isFailure(entry)) return entry;

	let receipts: VerifiedReceipt[] = [];
	for (let encoded of statement.data.receipts) {
		let verified = await verifyReceipt(encoded, {
			entry: entry.data,
			keys: options.keys,
			issuer: options.issuer,
		});
		if (isFailure(verified)) {
			if (verified.error.code === "unknown-key" || verified.error.code === "untrusted-issuer")
				continue;
			return verified;
		}
		receipts.push(verified.data);
	}
	if (receipts.length === 0)
		return failure(new SCITTError("unknown-key", "no receipt verifies under the given keys"));
	return success({ statement: statement.data, receipts });
}
