/**
 * Signs an outgoing request with RFC 9421 or draft-cavage-12, adding the `Date` and
 * digest headers the signature covers, so a delivery reaches servers on either side of
 * Mastodon's switch between the two schemes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { digest, stringify as stringifyDigest } from "@sdxc/digest-fields";
import { failure, isFailure, success } from "@sdxc/result";
import { parse, stringify } from "@sdxc/structured-fields";

import type { Message } from "./lib/base.js";
import type { Algorithm, Component, SignOptions } from "./types.js";

import { stringifyCavageSignature } from "./cavage-field.js";
import { HttpSignatureError } from "./errors.js";
import { serializeSignatureParams } from "./fields.js";
import { algorithmOfKey, isAlgorithm, signWith } from "./lib/algorithms.js";
import { messageOf, signatureBase, signingString } from "./lib/base.js";
import { toBytes } from "./lib/bytes.js";

/** The label a signature is written under when the caller names none. */
const DEFAULT_LABEL = "sig1";

/**
 * Signs a request, answering a copy that carries the signature.
 *
 * `Date` is written from `created` when the request has none, at signing time, which keeps
 * it inside a receiver's window. With `body`, a sha-256 `Content-Digest` (rfc9421) or
 * `Digest` (cavage) is written and covered. Cavage signatures declare `algorithm="hs2019"`.
 *
 * @param request - The request to sign; its body is carried over to the copy.
 * @param options - Scheme, key, body bytes and what to cover.
 * @returns The signed copy, or `unsupported-algorithm` for a key none of the algorithms
 *   uses, `missing-component`/`unsupported-component` for a component it cannot cover,
 *   `malformed` for a label or parameter with no representation, or `crypto`.
 * @example await sign(request, { scheme: "draft-cavage", key: { id: keyId, privateKey }, body })
 */
export async function sign(
	request: Request,
	options: SignOptions,
): Promise<Result<Request, HttpSignatureError>> {
	let algorithm = options.key.algorithm ?? algorithmOfKey(options.key.privateKey);
	if (algorithm === null || !isAlgorithm(algorithm)) {
		return failure(
			new HttpSignatureError("unsupported-algorithm", "The key fits no supported algorithm"),
		);
	}

	let created = options.created ?? new Date();
	let headers = new Headers(request.headers);
	if (!headers.has("date")) headers.set("date", created.toUTCString());

	let body = options.body === undefined ? null : toBytes(options.body);
	if (body !== null) {
		let written = await writeDigest(headers, body, options.scheme);
		if (isFailure(written)) return written;
	}

	let message = messageOf(request, headers);
	let signed =
		options.scheme === "rfc9421"
			? await signRfc9421(message, algorithm, created, body !== null, options)
			: await signCavage(message, algorithm, created, body !== null, options);
	if (isFailure(signed)) return signed;

	return success(new Request(request, { headers }));
}

/**
 * Writes the sha-256 digest field the scheme covers.
 *
 * @param headers - The headers being signed.
 * @param body - The body bytes.
 * @param scheme - Which field: `Content-Digest` for rfc9421, `Digest` for cavage.
 */
async function writeDigest(
	headers: Headers,
	body: Uint8Array,
	scheme: SignOptions["scheme"],
): Promise<Result<void, HttpSignatureError>> {
	let hashed = await digest(body, "sha-256");
	if (isFailure(hashed)) {
		return failure(new HttpSignatureError("crypto", hashed.error.message, { cause: hashed.error }));
	}

	let field: "content-digest" | "digest" = scheme === "rfc9421" ? "content-digest" : "digest";
	let text = stringifyDigest({ "sha-256": hashed.data }, field);
	if (isFailure(text)) {
		return failure(new HttpSignatureError("crypto", text.error.message, { cause: text.error }));
	}
	headers.set(field, text.data);
	return success(undefined);
}

/**
 * Adds an RFC 9421 `Signature-Input` and `Signature` member under the label, keeping any
 * other signature the request already carries.
 *
 * @param message - The request, with the headers being written.
 * @param algorithm - The algorithm to sign with.
 * @param created - The `created` parameter.
 * @param hasBody - Whether the default coverage includes `content-digest`.
 * @param options - The caller's options.
 */
async function signRfc9421(
	message: Message,
	algorithm: Algorithm,
	created: Date,
	hasBody: boolean,
	options: SignOptions,
): Promise<Result<void, HttpSignatureError>> {
	let components = (options.components ?? defaultRfc9421(message.headers, hasBody)).map(
		(component): Component => (typeof component === "string" ? { name: component } : component),
	);

	let input = {
		components,
		params: {
			created,
			...(options.expires && { expires: options.expires }),
			...(options.nonce !== undefined && { nonce: options.nonce }),
			keyid: options.key.id,
			...(options.tag !== undefined && { tag: options.tag }),
		},
	};
	let params = serializeSignatureParams(input);
	if (isFailure(params)) return params;

	let base = signatureBase(message, components, params.data);
	if (isFailure(base)) return base;

	let signature = await signWith(algorithm, options.key.privateKey, toBytes(base.data));
	if (isFailure(signature)) return signature;

	let label = options.label ?? DEFAULT_LABEL;
	let wroteInput = addMember(message.headers, "signature-input", label, params.data);
	if (isFailure(wroteInput)) return wroteInput;
	let signatureText = stringify(signature.data, "item");
	if (isFailure(signatureText)) return failure(malformed(signatureText.error.message));
	return addMember(message.headers, "signature", label, signatureText.data);
}

/**
 * Writes a cavage `Signature` header, replacing any earlier one.
 *
 * @param message - The request, with the headers being written.
 * @param algorithm - The algorithm to sign with.
 * @param created - The `created` parameter, written only when `(created)` is covered.
 * @param hasBody - Whether the default coverage includes `digest`.
 * @param options - The caller's options.
 */
async function signCavage(
	message: Message,
	algorithm: Algorithm,
	created: Date,
	hasBody: boolean,
	options: SignOptions,
): Promise<Result<void, HttpSignatureError>> {
	let names: string[] = [];
	for (let component of options.components ?? defaultCavage(message.headers, hasBody)) {
		if (typeof component !== "string") {
			return failure(malformed("Cavage signatures cover header names only"));
		}
		names.push(component.toLowerCase());
	}

	let times = {
		created: names.includes("(created)") ? created : null,
		expires: names.includes("(expires)") ? (options.expires ?? null) : null,
	};
	let text = signingString(message, names, { algorithm: "hs2019", ...times });
	if (isFailure(text)) return text;

	let signature = await signWith(algorithm, options.key.privateKey, toBytes(text.data));
	if (isFailure(signature)) return signature;

	let header = stringifyCavageSignature({
		keyId: options.key.id,
		algorithm: "hs2019",
		...times,
		headers: names,
		signature: signature.data,
	});
	if (isFailure(header)) return header;
	message.headers.set("signature", header.data);
	return success(undefined);
}

/**
 * What an RFC 9421 signature covers by default: `@method @target-uri content-digest
 * content-type date`, without the digest when there is no body or `content-type` when the
 * request has none.
 *
 * @param headers - The headers being signed.
 * @param hasBody - Whether a digest was written.
 */
function defaultRfc9421(headers: Headers, hasBody: boolean): string[] {
	return [
		"@method",
		"@target-uri",
		...(hasBody ? ["content-digest"] : []),
		...(headers.has("content-type") ? ["content-type"] : []),
		"date",
	];
}

/**
 * What a cavage signature covers by default, in Mastodon's order: `(request-target) host
 * date digest content-type`, without the digest when there is no body or `content-type`
 * when the request has none.
 *
 * @param headers - The headers being signed.
 * @param hasBody - Whether a digest was written.
 */
function defaultCavage(headers: Headers, hasBody: boolean): string[] {
	return [
		"(request-target)",
		"host",
		"date",
		...(hasBody ? ["digest"] : []),
		...(headers.has("content-type") ? ["content-type"] : []),
	];
}

/**
 * Sets one member of a Dictionary field, keeping its other members.
 *
 * @param headers - The headers being written.
 * @param field - The field name.
 * @param label - The member key.
 * @param value - The member, already serialized.
 */
function addMember(
	headers: Headers,
	field: string,
	label: string,
	value: string,
): Result<void, HttpSignatureError> {
	let existing = headers.get(field);
	let text = existing === null ? `${label}=${value}` : `${existing}, ${label}=${value}`;
	let parsed = parse(text, "dictionary");
	if (isFailure(parsed)) return failure(malformed(`Cannot write ${field} ${label}`));

	let serialized = stringify(parsed.data, "dictionary");
	if (isFailure(serialized)) return failure(malformed(serialized.error.message));
	headers.set(field, serialized.data);
	return success(undefined);
}

/**
 * A `malformed` failure.
 *
 * @param message - What is wrong.
 */
function malformed(message: string): HttpSignatureError {
	return new HttpSignatureError("malformed", message);
}
