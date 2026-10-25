/**
 * Signs a key directory response with each key it publishes (Web Bot Auth Appendix B), so
 * a verifier can tell a key set its holders served under this authority from one copied
 * elsewhere: each signature covers the request's `@authority` and the body's digest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { digest, stringify as stringifyDigest } from "@sdxc/digest-fields";
import { toMs } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";
import { stringify } from "@sdxc/structured-fields";

import type { Component } from "../types.js";

import { HttpSignatureError } from "../errors.js";
import { serializeSignatureParams } from "../fields.js";
import { signWith } from "../lib/algorithms.js";
import { responseMessageOf, signatureBase } from "../lib/base.js";
import { toBytes } from "../lib/bytes.js";
import { addMember } from "../sign.js";

import type { WebBotAuthKey } from "./key.js";

/** The `tag` a directory response signature carries. */
export const DIRECTORY_TAG = "http-message-signatures-directory";

/** What every directory response signature covers, as Appendix B.1 requires. */
const COMPONENTS: Component[] = [
	{ name: "@authority", params: { req: true } },
	{ name: "content-digest" },
];

/**
 * How long a directory signature stays valid unless the caller says otherwise. A long
 * window keeps redistributed copies of the key set verifiable between republications.
 */
const DEFAULT_EXPIRES_IN = "7 days";

/** How a directory response is signed. */
export interface SignDirectoryOptions {
	/** Every key the directory publishes; each signs once. */
	keys: WebBotAuthKey[];
	/** @default new Date() */
	created?: Date;
	/** @default "7 days" */
	expiresIn?: DurationInput;
}

/**
 * Signs a directory response once per key, under the labels `binding`, `binding2`, … in
 * key order, after writing a sha-256 `Content-Digest` of its body. Fits the `sign` option
 * of `serve` and `respond` in `@sdxc/well-known` once the options are bound.
 *
 * @param response - The 200 response carrying the directory.
 * @param request - The request it answers, whose authority the signatures cover.
 * @param options - The keys and the signature lifetime.
 * @returns The signed copy, or a signing failure.
 * @example await signDirectoryResponse(response, ctx.request, { keys: [key] })
 */
export async function signDirectoryResponse(
	response: Response,
	request: Request,
	options: SignDirectoryOptions,
): Promise<Result<Response, HttpSignatureError>> {
	let body = new Uint8Array(await response.clone().arrayBuffer());
	let headers = new Headers(response.headers);

	let hashed = await digest(body, "sha-256");
	if (isFailure(hashed)) return failure(cryptoFailure(hashed.error));
	let field = stringifyDigest({ "sha-256": hashed.data }, "content-digest");
	if (isFailure(field)) return failure(cryptoFailure(field.error));
	headers.set("content-digest", field.data);

	let message = responseMessageOf(response, request, headers);
	let created = options.created ?? new Date();
	let expires = new Date(created.getTime() + toMs(options.expiresIn ?? DEFAULT_EXPIRES_IN));

	for (let [index, key] of options.keys.entries()) {
		let params = serializeSignatureParams({
			components: COMPONENTS,
			params: { created, expires, keyid: key.keyid, tag: DIRECTORY_TAG },
		});
		if (isFailure(params)) return params;

		let base = signatureBase(message, COMPONENTS, params.data);
		if (isFailure(base)) return base;

		let signature = await signWith(key.algorithm, key.privateKey, toBytes(base.data));
		if (isFailure(signature)) return signature;

		let label = index === 0 ? "binding" : `binding${index + 1}`;
		let wroteInput = addMember(headers, "signature-input", label, params.data);
		if (isFailure(wroteInput)) return wroteInput;
		let text = stringify(signature.data, "item");
		if (isFailure(text)) return failure(new HttpSignatureError("malformed", text.error.message));
		let wroteSignature = addMember(headers, "signature", label, text.data);
		if (isFailure(wroteSignature)) return wroteSignature;
	}

	return success(
		new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		}),
	);
}

/**
 * A `crypto` failure wrapping what the digest step reported.
 *
 * @param error - The underlying failure.
 */
function cryptoFailure(error: Error): HttpSignatureError {
	return new HttpSignatureError("crypto", error.message, { cause: error });
}
