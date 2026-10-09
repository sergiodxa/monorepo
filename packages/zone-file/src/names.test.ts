/**
 * Covers domain names in presentation form: escapes read into labels and printed back in
 * one canonical spelling, qualification against an origin under both relative-name modes,
 * and relative output that compares labels rather than characters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { absoluteName, canonicalName, qualifyName, relativeName } from "./names.js";

describe("canonicalName", () => {
	test.each([
		["Mail.Example.COM.", "mail.example.com"],
		["mail.example.com", "mail.example.com"],
		[".", "."],
		["a\\065b", "aab"],
		["a\\.b.example", "a\\.b.example"],
		["a b", "a\\032b"],
		["caf\\195\\169", "caf\\195\\169"],
		["café", "caf\\195\\169"],
		[String.raw`\@\$\(\)\;\"\\`, String.raw`\@\$\(\)\;\"\\`],
		["_dmarc.*.example", "_dmarc.*.example"],
	])("reads %j as %j", (text, expected) => {
		expect(canonicalName(text)).toBe(expected);
	});

	test.each([
		[""],
		["a..b"],
		[".a"],
		["a\\256"],
		["a\\"],
		["x".repeat(64)],
		[Array.from({ length: 128 }, () => "a").join(".")],
	])("refuses %j", (text) => {
		expect(canonicalName(text)).toBeNull();
	});
});

describe("qualifyName", () => {
	test("reads `@` as the origin and appends it to a relative name", () => {
		expect(qualifyName("@", "example.com", "rfc1035")).toBe("example.com");
		expect(qualifyName("WWW", "example.com", "rfc1035")).toBe("www.example.com");
		expect(qualifyName("www.example.net.", "example.com", "rfc1035")).toBe("www.example.net");
		expect(qualifyName("a", ".", "rfc1035")).toBe("a");
	});

	test("reads a name ending in the origin as absolute only under `origin-suffix`", () => {
		expect(qualifyName("example.com", "example.com", "rfc1035")).toBe("example.com.example.com");
		expect(qualifyName("Example.com", "example.com", "origin-suffix")).toBe("example.com");
		expect(qualifyName("a.example.com", "example.com", "origin-suffix")).toBe("a.example.com");
		expect(qualifyName("aexample.com", "example.com", "origin-suffix")).toBe(
			"aexample.com.example.com",
		);
	});

	test("refuses a qualified name past 255 octets", () => {
		let origin = Array.from({ length: 62 }, () => "abc").join(".");
		expect(qualifyName("abcdefghij", origin, "rfc1035")).toBeNull();
	});
});

describe("relativeName", () => {
	test("writes the origin as `@` and names below it relative", () => {
		expect(relativeName("example.com", "example.com")).toBe("@");
		expect(relativeName("www.example.com", "example.com")).toBe("www");
		expect(relativeName("a.b.example.com", "example.com")).toBe("a.b");
		expect(relativeName("www", ".")).toBe("www");
		expect(relativeName(".", ".")).toBe("@");
	});

	test("writes a name outside the origin absolute, comparing whole labels", () => {
		expect(relativeName("example.net", "example.com")).toBe("example.net.");
		expect(relativeName("aexample.com", "example.com")).toBe("aexample.com.");
		expect(relativeName("a\\.example.com", "example.com")).toBe("a\\.example.com.");
	});
});

describe("absoluteName", () => {
	test("adds the trailing dot unless an unescaped one is there", () => {
		expect(absoluteName("mx.example.com")).toBe("mx.example.com.");
		expect(absoluteName("mx.example.com.")).toBe("mx.example.com.");
		expect(absoluteName(".")).toBe(".");
		expect(absoluteName("a\\.")).toBe("a\\..");
		expect(absoluteName("a\\\\.")).toBe("a\\\\.");
	});

	test("reads a long run of backslashes in linear time", () => {
		let started = performance.now();
		expect(absoluteName("\\".repeat(50_000))).toBe(`${"\\".repeat(50_000)}.`);
		expect(absoluteName(`${"\\".repeat(50_001)}.`)).toBe(`${"\\".repeat(50_001)}..`);
		expect(performance.now() - started).toBeLessThan(500);
	});
});
