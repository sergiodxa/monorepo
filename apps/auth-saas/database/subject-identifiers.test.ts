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
