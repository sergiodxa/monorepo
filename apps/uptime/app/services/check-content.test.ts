import { describe, expect, test } from "bun:test";

import {
	checkContentRule,
	checkContentRules,
	getCheckDescription,
	isValidRegex,
} from "./check-content";

describe("checkContentRule", () => {
	describe("contains", () => {
		test("passes when text is found (case insensitive by default)", () => {
			let result = checkContentRule("Hello World", {
				id: "1",
				type: "contains",
				value: "world",
				caseSensitive: false,
			});
			expect(result.passed).toBe(true);
			expect(result.error).toBeUndefined();
		});

		test("fails when text is not found", () => {
			let result = checkContentRule("Hello World", {
				id: "1",
				type: "contains",
				value: "foo",
				caseSensitive: false,
			});
			expect(result.passed).toBe(false);
			expect(result.error).toContain("does not contain");
		});

		test("respects case sensitivity", () => {
			let result = checkContentRule("Hello World", {
				id: "1",
				type: "contains",
				value: "world",
				caseSensitive: true,
			});
			expect(result.passed).toBe(false);

			let resultUpper = checkContentRule("Hello World", {
				id: "1",
				type: "contains",
				value: "World",
				caseSensitive: true,
			});
			expect(resultUpper.passed).toBe(true);
		});

		test("fails for empty response body", () => {
			let result = checkContentRule("", {
				id: "1",
				type: "contains",
				value: "test",
				caseSensitive: false,
			});
			expect(result.passed).toBe(false);
			expect(result.error).toContain("empty");
		});
	});

	describe("not_contains", () => {
		test("passes when text is not found", () => {
			let result = checkContentRule("Hello World", {
				id: "1",
				type: "not_contains",
				value: "foo",
				caseSensitive: false,
			});
			expect(result.passed).toBe(true);
		});

		test("fails when text is found", () => {
			let result = checkContentRule("Hello World", {
				id: "1",
				type: "not_contains",
				value: "world",
				caseSensitive: false,
			});
			expect(result.passed).toBe(false);
			expect(result.error).toContain("should not");
		});

		test("passes for empty response body", () => {
			let result = checkContentRule("", {
				id: "1",
				type: "not_contains",
				value: "test",
				caseSensitive: false,
			});
			expect(result.passed).toBe(true);
		});
	});

	describe("regex", () => {
		test("passes when pattern matches", () => {
			let result = checkContentRule("User ID: 12345", {
				id: "1",
				type: "regex",
				value: "\\d+",
				caseSensitive: false,
			});
			expect(result.passed).toBe(true);
		});

		test("fails when pattern does not match", () => {
			let result = checkContentRule("No numbers here", {
				id: "1",
				type: "regex",
				value: "\\d+",
				caseSensitive: false,
			});
			expect(result.passed).toBe(false);
			expect(result.error).toContain("does not match");
		});

		test("handles complex patterns", () => {
			let result = checkContentRule('{"status":"ok","code":200}', {
				id: "1",
				type: "regex",
				value: '"status"\\s*:\\s*"ok"',
				caseSensitive: false,
			});
			expect(result.passed).toBe(true);
		});

		test("returns error for invalid regex", () => {
			let result = checkContentRule("test", {
				id: "1",
				type: "regex",
				value: "[invalid",
				caseSensitive: false,
			});
			expect(result.passed).toBe(false);
			expect(result.error).toContain("Invalid regex");
		});

		test("respects case sensitivity", () => {
			let resultInsensitive = checkContentRule("Hello World", {
				id: "1",
				type: "regex",
				value: "hello",
				caseSensitive: false,
			});
			expect(resultInsensitive.passed).toBe(true);

			let resultSensitive = checkContentRule("Hello World", {
				id: "1",
				type: "regex",
				value: "hello",
				caseSensitive: true,
			});
			expect(resultSensitive.passed).toBe(false);
		});
	});
});

describe("checkContentRules", () => {
	test("returns all passed for empty checks array", () => {
		let result = checkContentRules("test body", []);
		expect(result.allPassed).toBe(true);
		expect(result.results).toHaveLength(0);
		expect(result.passedCount).toBe(0);
		expect(result.failedCount).toBe(0);
	});

	test("reports all passing checks", () => {
		let result = checkContentRules("Hello World", [
			{ id: "1", type: "contains", value: "Hello", caseSensitive: false },
			{ id: "2", type: "contains", value: "World", caseSensitive: false },
		]);
		expect(result.allPassed).toBe(true);
		expect(result.passedCount).toBe(2);
		expect(result.failedCount).toBe(0);
	});

	test("reports mixed results", () => {
		let result = checkContentRules("Hello World", [
			{ id: "1", type: "contains", value: "Hello", caseSensitive: false },
			{ id: "2", type: "contains", value: "foo", caseSensitive: false },
		]);
		expect(result.allPassed).toBe(false);
		expect(result.passedCount).toBe(1);
		expect(result.failedCount).toBe(1);
	});

	test("handles multiple check types", () => {
		let result = checkContentRules("Status: OK Code: 200", [
			{ id: "1", type: "contains", value: "Status", caseSensitive: false },
			{ id: "2", type: "not_contains", value: "error", caseSensitive: false },
			{ id: "3", type: "regex", value: "\\d{3}", caseSensitive: false },
		]);
		expect(result.allPassed).toBe(true);
		expect(result.passedCount).toBe(3);
	});
});

describe("isValidRegex", () => {
	test("returns true for valid patterns", () => {
		expect(isValidRegex("\\d+")).toBe(true);
		expect(isValidRegex("hello")).toBe(true);
		expect(isValidRegex("^start.*end$")).toBe(true);
	});

	test("returns false for invalid patterns", () => {
		expect(isValidRegex("[")).toBe(false);
		expect(isValidRegex("(unclosed")).toBe(false);
		expect(isValidRegex("*")).toBe(false);
	});
});

describe("getCheckDescription", () => {
	test("describes contains check", () => {
		let desc = getCheckDescription("contains", "test", false);
		expect(desc).toContain("contains");
		expect(desc).toContain("test");
	});

	test("describes not_contains check", () => {
		let desc = getCheckDescription("not_contains", "error", false);
		expect(desc).toContain("does not contain");
		expect(desc).toContain("error");
	});

	test("describes regex check", () => {
		let desc = getCheckDescription("regex", "\\d+", false);
		expect(desc).toContain("matches pattern");
	});

	test("includes case sensitivity note", () => {
		let descInsensitive = getCheckDescription("contains", "test", false);
		expect(descInsensitive).not.toContain("case sensitive");

		let descSensitive = getCheckDescription("contains", "test", true);
		expect(descSensitive).toContain("case sensitive");
	});
});
