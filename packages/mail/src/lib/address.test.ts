/**
 * Tests the address helpers: the single-or-list coercion normalization relies on,
 * the mailbox formatting transports hand to providers (including when a display
 * name has to be quoted), and the routability check validation uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { formatAddress, isValidAddress, toAddressList } from "./address.js";

describe("toAddressList", () => {
	test("treats a missing value as no addresses", () => {
		expect(toAddressList(undefined)).toEqual([]);
	});

	test("wraps a single address", () => {
		expect(toAddressList({ email: "a@example.com" })).toEqual([{ email: "a@example.com" }]);
	});

	test("copies the array so later mutation cannot leak into a message", () => {
		let addresses = [{ email: "a@example.com" }];
		let list = toAddressList(addresses);

		addresses.push({ email: "b@example.com" });

		expect(list).toHaveLength(1);
	});
});

describe("formatAddress", () => {
	test("formats a bare mailbox without angle brackets", () => {
		expect(formatAddress({ email: "a@example.com" })).toBe("a@example.com");
	});

	test("formats a display name unquoted when it needs no quoting", () => {
		expect(formatAddress({ email: "a@example.com", name: "Ada Lovelace" })).toBe(
			"Ada Lovelace <a@example.com>",
		);
	});

	test("ignores a whitespace-only display name", () => {
		expect(formatAddress({ email: "a@example.com", name: "   " })).toBe("a@example.com");
	});

	test("quotes a display name containing characters that change how the mailbox parses", () => {
		expect(formatAddress({ email: "a@example.com", name: "Acme, Inc." })).toBe(
			'"Acme, Inc." <a@example.com>',
		);
	});

	test("escapes quotes and backslashes inside a quoted display name", () => {
		expect(formatAddress({ email: "a@example.com", name: 'The "A\\B" Team' })).toBe(
			'"The \\"A\\\\B\\" Team" <a@example.com>',
		);
	});
});

describe("isValidAddress", () => {
	test("accepts a mailbox with a local part and a domain", () => {
		expect(isValidAddress({ email: "a@example.com" })).toBe(true);
	});

	test("rejects the shapes that produce silent non-delivery", () => {
		expect(isValidAddress({ email: "" })).toBe(false);
		expect(isValidAddress({ email: "example.com" })).toBe(false);
		expect(isValidAddress({ email: "@example.com" })).toBe(false);
		expect(isValidAddress({ email: "a@" })).toBe(false);
		expect(isValidAddress({ email: "a@b@example.com" })).toBe(false);
		expect(isValidAddress({ email: "a b@example.com" })).toBe(false);
	});
});
