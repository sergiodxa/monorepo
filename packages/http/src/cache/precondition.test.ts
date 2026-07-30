/**
 * Tests for `precondition()`.
 *
 * Strong comparison is what is being pinned: a weak tag must fail, because two
 * equivalent renderings of a resource are not the same version to write over, and
 * a lost update is the failure this check exists to prevent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { isFailure, isSuccess, unwrap } from "@pkg/result";

import { precondition, PreconditionFailedError } from "./precondition";

/** Builds a write request carrying the given `If-Match` value, if any. */
function createRequest(ifMatch?: string): Request {
	return new Request("https://example.com/article", {
		method: "PUT",
		headers: ifMatch === undefined ? {} : { "If-Match": ifMatch },
	});
}

describe(precondition, () => {
	test("passes when the client's tag is the current one", () => {
		let result = precondition(createRequest('"abc"'), { etag: '"abc"' });

		expect(isSuccess(result)).toBe(true);
		expect(unwrap(result)).toBe('"abc"');
	});

	test("passes when the request states no expectation", () => {
		expect(isSuccess(precondition(createRequest(), { etag: '"abc"' }))).toBe(true);
	});

	test("passes on a wildcard, since the resource exists", () => {
		expect(isSuccess(precondition(createRequest("*"), { etag: '"abc"' }))).toBe(true);
	});

	test("passes when any listed tag is the current one", () => {
		expect(isSuccess(precondition(createRequest('"other", "abc"'), { etag: '"abc"' }))).toBe(true);
	});

	test("fails when the client expects a version that is no longer current", () => {
		let result = precondition(createRequest('"stale"'), { etag: '"abc"' });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(PreconditionFailedError);
			expect(result.error.etag).toBe('"abc"');
		}
	});

	test("fails on a weak tag, which never satisfies a write precondition", () => {
		expect(isFailure(precondition(createRequest('W/"abc"'), { etag: 'W/"abc"' }))).toBe(true);
	});

	test("fails rather than throwing, so the caller decides on the 412", () => {
		expect(() => precondition(createRequest('"stale"'), { etag: '"abc"' })).not.toThrow();
	});
});
