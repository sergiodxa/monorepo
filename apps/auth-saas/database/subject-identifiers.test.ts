/**
 * Folding correctness for the two identifier kinds: representative cases rather than an
 * exhaustive Unicode suite, chosen to pin the rules ADR-006 states in prose — case
 * folding, IDNA-encoding a domain, and the username character restriction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { foldIdentifier } from "./subject-identifiers";

describe("foldIdentifier: email", () => {
	test("lowercases the domain and case-folds the local part", () => {
		expect(foldIdentifier("email", "Jane.Doe@Example.COM")).toEqual({
			ok: true,
			folded: "jane.doe@example.com",
		});
	});

	test("IDNA-encodes a non-ASCII domain", () => {
		expect(foldIdentifier("email", "user@Bücher.example")).toEqual({
			ok: true,
			folded: "user@xn--bcher-kva.example",
		});
	});

	test("does not strip Gmail dots or plus-addressing, which are distinct addresses", () => {
		expect(foldIdentifier("email", "j.a.n.e+tag@gmail.com")).toEqual({
			ok: true,
			folded: "j.a.n.e+tag@gmail.com",
		});
	});

	test("refuses a value with no domain", () => {
		expect(foldIdentifier("email", "nodomain")).toEqual({ ok: false, reason: "invalid-email" });
	});

	test("refuses a value with more than one @", () => {
		expect(foldIdentifier("email", "a@b@example.com")).toEqual({
			ok: false,
			reason: "invalid-email",
		});
	});

	test("refuses a domain that does not parse as a host", () => {
		expect(foldIdentifier("email", "user@")).toEqual({ ok: false, reason: "invalid-email" });
		expect(foldIdentifier("email", "user@exa mple.com")).toEqual({
			ok: false,
			reason: "invalid-email",
		});
	});
});

describe("foldIdentifier: email addresses the URL parser used to fold into another identity", () => {
	test.each([
		["a percent-encoded domain", "a@ex%61mple.com"],
		["a domain with a trailing fragment", "a@example.com#"],
		["a hex-and-dotted IPv4 domain", "a@0x7f.1"],
		["a dotted IPv4 literal", "a@127.0.0.1"],
		["a bracketed IPv6 literal", "a@[::1]"],
		["a single-label domain", "a@localhost"],
		["a domain with a trailing root dot", "a@example.com."],
		["a control character in the local part", "a\u0007b@example.com"],
		["a zero-width space in the local part", "a\u200bb@example.com"],
		["a zero-width joiner in the local part", "a\u200db@example.com"],
	])("refuses %s", (_name, value) => {
		expect(foldIdentifier("email", value)).toEqual({ ok: false, reason: "invalid-email" });
	});

	test("keeps every address both rules accept at the value the old folding stored", () => {
		expect(foldIdentifier("email", "Jane.Doe+News@Sub.Example.CO.UK")).toEqual({
			ok: true,
			folded: "jane.doe+news@sub.example.co.uk",
		});
	});
});

describe("foldIdentifier: username", () => {
	test("case-folds letters", () => {
		expect(foldIdentifier("username", "JaneDoe")).toEqual({ ok: true, folded: "janedoe" });
	});

	test("accepts letters, digits, dot, dash and underscore", () => {
		expect(foldIdentifier("username", "jane.doe-99_x")).toEqual({
			ok: true,
			folded: "jane.doe-99_x",
		});
	});

	test("refuses a character outside the allowed set", () => {
		expect(foldIdentifier("username", "jane doe")).toEqual({
			ok: false,
			reason: "invalid-username",
		});
		expect(foldIdentifier("username", "jane@doe")).toEqual({
			ok: false,
			reason: "invalid-username",
		});
	});

	test("refuses an empty value", () => {
		expect(foldIdentifier("username", "")).toEqual({ ok: false, reason: "invalid-username" });
	});
});
