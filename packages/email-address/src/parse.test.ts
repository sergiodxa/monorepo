/**
 * Pins the address syntax `parseEmailAddress` accepts and the normalized forms it
 * returns, plus the domain rules `normalizeDomain` shares with it, including the inputs
 * a URL-based IDNA encoder would otherwise fold into a different, valid domain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { EmailAddressReason } from "./parse.js";

import { InvalidEmailAddressError, normalizeDomain, parseEmailAddress } from "./parse.js";

/** The reason `parseEmailAddress` refuses `input` with, or `null` when it parses. */
function reasonFor(input: string): EmailAddressReason | null {
	let result = parseEmailAddress(input);
	return isFailure(result) ? result.error.reason : null;
}

describe("parseEmailAddress", () => {
	test("splits the address and keeps the local part's case in `address`", () => {
		expect(unwrap(parseEmailAddress("Jane.Doe@Example.COM"))).toEqual({
			address: "Jane.Doe@example.com",
			canonical: "jane.doe@example.com",
			localPart: "Jane.Doe",
			domain: "example.com",
		});
	});

	test("trims surrounding whitespace", () => {
		expect(unwrap(parseEmailAddress("  jane@example.com \n")).address).toBe("jane@example.com");
	});

	test("NFKC-normalizes before splitting, so a full-width at sign separates", () => {
		expect(unwrap(parseEmailAddress("ｊａｎｅ＠ｅｘａｍｐｌｅ.com")).address).toBe(
			"jane@example.com",
		);
	});

	test("ASCII-encodes an internationalized domain", () => {
		let parsed = unwrap(parseEmailAddress("jane@Bücher.example"));
		expect(parsed.domain).toBe("xn--bcher-kva.example");
		expect(parsed.canonical).toBe("jane@xn--bcher-kva.example");
	});

	test("accepts a non-ASCII local part and folds its case in `canonical`", () => {
		let parsed = unwrap(parseEmailAddress("Ñandú@example.com"));
		expect(parsed.localPart).toBe("Ñandú");
		expect(parsed.canonical).toBe("ñandú@example.com");
	});

	test("keeps plus tags and dots, which only the mail host may interpret", () => {
		expect(unwrap(parseEmailAddress("j.a.n.e+news@gmail.com")).canonical).toBe(
			"j.a.n.e+news@gmail.com",
		);
	});

	test.each([
		"simple@example.com",
		"very.common@example.com",
		"x@example.com",
		"long.email-address-with-hyphens@and.subdomains.example.com",
		"user.name+tag+sorting@example.com",
		"!#$%&'*+-/=?^_`{|}~@example.com",
		"user@example.xn--p1ai",
		"user@123.example",
	])("accepts %s", (input) => {
		expect(reasonFor(input)).toBeNull();
	});

	test.each<[string, EmailAddressReason]>([
		["", "missing-at-sign"],
		["   ", "missing-at-sign"],
		["jane.example.com", "missing-at-sign"],
		["@example.com", "local-part-empty"],
		["jane@", "domain-empty"],
		["a@b@example.com", "local-part-invalid"],
		[".jane@example.com", "local-part-invalid"],
		["jane.@example.com", "local-part-invalid"],
		["ja..ne@example.com", "local-part-invalid"],
		['"jane doe"@example.com', "local-part-invalid"],
		["jane doe@example.com", "local-part-invalid"],
		["jane,doe@example.com", "local-part-invalid"],
		["<jane>@example.com", "local-part-invalid"],
		["ja\u0000ne@example.com", "local-part-invalid"],
		["ja​ne@example.com", "local-part-invalid"],
		[`${"a".repeat(65)}@example.com`, "local-part-too-long"],
		[`${"ñ".repeat(33)}@example.com`, "local-part-too-long"],
		["jane@[192.0.2.1]", "domain-invalid"],
		["jane@[::1]", "domain-invalid"],
		["jane@localhost", "domain-invalid"],
		["jane@192.0.2.1", "domain-invalid"],
		["jane@example.com.", "domain-invalid"],
		["jane@.example.com", "domain-invalid"],
		["jane@exa..mple.com", "domain-invalid"],
		["jane@-example.com", "domain-invalid"],
		["jane@example-.com", "domain-invalid"],
		["jane@exa_mple.com", "domain-invalid"],
		["jane@exa mple.com", "domain-invalid"],
		[`jane@${"a".repeat(64)}.com`, "domain-invalid"],
		[`jane@${Array.from({ length: 4 }, () => "a".repeat(63)).join(".")}.com`, "domain-too-long"],
		[
			`${"a".repeat(64)}@${Array.from({ length: 3 }, () => "b".repeat(62)).join(".")}.com`,
			"address-too-long",
		],
	])("refuses %j as %s", (input, reason) => {
		expect(reasonFor(input)).toBe(reason);
	});

	test("returns an InvalidEmailAddressError carrying the reason", () => {
		let result = parseEmailAddress("nope");
		expect(isFailure(result) && result.error).toBeInstanceOf(InvalidEmailAddressError);
	});
});

describe("normalizeDomain", () => {
	test("lowercases and ASCII-encodes a bare domain", () => {
		expect(unwrap(normalizeDomain(" Straße.DE "))).toBe("xn--strae-oqa.de");
		expect(unwrap(normalizeDomain("例え.jp"))).toBe("xn--r8jz45g.jp");
		expect(unwrap(normalizeDomain("a。example.com"))).toBe("a.example.com");
	});

	test.each([
		"0x7f.1",
		"127.1",
		"ex%61mple.com",
		"example.com#",
		"example.com?",
		"example.com:",
		"example.com:25",
		"example.com/",
		"user@example.com",
	])("refuses %j rather than rewriting it into another host", (input) => {
		let result = normalizeDomain(input);
		expect(isFailure(result) && result.error.reason).toBe("domain-invalid");
	});

	test("refuses an empty domain", () => {
		let result = normalizeDomain("");
		expect(isFailure(result) && result.error.reason).toBe("domain-empty");
	});
});
