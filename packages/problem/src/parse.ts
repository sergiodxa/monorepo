/**
 * Reads problem documents: detecting one by its media type, and decoding its JSON
 * into a `Problem` with RFC 9457's defaults resolved and the extension members
 * optionally validated by a Standard Schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import type { Problem } from "./types.js";

import { ABOUT_BLANK, PROBLEM_MEDIA_TYPE } from "./problem.js";
import { statusPhrase } from "./status-phrase.js";

/** Why a document could not be read as a problem, with the schema's issues when extensions failed validation. */
export class ProblemParseError extends Error {
	override name = "ProblemParseError";
	readonly issues: readonly StandardSchemaV1.Issue[];

	/**
	 * @param message - What made the document unreadable.
	 * @param issues - The extension schema's issues, empty for any other failure.
	 */
	constructor(message: string, issues: readonly StandardSchemaV1.Issue[] = []) {
		super(message);
		this.issues = issues;
	}
}

/** How to read a problem document. */
export interface ParseOptions<Extensions extends object> {
	/** Validates the extension members; without one they are kept as an unchecked record. */
	extensions?: StandardSchemaV1<unknown, Extensions>;
	/** The status line's code, which takes precedence over the body's advisory `status`. */
	status?: number;
}

/** The members RFC 9457 defines, which never appear among a parsed problem's extensions. */
const STANDARD_MEMBERS = new Set(["type", "title", "status", "detail", "instance"]);

/**
 * Whether a request or response declares the problem media type. Only the media type
 * essence is compared, case-insensitively, so parameters like `charset` are accepted;
 * the body is left unread.
 *
 * @param message - A `Request` or `Response`.
 */
export function isProblem(message: { headers: Headers }): boolean {
	let declared = message.headers.get("Content-Type");
	if (declared === null) return false;
	return declared.split(";")[0]?.trim().toLowerCase() === PROBLEM_MEDIA_TYPE;
}

/**
 * Decodes a problem document's JSON text. Absent members take their RFC defaults; a body
 * that is not a JSON object, a standard member of the wrong type, a missing status, or
 * extensions the schema rejects is a failure. A schema must validate synchronously.
 *
 * @param text - The document's JSON text.
 * @param options - The extension schema and the status line's code.
 * @returns The problem, or why the text is not one.
 * @template Extensions - The extension members the schema produces.
 */
export function parse<Extensions extends object = Record<string, unknown>>(
	text: string,
	options: ParseOptions<Extensions> = {},
): Result<Problem<Extensions>, ProblemParseError> {
	let json: unknown;
	try {
		json = JSON.parse(text);
	} catch {
		return failure(new ProblemParseError("The problem document is not valid JSON."));
	}

	if (typeof json !== "object" || json === null || Array.isArray(json)) {
		return failure(new ProblemParseError("The problem document is not a JSON object."));
	}
	let body = json as Record<string, unknown>;

	let status = options.status ?? body.status;
	if (!Number.isInteger(status)) {
		return failure(new ProblemParseError("The problem document has no integer status."));
	}

	for (let member of ["type", "title", "detail", "instance"]) {
		if (body[member] !== undefined && typeof body[member] !== "string") {
			return failure(new ProblemParseError(`The problem member "${member}" is not a string.`));
		}
	}

	let extensions = readExtensions(body, options.extensions);
	if (extensions.status === "failure") return extensions;

	return success({
		type: (body.type as string | undefined) ?? ABOUT_BLANK,
		title: (body.title as string | undefined) ?? statusPhrase(status as number),
		status: status as number,
		detail: (body.detail as string | undefined) ?? null,
		instance: (body.instance as string | undefined) ?? null,
		extensions: extensions.data,
	});
}

/**
 * Reads a problem `Response`, whose status line wins over the body's `status`. A response
 * that does not declare the problem media type, or whose body cannot be read, is a failure.
 *
 * @param response - The response, with its body unread.
 * @param options - The extension schema.
 * @returns The problem, or why the response does not carry one.
 * @template Extensions - The extension members the schema produces.
 */
export async function parseProblem<Extensions extends object = Record<string, unknown>>(
	response: Response,
	options: Omit<ParseOptions<Extensions>, "status"> = {},
): Promise<Result<Problem<Extensions>, ProblemParseError>> {
	if (!isProblem(response)) {
		return failure(new ProblemParseError(`The response is not ${PROBLEM_MEDIA_TYPE}.`));
	}

	let text: string;
	try {
		text = await response.text();
	} catch {
		return failure(new ProblemParseError("The response body could not be read."));
	}

	return parse(text, { ...options, status: response.status });
}

/**
 * Collects the non-standard members and, when a schema is given, validates them.
 *
 * @param body - The decoded document.
 * @param schema - The extension schema, if any.
 */
export function readExtensions<Extensions extends object>(
	body: Record<string, unknown>,
	schema: StandardSchemaV1<unknown, Extensions> | undefined,
): Result<Extensions, ProblemParseError> {
	let members: Record<string, unknown> = {};
	for (let [key, value] of Object.entries(body)) {
		if (!STANDARD_MEMBERS.has(key)) members[key] = value;
	}
	if (schema === undefined) return success(members as Extensions);

	let result = schema["~standard"].validate(members);
	if (result instanceof Promise) {
		return failure(new ProblemParseError("The extension schema must validate synchronously."));
	}
	if (result.issues !== undefined) {
		return failure(
			new ProblemParseError("The problem's extensions failed validation.", result.issues),
		);
	}
	return success(result.value);
}
