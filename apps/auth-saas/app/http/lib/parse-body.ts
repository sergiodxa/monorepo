/**
 * Parses a management route's own request body against a `remix/data-schema`
 * schema, mapping a parse failure straight onto the `errors` shape every
 * `problem+json` validation failure carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OperationInputError } from "@sdxc/openapi";
import type { Schema } from "remix/data-schema";

import { issuesFrom } from "@sdxc/problem";
import * as s from "remix/data-schema";

import { managementProblem } from "~/app/http/lib/problem";

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
		response: managementProblem("validationFailed", {
			detail: "The request body did not pass validation.",
			extensions: { errors: issuesFrom(parsed.issues) },
		}),
	};
}

/**
 * The `400` validation failure for a request an operation's `parse` refused, pointing
 * each issue into the part it came from (path params, query string or body).
 *
 * @param error - What `operation.parse` failed with.
 * @returns The `problem+json` response to answer with.
 * @example
 * let input = await AUDIT_EVENTS_LIST.parse(ctx.request, ctx.params);
 * if (isFailure(input)) return operationInputProblem(input.error);
 */
export function operationInputProblem(error: OperationInputError): Response {
	return managementProblem("validationFailed", {
		detail: `The request ${error.location === "body" ? "body" : error.location === "query" ? "query string" : "path"} did not pass validation.`,
		extensions: { errors: issuesFrom(error) },
	});
}
