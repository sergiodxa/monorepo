/**
 * Parses a management route's own request body against a `remix/data-schema`
 * schema, mapping a parse failure straight onto the `errors` shape every
 * `problem+json` validation failure carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Issue, Schema } from "remix/data-schema";

import * as s from "remix/data-schema";

import type { ProblemDetail } from "~/app/http/lib/problem";

import { problem } from "~/app/http/lib/problem";

/**
 * Renders a JSON Pointer for one issue's own path, `""` for a schema-level
 * issue that names no field of its own.
 */
function pointerFor(issue: Issue): string {
	if (!issue.path || issue.path.length === 0) return "";
	return `/${issue.path.map((segment) => String(typeof segment === "object" ? segment.key : segment)).join("/")}`;
}

/**
 * Maps `remix/data-schema` issues onto the `{ pointer, code, message }` shape
 * a `problem+json` validation failure carries. No per-issue code reaches this
 * far — data-schema's own `Issue` carries only a `path` and a `message` — so
 * every entry shares the one stable code a caller can already branch on.
 *
 * @param issues - The issues a failed `parseSafe` call returned.
 * @returns One `ProblemDetail` per issue, in the order they were reported.
 */
export function issuesToProblemDetails(issues: readonly Issue[]): ProblemDetail[] {
	return issues.map((issue) => ({
		pointer: pointerFor(issue),
		code: "invalid",
		message: issue.message,
	}));
}

export type ParsedBody<Output> = { ok: true; data: Output } | { ok: false; response: Response };

/**
 * Parses a value against a schema, answering a `400` validation-failure
 * `problem+json` response in place of throwing.
 *
 * @param schema - The `remix/data-schema` schema the body must satisfy.
 * @param value - The already-decoded request body.
 * @returns The parsed value, or the `problem+json` response to answer with.
 * @example
 * let parsed = parseBody(CreateSubjectSchema, await ctx.request.json().catch(() => null));
 * if (!parsed.ok) return parsed.response;
 */
export function parseBody<Output>(
	schema: Schema<unknown, Output>,
	value: unknown,
): ParsedBody<Output> {
	let parsed = s.parseSafe(schema, value);
	if (parsed.success) return { ok: true, data: parsed.value };

	return {
		ok: false,
		response: problem({
			type: "https://docs.example.com/errors/validation-failed",
			title: "The request body did not pass validation",
			status: 400,
			errors: issuesToProblemDetails(parsed.issues),
		}),
	};
}
