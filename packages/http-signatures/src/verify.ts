/**
 * Verifies an incoming request signed with RFC 9421 or draft-cavage-12, detecting the
 * scheme from its headers, and fails unless the signature covers enough of the request
 * (method, target, host, a time, and the body's digest) to bind it to this one message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BinaryLike, Bytes } from "@sdxc/crypto";
import type { DigestValueField } from "@sdxc/digest-fields";
import type { Result } from "@sdxc/result";

import { verify as verifyDigest } from "@sdxc/digest-fields";
import { toMs } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";

import type { HttpSignatureErrorCode } from "./errors.js";
import type { Message } from "./lib/base.js";
import type { Algorithm, Component, Verified, VerifyOptions } from "./types.js";

import { parseCavageSignature } from "./cavage-field.js";
import { HttpSignatureError } from "./errors.js";
import { parseSignature, readSignatureInput, serializeIdentifier } from "./fields.js";
import { algorithmOfKey, isAlgorithm, verifyWith } from "./lib/algorithms.js";
import { messageOf, signatureBase, signingString } from "./lib/base.js";
import { toBytes } from "./lib/bytes.js";

/** Clock difference allowed when `clockSkew` is left out. */
const DEFAULT_CLOCK_SKEW = "5 minutes";

/** The digest fields a signature can cover to bind the body. */
const DIGEST_FIELDS: readonly DigestValueField[] = ["content-digest", "repr-digest", "digest"];

/** The cavage algorithm names this package verifies. */
const CAVAGE_ALGORITHMS = new Set(["hs2019", "rsa-sha256"]);

/** What both schemes hand the shared checks once their own fields are read. */
interface Candidate {
	keyId: string;
	/** The declared algorithm name, passed to the key lookup. */
	declared: string | null;
	/** The coverage every check reads: component or header names. */
	covered: string[];
	/** The `created` parameter, `null` when the signature relies on `Date`. */
	created: Date | null;
	expires: Date | null;
	signature: Uint8Array;
	/** The bytes the signature was computed over. */
	data: Bytes;
	/** Picks the algorithm once the key is known. */
	algorithmFor(key: CryptoKey): Algorithm | null;
}

/** A signature read from its scheme's fields, with what `Verified` reports about it. */
interface ReadSignature extends Candidate {
	label: string | null;
	components: string[];
}

/**
 * Verifies the signature on a request.
 *
 * `Signature-Input` selects RFC 9421; a `Signature` (or `Authorization: Signature`) alone
 * selects draft-cavage-12. The checks run in order and stop at the first failure:
 * coverage, the body digest, the age of `created` or `Date`, the key lookup, the
 * algorithm, then the signature itself, so a stale or incomplete request never costs a key fetch.
 *
 * @param request - The incoming request.
 * @param options - Body bytes, key lookup and time window.
 * @returns What the signature establishes, or a failure whose code names the check.
 * @example await verify(request, { body, key: (keyId) => resolveKey(keyId), maxAge: "1 hour" })
 */
export async function verify(
	request: Request,
	options: VerifyOptions,
): Promise<Result<Verified, HttpSignatureError>> {
	let message = messageOf(request);
	let input = request.headers.get("signature-input");
	let cavage = request.headers.get("signature") ?? authorizationSignature(request.headers);
	if (input === null && cavage === null) {
		return failure(new HttpSignatureError("unsigned", "The request carries no signature"));
	}

	let body = await readBody(request, options.body);
	if (isFailure(body)) return body;

	let candidate =
		input === null
			? readCavage(message, cavage ?? "")
			: readRfc9421(message, input, request.headers.get("signature"), options.label);
	if (isFailure(candidate)) return candidate;

	let { label, components, ...read } = candidate.data;
	let checked = await check(message, read, body.data, options);
	if (isFailure(checked)) return checked;

	return success({
		scheme: input === null ? "draft-cavage" : "rfc9421",
		keyId: read.keyId,
		label,
		created: checked.data,
		components,
	});
}

/**
 * The checks both schemes share, in order.
 *
 * @param message - The request.
 * @param candidate - The signature read from its scheme's fields.
 * @param body - The body bytes, `null` without a body.
 * @param options - The caller's options.
 * @returns The signature's time.
 */
async function check(
	message: Message,
	candidate: Candidate,
	body: Bytes | null,
	options: VerifyOptions,
): Promise<Result<Date, HttpSignatureError>> {
	let coverage = checkCoverage(candidate, body !== null && body.length > 0);
	if (isFailure(coverage)) return coverage;

	for (let field of DIGEST_FIELDS) {
		if (!candidate.covered.includes(field)) continue;
		let matched = await verifyDigest(message.headers, body ?? new Uint8Array(), { field });
		if (isFailure(matched)) {
			let code: HttpSignatureErrorCode =
				matched.error.code === "missing" ? "missing-component" : "digest-mismatch";
			return failure(new HttpSignatureError(code, matched.error.message, { cause: matched.error }));
		}
	}

	let created = signatureTime(message, candidate);
	if (isFailure(created)) return created;
	let fresh = checkFreshness(created.data, candidate.expires, options);
	if (isFailure(fresh)) return fresh;

	let key = await lookupKey(candidate, options);
	if (isFailure(key)) return key;

	let algorithm = candidate.algorithmFor(key.data);
	if (algorithm === null) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", "The algorithm does not fit the key"),
		);
	}

	let verified = await verifyWith(algorithm, key.data, candidate.signature, candidate.data);
	if (isFailure(verified)) return verified;
	return success(created.data);
}

/**
 * Reads an RFC 9421 signature: the chosen label's `Signature-Input` member and its
 * `Signature` bytes, with the signature base built from them.
 *
 * @param message - The request.
 * @param inputText - The `Signature-Input` value.
 * @param signatureText - The `Signature` value.
 * @param wanted - The label to verify, or the first signed one.
 */
function readRfc9421(
	message: Message,
	inputText: string,
	signatureText: string | null,
	wanted: string | undefined,
): Result<ReadSignature, HttpSignatureError> {
	if (signatureText === null) {
		return failure(new HttpSignatureError("unsigned", "Signature-Input has no Signature"));
	}

	let inputs = readSignatureInput(inputText);
	if (isFailure(inputs)) return inputs;
	let signatures = parseSignature(signatureText);
	if (isFailure(signatures)) return signatures;

	let label = wanted ?? Object.keys(inputs.data).find((key) => key in signatures.data);
	let member = label === undefined ? undefined : inputs.data[label];
	let signature = label === undefined ? undefined : signatures.data[label];
	if (label === undefined || member === undefined || signature === undefined) {
		return failure(new HttpSignatureError("unsigned", "No signature carries the label"));
	}

	let { components, params } = member.input;
	if (params.keyid === undefined) {
		return failure(new HttpSignatureError("malformed", "The signature names no keyid"));
	}

	let base = signatureBase(message, components, member.serialized);
	if (isFailure(base)) return base;

	let identifiers = describe(components);
	if (isFailure(identifiers)) return identifiers;

	let declared = params.alg ?? null;
	return success({
		label,
		components: identifiers.data,
		keyId: params.keyid,
		declared,
		covered: components.map((component) => component.name),
		created: params.created ?? null,
		expires: params.expires ?? null,
		signature,
		data: toBytes(base.data),
		algorithmFor(key) {
			let fromKey = algorithmOfKey(key);
			if (declared === null) return fromKey;
			return isAlgorithm(declared) && declared === fromKey ? declared : null;
		},
	});
}

/**
 * Reads a draft-cavage-12 signature and builds its signing string. Without `headers`, it
 * covers `(created)` with a `created` parameter and `date` otherwise, as Mastodon assumes.
 * `created` and `expires` count only when covered, since a relay can rewrite them.
 *
 * @param message - The request.
 * @param text - The `Signature` value.
 */
function readCavage(message: Message, text: string): Result<ReadSignature, HttpSignatureError> {
	let parsed = parseCavageSignature(text);
	if (isFailure(parsed)) return parsed;

	let signature = parsed.data;
	let declared = signature.algorithm ?? "hs2019";
	if (!CAVAGE_ALGORITHMS.has(declared)) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", "The signature algorithm is unsupported"),
		);
	}

	let covered = signature.headers ?? [signature.created === null ? "date" : "(created)"];
	let created = covered.includes("(created)") ? signature.created : null;
	let expires = covered.includes("(expires)") ? signature.expires : null;
	let data = signingString(message, covered, { algorithm: declared, created, expires });
	if (isFailure(data)) return data;

	return success({
		label: null,
		components: covered,
		keyId: signature.keyId,
		declared: signature.algorithm,
		covered,
		created,
		expires,
		signature: signature.signature,
		data: toBytes(data.data),
		algorithmFor(key) {
			let fromKey = algorithmOfKey(key);
			if (declared === "rsa-sha256") return fromKey === "rsa-v1_5-sha256" ? fromKey : null;
			return fromKey;
		},
	});
}

/**
 * Fails unless the signature covers the method, the target, the host, a time and, with a
 * body, a digest of it. `@target-uri` carries the authority as well as the target.
 *
 * @param candidate - The signature.
 * @param hasBody - Whether the request has a non-empty body.
 */
function checkCoverage(candidate: Candidate, hasBody: boolean): Result<void, HttpSignatureError> {
	let covers = (...names: string[]) => names.some((name) => candidate.covered.includes(name));
	let missing: string[] = [];

	if (!covers("@method", "(request-target)")) missing.push("the method");
	if (!covers("@target-uri", "@request-target", "@path", "(request-target)")) {
		missing.push("the target");
	}
	if (!covers("@authority", "@target-uri", "host")) missing.push("the host");
	if (candidate.created === null && !covers("date")) missing.push("a time");
	if (hasBody && !covers(...DIGEST_FIELDS)) missing.push("the body digest");

	if (missing.length > 0) {
		return failure(
			new HttpSignatureError(
				"insufficient-coverage",
				`The signature leaves out ${missing.join(", ")}`,
			),
		);
	}
	return success(undefined);
}

/**
 * The time a signature was made: its `created` parameter, else the covered `Date`.
 *
 * @param message - The request.
 * @param candidate - The signature.
 */
function signatureTime(message: Message, candidate: Candidate): Result<Date, HttpSignatureError> {
	if (candidate.created !== null) return success(candidate.created);

	let date = Date.parse(message.headers.get("date") ?? "");
	if (Number.isNaN(date)) return failure(new HttpSignatureError("malformed", "Date is not a date"));
	return success(new Date(date));
}

/**
 * Fails when a signature is older than `maxAge`, dated in the future, or past `expires`,
 * each allowing `clockSkew` of difference between the two clocks.
 *
 * @param created - When the signature was made.
 * @param expires - When it stops being valid, if it says.
 * @param options - The caller's window.
 */
function checkFreshness(
	created: Date,
	expires: Date | null,
	options: VerifyOptions,
): Result<void, HttpSignatureError> {
	let now = (options.now ?? new Date()).getTime();
	let skew = toMs(options.clockSkew ?? DEFAULT_CLOCK_SKEW);
	let age = now - created.getTime();

	if (age > toMs(options.maxAge) + skew) return failure(stale("The signature is too old"));
	if (age < -skew) return failure(stale("The signature is dated in the future"));
	if (expires !== null && now > expires.getTime() + skew) {
		return failure(stale("The signature has expired"));
	}
	return success(undefined);
}

/**
 * Resolves the signature's key through the caller's lookup.
 *
 * @param candidate - The signature.
 * @param options - The caller's lookup.
 */
async function lookupKey(
	candidate: Candidate,
	options: VerifyOptions,
): Promise<Result<CryptoKey, HttpSignatureError>> {
	let key = await options.key(candidate.keyId, candidate.declared);
	if (isFailure(key)) {
		return failure(
			new HttpSignatureError("key-unavailable", `No key for ${candidate.keyId}`, {
				cause: key.error,
			}),
		);
	}
	if (key.data === null) {
		return failure(new HttpSignatureError("key-unavailable", `No key for ${candidate.keyId}`));
	}
	return success(key.data);
}

/**
 * The body bytes to check: the caller's, else a clone of the request's own.
 *
 * @param request - The request.
 * @param body - The caller's body bytes, if given.
 * @returns The bytes, `null` for a request without a body, or `malformed` when the body
 *   was already read and none was passed.
 */
async function readBody(
	request: Request,
	body: BinaryLike | undefined,
): Promise<Result<Bytes | null, HttpSignatureError>> {
	if (body !== undefined) return success(toBytes(body));
	if (request.body === null) return success(null);
	if (request.bodyUsed) {
		return failure(
			new HttpSignatureError("malformed", "The body was already read; pass it as `body`"),
		);
	}
	return success(new Uint8Array(await request.clone().arrayBuffer()));
}

/**
 * The cavage parameters of `Authorization: Signature …`, the other place draft-cavage
 * lets a signature travel.
 *
 * @param headers - The request headers.
 */
function authorizationSignature(headers: Headers): string | null {
	let authorization = headers.get("authorization");
	let match = authorization === null ? null : /^Signature\s+(.+)$/is.exec(authorization);
	return match?.[1] ?? null;
}

/**
 * Covered components as `Verified.components` lists them: the name, with any parameters
 * appended as they serialize.
 *
 * @param components - The covered components.
 */
function describe(components: Component[]): Result<string[], HttpSignatureError> {
	let described: string[] = [];
	for (let component of components) {
		let identifier = serializeIdentifier(component);
		if (isFailure(identifier)) return identifier;
		let params = identifier.data.slice(identifier.data.indexOf('"', 1) + 1);
		described.push(`${component.name}${params}`);
	}
	return success(described);
}

/**
 * A `stale-signature` failure.
 *
 * @param message - Which bound it crossed.
 */
function stale(message: string): HttpSignatureError {
	return new HttpSignatureError("stale-signature", message);
}
