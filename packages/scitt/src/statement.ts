/**
 * SCITT Signed Statements (RFC 9943 Section 6): COSE_Sign1 messages whose protected header
 * binds the issuer and subject as CWT claims. Issuers sign them here, Relying Parties read
 * and verify them, and receipts attach to them to make Transparent Statements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CBORValue } from "@sdxc/cbor";
import type { Result } from "@sdxc/result";

import * as COSE from "@sdxc/cbor/cose";
import { failure, isFailure, success } from "@sdxc/result";

import { SCITTError } from "./errors.js";
import { IAT, ISS, RECEIPTS, SUB } from "./labels.js";

/**
 * A private key and the identifiers a statement names it by. An `@sdxc/jwt` key pair fits:
 * its `id` becomes the `kid` and its JOSE `alg` name maps to the COSE algorithm.
 */
export interface SigningKey {
	/** The `kid`; a string is written as its UTF-8 bytes. */
	id: string | Uint8Array;
	/** A COSE algorithm number, or a JOSE name: ES256, ES384, ES512, Ed25519, EdDSA, PS256, PS384, PS512. */
	alg: string | number;
	/** The private key, imported for that algorithm. */
	private: CryptoKey;
}

/** What `signStatement` signs. */
export interface StatementOptions {
	/** The issuer claim (`iss`), the identity the statement is made under. */
	issuer: string;
	/** The subject claim (`sub`), the Artifact the statement is about. */
	subject: string;
	/** The statement bytes, or a digest of them when the statement itself stays private. */
	payload: Uint8Array;
	/** The payload's media type or CoAP content format. */
	contentType?: string | number;
	/** Leave the payload out of the message. Default `false`. */
	detached?: boolean;
	/** When the statement was made, written as the `iat` claim. */
	issuedAt?: Date;
	/** Further CWT claims, by claim key. */
	claims?: Map<CBORValue, CBORValue>;
	/** Further protected header parameters, by label. */
	headers?: COSE.Header;
	/** The issuer's signing key. */
	key: SigningKey;
}

/** A Signed Statement as read from its COSE_Sign1 message. */
export interface SignedStatement {
	/** The issuer claim. */
	issuer: string;
	/** The subject claim. */
	subject: string;
	/** The payload's media type or content format, when the header names one. */
	contentType: string | number | undefined;
	/** The key identifier, when the header carries one rather than an X.509 reference. */
	kid: Uint8Array | undefined;
	/** The COSE signature algorithm. */
	algorithm: number;
	/** Every CWT claim in the protected header. */
	claims: Map<CBORValue, CBORValue>;
	/** The payload, or `null` when it is detached. */
	payload: Uint8Array | null;
	/** Encoded Receipts in the unprotected header; empty for a statement not yet registered. */
	receipts: Uint8Array[];
	/** The underlying COSE_Sign1 message. */
	message: COSE.Sign1;
}

/** JOSE algorithm names and the COSE algorithms they correspond to. */
const JOSE_ALGORITHMS: Record<string, number> = {
	ES256: COSE.Algorithm.ES256,
	ES384: COSE.Algorithm.ES384,
	ES512: COSE.Algorithm.ES512,
	Ed25519: COSE.Algorithm.ED25519,
	EdDSA: COSE.Algorithm.EDDSA,
	PS256: COSE.Algorithm.PS256,
	PS384: COSE.Algorithm.PS384,
	PS512: COSE.Algorithm.PS512,
};

/**
 * Signs a Signed Statement. The protected header carries the algorithm, the `kid`, the content
 * type and the CWT claims with `iss` and `sub`, everything RFC 9943 requires a Transparency
 * Service to find there.
 *
 * @returns The tagged COSE_Sign1 bytes, ready to register.
 * @example
 * let statement = await signStatement({ issuer: "https://vendor.example", subject: "pkg@1.2.3", payload, key });
 */
export async function signStatement(
	options: StatementOptions,
): Promise<Result<Uint8Array<ArrayBuffer>, SCITTError>> {
	let algorithm =
		typeof options.key.alg === "number" ? options.key.alg : JOSE_ALGORITHMS[options.key.alg];
	if (algorithm === undefined) {
		return failure(
			new SCITTError("unsupported-algorithm", `unsupported algorithm ${String(options.key.alg)}`),
		);
	}
	if (options.issuer === "" || options.subject === "") {
		return failure(new SCITTError("missing-claim", "issuer and subject must not be empty"));
	}

	let claims = new Map<CBORValue, CBORValue>(options.claims);
	claims.set(ISS, options.issuer);
	claims.set(SUB, options.subject);
	if (options.issuedAt) claims.set(IAT, Math.floor(options.issuedAt.getTime() / 1000));

	let header: COSE.Header = new Map(options.headers);
	header.set(COSE.HeaderParameter.ALG, algorithm);
	header.set(COSE.HeaderParameter.KID, kidBytes(options.key.id));
	if (options.contentType !== undefined)
		header.set(COSE.HeaderParameter.CONTENT_TYPE, options.contentType);
	header.set(COSE.HeaderParameter.CWT_CLAIMS, claims);

	let signed = await COSE.sign1({
		protected: header,
		payload: options.payload,
		detached: options.detached,
		key: options.key.private,
	});
	if (isFailure(signed)) return failure(new SCITTError(signed.error.code, signed.error.message));
	return signed;
}

/** A `kid` as the byte string COSE requires. */
function kidBytes(id: string | Uint8Array): Uint8Array<ArrayBuffer> {
	return typeof id === "string" ? new TextEncoder().encode(id) : Uint8Array.from(id);
}

/**
 * Reads a Signed Statement or Transparent Statement without checking its signature. It must
 * carry an algorithm, CWT claims with text `iss` and `sub`, and a `kid` unless an X.509
 * `x5t` or `x5chain` identifies the key.
 *
 * @returns The statement, or `malformed` / `missing-claim`.
 * @example
 * let statement = readStatement(bytes); // success({ issuer, subject, receipts, … })
 */
export function readStatement(bytes: Uint8Array): Result<SignedStatement, SCITTError> {
	let message = COSE.decodeSign1(bytes);
	if (isFailure(message)) return failure(new SCITTError(message.error.code, message.error.message));
	return fromMessage(message.data);
}

/** The Signed Statement a decoded COSE_Sign1 message holds. */
function fromMessage(message: COSE.Sign1): Result<SignedStatement, SCITTError> {
	let header = message.protected;
	let algorithm = header.get(COSE.HeaderParameter.ALG);
	if (typeof algorithm !== "number")
		return failure(new SCITTError("malformed", "protected header names no algorithm"));

	let claims = header.get(COSE.HeaderParameter.CWT_CLAIMS);
	if (!(claims instanceof Map))
		return failure(new SCITTError("missing-claim", "protected header has no CWT claims"));
	let issuer = claims.get(ISS);
	let subject = claims.get(SUB);
	if (typeof issuer !== "string" || issuer === "")
		return failure(new SCITTError("missing-claim", "no iss claim"));
	if (typeof subject !== "string" || subject === "")
		return failure(new SCITTError("missing-claim", "no sub claim"));

	let kid = header.get(COSE.HeaderParameter.KID);
	let x509 = header.has(COSE.HeaderParameter.X5T) || header.has(COSE.HeaderParameter.X5CHAIN);
	if (!(kid instanceof Uint8Array) && !x509) {
		return failure(
			new SCITTError("malformed", "protected header has neither kid nor an X.509 reference"),
		);
	}

	let contentType = header.get(COSE.HeaderParameter.CONTENT_TYPE);
	let receipts = message.unprotected.get(RECEIPTS) ?? [];
	if (!Array.isArray(receipts) || !receipts.every((receipt) => receipt instanceof Uint8Array)) {
		return failure(new SCITTError("malformed", "receipts are not an array of byte strings"));
	}

	return success({
		issuer,
		subject,
		contentType:
			typeof contentType === "string" || typeof contentType === "number" ? contentType : undefined,
		kid: kid instanceof Uint8Array ? kid : undefined,
		algorithm,
		claims,
		payload: message.payload,
		receipts: receipts as Uint8Array[],
		message,
	});
}

/**
 * Verifies a Signed Statement under the issuer's public key. How that key is found from the
 * `kid` or certificate is the caller's trust decision; RFC 9943 leaves key discovery open.
 *
 * @param statement Statement bytes, or a statement `readStatement` already read.
 * @param key The issuer's public key.
 * @param options `payload` for a detached statement; `algorithms` to accept.
 * @returns The statement, or why it does not verify.
 * @example
 * let verified = await verifyStatement(bytes, issuerKey, { payload: artifactDigest });
 */
export async function verifyStatement(
	statement: Uint8Array | SignedStatement,
	key: CryptoKey,
	options: { payload?: Uint8Array; algorithms?: number[] } = {},
): Promise<Result<SignedStatement, SCITTError>> {
	let read = statement instanceof Uint8Array ? readStatement(statement) : success(statement);
	if (isFailure(read)) return read;

	let verified = await COSE.verifySign1(read.data.message, key, {
		...options,
		understood: [COSE.HeaderParameter.CWT_CLAIMS],
	});
	if (isFailure(verified))
		return failure(new SCITTError(verified.error.code, verified.error.message));
	return read;
}

/**
 * Attaches Receipts to a statement's unprotected header, after any it already carries,
 * producing a Transparent Statement. The signature stays valid: the protected header bytes are
 * kept as signed.
 *
 * @example
 * let transparent = attachReceipts(statement, [receipt]);
 */
export function attachReceipts(
	statement: Uint8Array,
	receipts: Uint8Array[],
): Result<Uint8Array<ArrayBuffer>, SCITTError> {
	let read = readStatement(statement);
	if (isFailure(read)) return read;
	let unprotected = new Map(read.data.message.unprotected);
	unprotected.set(
		RECEIPTS,
		[...read.data.receipts, ...receipts].map((receipt) => Uint8Array.from(receipt)),
	);
	let bytes = COSE.encodeSign1({ ...read.data.message, unprotected });
	if (isFailure(bytes)) return failure(new SCITTError(bytes.error.code, bytes.error.message));
	return bytes;
}

/**
 * The bytes a Transparency Service registers for a statement: the COSE_Sign1 with its
 * unprotected header emptied, as RFC 9943 Section 6.3 requires before a statement enters the
 * log. A Receipt's inclusion proof starts from the leaf hash of these bytes.
 *
 * @example
 * let entry = registeredEntry(transparentStatement);
 */
export function registeredEntry(
	statement: Uint8Array,
): Result<Uint8Array<ArrayBuffer>, SCITTError> {
	let message = COSE.decodeSign1(statement);
	if (isFailure(message)) return failure(new SCITTError(message.error.code, message.error.message));
	let bytes = COSE.encodeSign1({ ...message.data, unprotected: new Map() });
	if (isFailure(bytes)) return failure(new SCITTError(bytes.error.code, bytes.error.message));
	return bytes;
}
