/**
 * Reads a merge patch off a standard `Request`: checks the media type before touching the
 * body, parses the body, and turns a refusal into the RFC 9457 problem answer with the
 * `Accept-Patch` header RFC 5789 asks a `415` to carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { problem } from "@sdxc/problem";
import { failure, isFailure, success } from "@sdxc/result";

import type { JSONValue } from "./json-value.js";

import { MEDIA_TYPE } from "./media-type.js";
import { parse } from "./parse.js";

/** `Accept-Patch: application/merge-patch+json` (RFC 5789), for a `415` or an `OPTIONS` answer. */
export const ACCEPT_PATCH_HEADER: readonly [name: "Accept-Patch", value: typeof MEDIA_TYPE] = [
	"Accept-Patch",
	MEDIA_TYPE,
];

/** Options for {@link readMergePatch}. */
export interface ReadMergePatchOptions {
	/**
	 * Further media types read as a merge patch, compared like the merge patch type. Passing
	 * `["application/json"]` keeps an endpoint's existing callers while it adopts merge patch.
	 */
	alsoAccept?: readonly string[];
}

/** The two ways a request fails to carry a merge patch, each with the status to answer. */
const REASONS = {
	"unsupported-media-type": { status: 415, message: `The request body must be ${MEDIA_TYPE}.` },
	"invalid-json": { status: 400, message: "The request body is not valid JSON." },
} as const;

/** Signals that a request does not carry a readable merge patch. */
export class MergePatchRequestError extends Error {
	override name = "MergePatchRequestError";

	readonly reason: keyof typeof REASONS;

	/** The status to answer with: `415` for the media type, `400` for the body. */
	readonly status: 415 | 400;

	/**
	 * @param reason - Why the request was refused.
	 * @param options - The underlying error, when the body failed to parse.
	 */
	constructor(reason: keyof typeof REASONS, options?: ErrorOptions) {
		super(REASONS[reason].message, options);
		this.reason = reason;
		this.status = REASONS[reason].status;
	}
}

/** The media type essence of a `Content-Type`: lowercased, parameters and whitespace removed. */
function essenceOf(contentType: string | null): string | null {
	if (contentType === null) return null;
	return (contentType.split(";")[0] ?? "").trim().toLowerCase();
}

/**
 * Whether the request's `Content-Type` essence is `application/merge-patch+json`,
 * compared case-insensitively with parameters ignored.
 *
 * @param request - The incoming request.
 */
export function isMergePatch(request: Request): boolean {
	return essenceOf(request.headers.get("Content-Type")) === MEDIA_TYPE;
}

/**
 * Reads and parses a merge patch body. The media type is checked first, so a refused
 * request's body is left unread.
 *
 * @param request - The incoming request, with its body unread.
 * @param options - Further media types to accept.
 * @returns The patch, or a refusal carrying the status to answer.
 */
export async function readMergePatch(
	request: Request,
	options: ReadMergePatchOptions = {},
): Promise<Result<JSONValue, MergePatchRequestError>> {
	let essence = essenceOf(request.headers.get("Content-Type"));
	let accepted = [MEDIA_TYPE, ...(options.alsoAccept ?? [])].map((type) => type.toLowerCase());
	if (essence === null || !accepted.includes(essence)) {
		return failure(new MergePatchRequestError("unsupported-media-type"));
	}

	let text: string;
	try {
		text = await request.text();
	} catch (error) {
		return failure(new MergePatchRequestError("invalid-json", { cause: error }));
	}

	let patch = parse(text);
	if (isFailure(patch))
		return failure(new MergePatchRequestError("invalid-json", { cause: patch.error }));
	return success(patch.data);
}

/**
 * The problem response for a refused merge patch request: its status, the error's message
 * as `detail`, and `Accept-Patch` on a `415` so the client learns the media type to send.
 *
 * @param error - The refusal from {@link readMergePatch}.
 * @returns A response ready to return from a handler.
 * @example if (isFailure(patch)) return mergePatchProblem(patch.error);
 */
export function mergePatchProblem(error: MergePatchRequestError): Response {
	let headers = new Headers();
	if (error.status === 415) headers.set(...ACCEPT_PATCH_HEADER);
	return problem({ status: error.status, detail: error.message }, { headers });
}
