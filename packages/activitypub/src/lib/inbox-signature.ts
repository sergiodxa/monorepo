/**
 * The signature half of inbox verification, shared by POSTed activities and signed GETs:
 * the `keyId` read before any fetch so a blocked server costs nothing, the key resolved
 * through the resolver and refetched once when it no longer verifies, as after a rotation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { Verified } from "@sdxc/http-signatures";
import type { Result } from "@sdxc/result";

import {
	HttpSignatureError,
	parseCavageSignature,
	parseSignature,
	parseSignatureInput,
	verify,
} from "@sdxc/http-signatures";
import { failure, isFailure, success } from "@sdxc/result";

import type { ActivityPubFetchError } from "../errors.js";
import type { ResolvedKey, Resolver } from "../remote.js";

import type { InboxErrorCode } from "./inbox-error.js";

import { InboxError } from "./inbox-error.js";

/** The digest headers a signature can cover to bind a body, and their spelling on the wire. */
const DIGEST_HEADERS = ["content-digest", "repr-digest", "digest"] as const;

/** What a signature names before it is verified. */
export interface SignatureHeader {
	keyId: string;
	/** Covered components or cavage header names, lowercase. */
	covered: string[];
}

/**
 * Reads the key id and coverage of the request's signature: the first RFC 9421 label that
 * has both a `Signature-Input` member and a `Signature`, else the cavage `Signature` or
 * `Authorization: Signature`. `null` means the request is unsigned.
 *
 * @param headers - The request headers.
 * @returns The signature's key id and coverage, or `invalid-signature` for a field that
 *   breaks its grammar.
 */
export function readSignatureHeader(headers: Headers): Result<SignatureHeader | null, InboxError> {
	let input = headers.get("signature-input");
	let signature = headers.get("signature");

	if (input !== null) {
		if (signature === null) return success(null);
		let inputs = parseSignatureInput(input);
		if (isFailure(inputs)) return failure(malformed(inputs.error));
		let signatures = parseSignature(signature);
		if (isFailure(signatures)) return failure(malformed(signatures.error));

		let label = Object.keys(inputs.data).find((key) => key in signatures.data);
		let member = label === undefined ? undefined : inputs.data[label];
		if (member === undefined) return success(null);
		let keyId = member.params.keyid;
		if (keyId === undefined) {
			return failure(new InboxError("invalid-signature", "The signature names no keyid"));
		}
		return success({ keyId, covered: member.components.map((component) => component.name) });
	}

	let cavage = signature ?? authorizationSignature(headers);
	if (cavage === null) return success(null);
	let parsed = parseCavageSignature(cavage);
	if (isFailure(parsed)) return failure(malformed(parsed.error));
	let covered = parsed.data.headers ?? [parsed.data.created === null ? "date" : "(created)"];
	return success({ keyId: parsed.data.keyId, covered });
}

/**
 * Fails `digest-mismatch` unless the signature covers a digest header the request carries,
 * which is what binds a POSTed body to the signature.
 *
 * @param headers - The request headers.
 * @param signature - What the signature covers.
 */
export function requireSignedDigest(
	headers: Headers,
	signature: SignatureHeader,
): Result<void, InboxError> {
	let field = DIGEST_HEADERS.find((name) => signature.covered.includes(name));
	if (field === undefined) {
		return failure(new InboxError("digest-mismatch", "The signature covers no body digest"));
	}
	if (!headers.has(field)) {
		return failure(new InboxError("digest-mismatch", `The signed ${field} header is missing`));
	}
	return success(undefined);
}

/** How a signature is checked. */
export interface VerifySignedOptions {
	resolver: Resolver;
	/** The bytes received, already read off the request. */
	body?: Uint8Array;
	maxAge: DurationInput;
	now?: Date;
}

/** A verified signature and the key that verified it. */
export interface SignedBy {
	verified: Verified;
	key: ResolvedKey;
}

/**
 * Verifies the request's signature with the key its `keyId` resolves to. A signature that
 * does not verify with the cached key is tried once more with the key fetched fresh, so a
 * sender that rotated its key verifies on the first request signed with the new one.
 *
 * @param request - The request, whose body may already be consumed.
 * @param options - The resolver, the body bytes and the time window.
 * @returns The verified signature and key. A failed lookup answers `key-unavailable` whose
 *   `cause` is the resolver's `ActivityPubFetchError`.
 */
export async function verifySigned(
	request: Request,
	options: VerifySignedOptions,
): Promise<Result<SignedBy, InboxError>> {
	let attempt = await verifyOnce(request, options, false);
	if (isFailure(attempt) && isSignatureMismatch(attempt.error)) {
		attempt = await verifyOnce(request, options, true);
	}
	return attempt;
}

/** What the key lookup inside one verification found, read once `verify` returns. */
interface KeyLookup {
	key: ResolvedKey | null;
	/** The resolver's failure, which tells a deleted account from an unreachable one. */
	error: ActivityPubFetchError | null;
}

/**
 * Whether the signature itself failed against the key, the one failure a fresh key can fix.
 *
 * @param error - The failed attempt.
 */
function isSignatureMismatch(error: InboxError): boolean {
	return error.cause instanceof HttpSignatureError && error.cause.code === "invalid-signature";
}

/**
 * One verification against the key as the resolver answers it, fresh or cached.
 *
 * @param request - The request.
 * @param options - The resolver, the body bytes and the time window.
 * @param fresh - Whether the key bypasses the resolver's cache.
 */
async function verifyOnce(
	request: Request,
	options: VerifySignedOptions,
	fresh: boolean,
): Promise<Result<SignedBy, InboxError>> {
	let lookup: KeyLookup = { key: null, error: null };

	let verified = await verify(request, {
		...(options.body === undefined ? {} : { body: options.body }),
		maxAge: options.maxAge,
		...(options.now === undefined ? {} : { now: options.now }),
		async key(keyId) {
			let key = await options.resolver.key(keyId, { fresh });
			if (isFailure(key)) {
				lookup.error = key.error;
				return key;
			}
			lookup.key = key.data;
			return success(key.data.publicKey);
		},
	});

	if (isFailure(verified)) {
		let code = verified.error.code;
		let cause = code === "key-unavailable" ? (lookup.error ?? verified.error) : verified.error;
		return failure(new InboxError(inboxCode(code), verified.error.message, { cause }));
	}
	if (lookup.key === null) {
		return failure(new InboxError("key-unavailable", "The signature verified without a key"));
	}
	return success({ verified: verified.data, key: lookup.key });
}

/**
 * The inbox code a signature failure answers with. Every failure past the digest, the time
 * and the key reads as `invalid-signature`, since a sender acts on each the same way.
 *
 * @param code - The signature package's code.
 */
function inboxCode(code: HttpSignatureError["code"]): InboxErrorCode {
	if (code === "unsigned") return "unsigned";
	if (code === "digest-mismatch") return "digest-mismatch";
	if (code === "stale-signature") return "stale-signature";
	if (code === "key-unavailable") return "key-unavailable";
	return "invalid-signature";
}

/**
 * The cavage parameters of `Authorization: Signature …`, the other place draft-cavage lets
 * a signature travel.
 *
 * @param headers - The request headers.
 */
function authorizationSignature(headers: Headers): string | null {
	let authorization = headers.get("authorization");
	let match = authorization === null ? null : /^Signature\s+(.+)$/is.exec(authorization);
	return match?.[1] ?? null;
}

/**
 * A signature field that breaks its grammar.
 *
 * @param cause - The parser's failure.
 */
function malformed(cause: HttpSignatureError): InboxError {
	return new InboxError("invalid-signature", cause.message, { cause });
}
