/**
 * `application/problem+json` responses per RFC 9457, in exactly the wire shape
 * `packages/auth/src/management-client.ts`'s `ManagementProblem` already decodes:
 * `type`, `title`, `status`, an optional `detail` and `instance`, and — for a
 * validation failure — `errors`, one `{ pointer, code, message }` per invalid field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The media type this module's every response declares. */
const PROBLEM_MEDIA_TYPE = "application/problem+json";

/** One invalid field inside a validation failure's `errors` array. */
export interface ProblemDetail {
	/** Which field the issue names, as a JSON Pointer into the request body. */
	pointer: string;
	/** A stable code for this issue, for a caller branching without reading `message`. */
	code: string;
	/** The issue, phrased for the person who will read it. */
	message: string;
}

export interface ProblemOptions {
	/** A stable URI naming the failure, the field worth comparing across responses. */
	type: string;
	/** A short, human-readable summary of the failure. */
	title: string;
	/** The HTTP status this response answers with. */
	status: number;
	/** A longer explanation specific to this occurrence. */
	detail?: string;
	/** The request this failure is filed under, for a caller to quote back in a support request. */
	instance?: string;
	/** One entry per invalid field, for a validation failure. */
	errors?: ProblemDetail[];
}

/**
 * Builds an `application/problem+json` response. `instance` defaults to a freshly
 * minted id when the caller has none of its own to carry, so every problem response
 * names one whether or not its caller tracked a request id itself.
 *
 * @param options - The failure to render.
 * @returns A `Response` whose body and `Content-Type` follow RFC 9457.
 * @example
 * return problem({
 * 	type: "https://docs.example.com/errors/invalid-scope",
 * 	title: "The requested scope exceeds this client's ceiling",
 * 	status: 400,
 * });
 */
export function problem(options: ProblemOptions): Response {
	let instance = options.instance ?? crypto.randomUUID();

	let body: Record<string, unknown> = {
		type: options.type,
		title: options.title,
		status: options.status,
		instance,
	};
	if (options.detail !== undefined) body.detail = options.detail;
	if (options.errors !== undefined) body.errors = options.errors;

	return new Response(JSON.stringify(body), {
		status: options.status,
		headers: { "Content-Type": PROBLEM_MEDIA_TYPE },
	});
}
