/**
 * Covers reading a merge patch off a `Request`: the media type check that runs before
 * the body is read, the `alsoAccept` migration path, and the problem answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { parseProblem } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	ACCEPT_PATCH_HEADER,
	isMergePatch,
	mergePatchProblem,
	MergePatchRequestError,
	readMergePatch,
} from "./request.js";

/** A PATCH request with the given `Content-Type` (or none) and body. */
function patchRequest(contentType: string | null, body: string) {
	let headers = new Headers();
	if (contentType !== null) headers.set("Content-Type", contentType);
	return new Request("https://example.com/monitors/1", { method: "PATCH", headers, body });
}

describe("isMergePatch", () => {
	test.each([
		["application/merge-patch+json", true],
		["Application/Merge-Patch+JSON", true],
		["application/merge-patch+json; charset=utf-8", true],
		["application/json", false],
		["application/json-patch+json", false],
		[null, false],
	])("%s is %s", (contentType, expected) => {
		expect(isMergePatch(patchRequest(contentType, "{}"))).toBe(expected);
	});
});

describe("readMergePatch", () => {
	test("reads a merge patch body", async () => {
		let request = patchRequest("application/merge-patch+json", '{"name":null}');
		expect(unwrap(await readMergePatch(request))).toEqual({ name: null });
	});

	test("refuses another media type with 415 before reading the body", async () => {
		let request = patchRequest("application/json", '{"name":"x"}');
		let result = await readMergePatch(request);

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MergePatchRequestError);
		expect(result.error.reason).toBe("unsupported-media-type");
		expect(result.error.status).toBe(415);
		expect(request.bodyUsed).toBe(false);
	});

	test("accepts the media types listed in alsoAccept", async () => {
		let request = patchRequest("Application/JSON; charset=utf-8", '{"name":"x"}');
		let result = await readMergePatch(request, { alsoAccept: ["application/json"] });
		expect(unwrap(result)).toEqual({ name: "x" });
	});

	test("refuses a body that is not JSON with 400", async () => {
		let result = await readMergePatch(patchRequest("application/merge-patch+json", "{ nope"));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.reason).toBe("invalid-json");
		expect(result.error.status).toBe(400);
	});
});

describe("mergePatchProblem", () => {
	test("answers an unsupported media type with 415 and Accept-Patch", async () => {
		let error = new MergePatchRequestError("unsupported-media-type");
		let response = mergePatchProblem(error);

		expect(response.status).toBe(415);
		expect(response.headers.get(ACCEPT_PATCH_HEADER[0])).toBe("application/merge-patch+json");
		let problem = unwrap(await parseProblem(response));
		expect(problem.status).toBe(415);
		expect(problem.detail).toBe(error.message);
	});

	test("answers invalid JSON with 400 and no Accept-Patch", () => {
		let response = mergePatchProblem(new MergePatchRequestError("invalid-json"));

		expect(response.status).toBe(400);
		expect(response.headers.has("Accept-Patch")).toBe(false);
	});
});
