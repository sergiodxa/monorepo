/**
 * Tests for the reusable `remix/data-schema` field checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { email, hexColor, httpsUrl, maxLength, minLength, url } from "./schema-checks";

describe("minLength", () => {
	test("passes when string meets minimum length", () => {
		let schema = s.string().pipe(minLength(3));
		let result = schema["~standard"].validate("abc");
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("expected success");
		expect(result.value).toBe("abc");
	});

	test("fails when string is too short", () => {
		let schema = s.string().pipe(minLength(3));
		let result = schema["~standard"].validate("ab");
		expect(result.issues).toBeDefined();
		expect(result.issues?.[0]?.message).toBe("Must be at least 3 characters");
	});

	test("uses custom message when provided", () => {
		let schema = s.string().pipe(minLength(3, "Too short!"));
		let result = schema["~standard"].validate("ab");
		expect(result.issues?.[0]?.message).toBe("Too short!");
	});
});

describe("maxLength", () => {
	test("passes when string is within max length", () => {
		let schema = s.string().pipe(maxLength(5));
		let result = schema["~standard"].validate("hello");
		expect(result.issues).toBeUndefined();
		if (result.issues) throw new Error("expected success");
		expect(result.value).toBe("hello");
	});

	test("fails when string exceeds max length", () => {
		let schema = s.string().pipe(maxLength(5));
		let result = schema["~standard"].validate("hello!");
		expect(result.issues).toBeDefined();
		expect(result.issues?.[0]?.message).toBe("Must be at most 5 characters");
	});

	test("uses custom message when provided", () => {
		let schema = s.string().pipe(maxLength(5, "Too long!"));
		let result = schema["~standard"].validate("hello!");
		expect(result.issues?.[0]?.message).toBe("Too long!");
	});
});

describe("url", () => {
	test("passes for valid http URL", () => {
		let schema = s.string().pipe(url());
		let result = schema["~standard"].validate("http://example.com");
		expect(result.issues).toBeUndefined();
	});

	test("passes for valid https URL", () => {
		let schema = s.string().pipe(url());
		let result = schema["~standard"].validate("https://example.com/path?query=1");
		expect(result.issues).toBeUndefined();
	});

	test("fails for invalid URL", () => {
		let schema = s.string().pipe(url());
		let result = schema["~standard"].validate("not-a-url");
		expect(result.issues).toBeDefined();
		expect(result.issues?.[0]?.message).toBe("Must be a valid URL");
	});
});

describe("httpsUrl", () => {
	test("passes for valid https URL", () => {
		let schema = s.string().pipe(httpsUrl());
		let result = schema["~standard"].validate("https://example.com");
		expect(result.issues).toBeUndefined();
	});

	test("fails for http URL", () => {
		let schema = s.string().pipe(httpsUrl());
		let result = schema["~standard"].validate("http://example.com");
		expect(result.issues).toBeDefined();
		expect(result.issues?.[0]?.message).toBe("Must be a valid HTTPS URL");
	});

	test("fails for invalid URL", () => {
		let schema = s.string().pipe(httpsUrl());
		let result = schema["~standard"].validate("not-a-url");
		expect(result.issues).toBeDefined();
	});
});

describe("email", () => {
	test("passes for valid email", () => {
		let schema = s.string().pipe(email());
		let result = schema["~standard"].validate("user@example.com");
		expect(result.issues).toBeUndefined();
	});

	test("fails for email without @", () => {
		let schema = s.string().pipe(email());
		let result = schema["~standard"].validate("invalid");
		expect(result.issues).toBeDefined();
	});

	test("fails for email without domain", () => {
		let schema = s.string().pipe(email());
		let result = schema["~standard"].validate("user@");
		expect(result.issues).toBeDefined();
	});

	test("fails for email without TLD", () => {
		let schema = s.string().pipe(email());
		let result = schema["~standard"].validate("user@example");
		expect(result.issues).toBeDefined();
	});

	test("fails for email with spaces", () => {
		let schema = s.string().pipe(email());
		let result = schema["~standard"].validate("user @example.com");
		expect(result.issues).toBeDefined();
	});
});

describe("hexColor", () => {
	test("passes for 3-character hex", () => {
		let schema = s.string().pipe(hexColor());
		let result = schema["~standard"].validate("#FFF");
		expect(result.issues).toBeUndefined();
	});

	test("passes for 6-character hex", () => {
		let schema = s.string().pipe(hexColor());
		let result = schema["~standard"].validate("#FF0000");
		expect(result.issues).toBeUndefined();
	});

	test("passes for 8-character hex (with alpha)", () => {
		let schema = s.string().pipe(hexColor());
		let result = schema["~standard"].validate("#FF000080");
		expect(result.issues).toBeUndefined();
	});

	test("passes for lowercase hex", () => {
		let schema = s.string().pipe(hexColor());
		let result = schema["~standard"].validate("#ff0000");
		expect(result.issues).toBeUndefined();
	});

	test("fails without hash prefix", () => {
		let schema = s.string().pipe(hexColor());
		let result = schema["~standard"].validate("FF0000");
		expect(result.issues).toBeDefined();
	});

	test("fails for invalid hex characters", () => {
		let schema = s.string().pipe(hexColor());
		let result = schema["~standard"].validate("#GGGGGG");
		expect(result.issues).toBeDefined();
	});

	test("fails for wrong length", () => {
		let schema = s.string().pipe(hexColor());
		let result = schema["~standard"].validate("#FF00");
		expect(result.issues).toBeDefined();
	});
});

describe("combined checks", () => {
	test("can chain multiple checks", () => {
		let schema = s.string().pipe(minLength(5), maxLength(30), httpsUrl());

		let validResult = schema["~standard"].validate("https://a.co");
		expect(validResult.issues).toBeUndefined();

		let shortResult = schema["~standard"].validate("http");
		expect(shortResult.issues).toBeDefined();

		let longResult = schema["~standard"].validate("https://very-long-url.example.com");
		expect(longResult.issues).toBeDefined();
	});
});
