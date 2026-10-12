/**
 * Test helper for asserting an API failure: reads a response through the API's problem
 * catalog, so a test pins the media type, the status and the problem `type` in one call
 * and then asserts on `detail` or the typed extensions of the entry it names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { expect } from "vitest";

import { apiProblems } from "~/app/services/api-problems";

/** Any problem the API catalog can read back. */
type ApiProblem = Parameters<typeof apiProblems.is>[0];

/** The builder name of one catalog entry. */
type ApiProblemName = Exclude<ApiProblem["name"], null>;

/**
 * Asserts `response` is the catalog's `name` problem, served as `application/problem+json`
 * with a `urn:uuid:` instance, and returns it with that entry's extensions typed.
 *
 * @param response - The API's response.
 * @param name - The catalog entry the failure must be.
 * @returns The parsed problem.
 * @example let problem = await expectProblem(response, "notFound");
 */
export async function expectProblem<Name extends ApiProblemName>(
	response: Response,
	name: Name,
): Promise<Extract<ApiProblem, { name: Name }>> {
	expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	let result = await apiProblems.parse(response);
	if (!isSuccess(result)) return expect.unreachable(`not a problem: ${result.error.message}`);
	expect(result.data.name).toBe(name);
	expect(result.data.instance).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
	if (!apiProblems.is(result.data, name)) return expect.unreachable(`not ${name}`);
	return result.data;
}

/**
 * Every human-readable message a problem carries, `detail` first and then each
 * `errors` entry as `<pointer>: <message>`, for a test that asserts wording.
 *
 * @param problem - A parsed problem.
 * @returns The messages joined with `, `.
 */
export function problemMessages(problem: ApiProblem): string {
	let messages = problem.detail === null ? [] : [problem.detail];
	let errors = problem.extensions.errors;
	if (Array.isArray(errors)) {
		for (let issue of errors as { pointer: string; message: string }[]) {
			messages.push(issue.pointer ? `${issue.pointer}: ${issue.message}` : issue.message);
		}
	}
	return messages.join(", ");
}
