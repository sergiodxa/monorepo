/**
 * Validation failures as problems: converting Standard Schema issues into the
 * `errors` extension's JSON Pointer entries, the schema that reads them back,
 * and the 422 response that carries them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import * as s from "remix/data-schema";

import type { ProblemIssue, ProblemOptions } from "./types.js";

import { problem } from "./problem.js";

/**
 * Formats a Standard Schema issue path as an RFC 6901 JSON Pointer, escaping `~` as `~0`
 * and `/` as `~1`. An empty or absent path points at the whole document, `""`.
 *
 * @param path - The issue's path segments.
 * @example toPointer(["users", 0, "a/b"]); // "/users/0/a~1b"
 */
export function toPointer(path: StandardSchemaV1.Issue["path"]): string {
	let pointer = "";
	for (let segment of path ?? []) {
		let key = typeof segment === "object" ? segment.key : segment;
		pointer += `/${String(key).replaceAll("~", "~0").replaceAll("/", "~1")}`;
	}
	return pointer;
}

/**
 * Converts Standard Schema issues into `errors` entries. Standard Schema issues carry no
 * code of their own, so every entry gets `code`.
 *
 * @param source - The issues, or anything carrying them, such as a validation error.
 * @param code - The code each entry reports.
 * @default code "invalid"
 * @example issuesFrom(parseSafe(schema, input).issues);
 */
export function issuesFrom(
	source: readonly StandardSchemaV1.Issue[] | { issues: readonly StandardSchemaV1.Issue[] },
	code = "invalid",
): ProblemIssue[] {
	let issues = "issues" in source ? source.issues : source;
	return issues.map((issue) => ({ pointer: toPointer(issue.path), code, message: issue.message }));
}

/**
 * Builds the response for a request that failed validation, `422` unless `options` says
 * otherwise, listing each invalid field in the `errors` extension.
 *
 * @param issues - One entry per invalid field.
 * @param options - Any standard member to set; `status` defaults to `422`.
 * @example return validationProblem(issuesFrom(result.issues));
 */
export function validationProblem(
	issues: ProblemIssue[],
	options: Partial<Omit<ProblemOptions, "extensions">> = {},
): Response {
	return problem({ status: 422, ...options, extensions: { errors: issues } });
}

/**
 * The schema for the `errors` extension, for composing into an extension schema such as
 * `s.object({ errors: ISSUES_SCHEMA })`.
 */
export const ISSUES_SCHEMA: s.Schema<unknown, ProblemIssue[]> = s.array(
	s.object({ pointer: s.string(), code: s.string(), message: s.string() }),
);
