/**
 * Tests the shared email-address rule: it accepts what the parser accepts, refuses the
 * spellings a regex-shaped check let through, and normalizes an accepted address into
 * the form every channel stores and sends to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	deliverableAddress,
	emailAddress,
	isEmailAddress,
} from "~/app/http/validators/email-address";

describe("emailAddress", () => {
	let schema = s.string().pipe(emailAddress()).transform(deliverableAddress);

	test("accepts an ordinary address and an internationalized domain", () => {
		expect(s.parseSafe(schema, "jane.doe+news@example.com").success).toBe(true);
		expect(s.parseSafe(schema, "jane@bücher.example").success).toBe(true);
	});

	/**
	 * Regression: the regex check accepted each of these, and each names a mailbox other than
	 * the one it spells or none at all: an IP literal, a single-label host, a trailing root
	 * dot, a percent-encoded domain, and a zero-width character in the local part.
	 */
	test.each([
		["a@0x7f.1"],
		["a@localhost"],
		["a@example.com."],
		["a@ex%61mple.com"],
		["a​@example.com"],
	])("refuses %s", (input) => {
		expect(isEmailAddress(input)).toBe(false);
		expect(s.parseSafe(schema, input).success).toBe(false);
	});

	test("documents itself as an email format", () => {
		expect(emailAddress().keywords).toEqual({ format: "email" });
	});
});

describe("deliverableAddress", () => {
	test("trims, lowercases and ASCII-encodes the domain, keeping the local part's case", () => {
		expect(deliverableAddress("  Jane@Bücher.Example ")).toBe("Jane@xn--bcher-kva.example");
	});

	test("returns text the parser refuses unchanged", () => {
		expect(deliverableAddress("not-an-email")).toBe("not-an-email");
	});
});
