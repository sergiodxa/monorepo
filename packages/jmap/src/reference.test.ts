/**
 * Evaluates the result references of RFC 8620 section 3.7 against its example
 * responses, and checks each way a reference fails resolves to the
 * `invalidResultReference` error a server answers with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { FOO_CHANGES_RESPONSES, INBOX_THREADS_RESPONSES } from "./fixtures/rfc8620.js";
import { ResultReference, resolveReference } from "./reference.js";

describe("resolveReference", () => {
	test("selects a member with a plain pointer", () => {
		let ids = resolveReference(FOO_CHANGES_RESPONSES, {
			resultOf: "t0",
			name: "Foo/changes",
			path: "/created",
		});

		expect(ids).toEqual({ status: "success", data: ["f1", "f4"] });
	});

	test("maps `*` through an array", () => {
		let ids = resolveReference(INBOX_THREADS_RESPONSES, {
			resultOf: "t1",
			name: "Email/get",
			path: "/list/*/threadId",
		});

		expect(ids).toEqual({ status: "success", data: ["trd194", "trd114"] });
	});

	test("flattens the arrays `*` yields into one", () => {
		let ids = resolveReference(INBOX_THREADS_RESPONSES, {
			resultOf: "t2",
			name: "Thread/get",
			path: "/list/*/emailIds",
		});

		expect(ids).toEqual({
			status: "success",
			data: ["msg1020", "msg1021", "msg1023", "msg201", "msg223"],
		});
	});

	test("fails when no response has the call id", () => {
		let result = resolveReference(FOO_CHANGES_RESPONSES, {
			resultOf: "t9",
			name: "Foo/changes",
			path: "/created",
		});

		expect(isFailure(result) && result.error.type).toBe("invalidResultReference");
	});

	test("fails when the first response with the call id has another name", () => {
		let result = resolveReference(FOO_CHANGES_RESPONSES, {
			resultOf: "t0",
			name: "Foo/get",
			path: "/created",
		});

		expect(isFailure(result) && result.error.type).toBe("invalidResultReference");
	});

	test("fails when the path selects nothing", () => {
		let result = resolveReference(FOO_CHANGES_RESPONSES, {
			resultOf: "t0",
			name: "Foo/changes",
			path: "/missing",
		});

		expect(isFailure(result) && result.error.type).toBe("invalidResultReference");
	});

	test("fails on a pointer that is not RFC 6901", () => {
		let result = resolveReference(FOO_CHANGES_RESPONSES, {
			resultOf: "t0",
			name: "Foo/changes",
			path: "created",
		});

		expect(isFailure(result) && result.error.type).toBe("invalidResultReference");
	});
});

describe("ResultReference", () => {
	test("escapes path segments into a pointer", () => {
		let reference = new ResultReference("0", "Foo/get", ["list", "*", "a/b~c"]);

		expect(reference.toJSON()).toEqual({
			resultOf: "0",
			name: "Foo/get",
			path: "/list/*/a~1b~0c",
		});
	});

	test("resolves a segment it escaped", () => {
		let reference = new ResultReference("t0", "Foo/get", ["a/b"]);
		let result = resolveReference([["Foo/get", { "a/b": 1 }, "t0"]], reference);

		expect(isSuccess(result) && result.data).toBe(1);
	});
});
