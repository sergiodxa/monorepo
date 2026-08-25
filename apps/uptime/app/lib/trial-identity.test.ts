/**
 * Unit tests for the two keys the free-watch cap compares.
 *
 * Every case here is a bypass someone would otherwise use to buy a second free week on a URL
 * they already had one for, or a collision that would be worse than the bypass — a dotted
 * Gmail alias merged onto somebody else's lead, a plaintext origin merged onto a TLS one.
 * Both functions are total and pure, so plain input/output assertions verify
 * them completely.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { normalizeLeadEmail, normalizeTrialUrl } from "~/app/lib/trial-identity";

describe("normalizeLeadEmail", () => {
	test.each([
		["hello+a@sergiodxa.com"],
		["hello+b@sergiodxa.com"],
		["hello+anything.at.all@sergiodxa.com"],
		["HELLO@sergiodxa.com"],
		["Hello+Sale@SERGIODXA.com"],
		["  hello@sergiodxa.com  "],
	])("reduces %s to one key", (spelling) => {
		expect(normalizeLeadEmail(spelling)).toBe("hello@sergiodxa.com");
	});

	/**
	 * Dots stay significant: Gmail ignores them but almost nobody else does, so
	 * stripping them would merge two strangers into one lead and hand one of them
	 * the other's report — a far worse failure than a second free week.
	 */
	test("keeps dots, so two spellings of a local part stay two people", () => {
		expect(normalizeLeadEmail("he.llo@sergiodxa.com")).not.toBe(
			normalizeLeadEmail("hello@sergiodxa.com"),
		);
	});

	test("keeps a local part that is nothing but a tag, rather than emptying it", () => {
		expect(normalizeLeadEmail("+tag@sergiodxa.com")).toBe("+tag@sergiodxa.com");
	});

	/**
	 * The domain is whatever follows the last `@`, the rule for an address with a
	 * quoted local part. `TrialLeadSchema` refuses those long before this is reached,
	 * so the case exists to keep the function total, independent of what ends up stored.
	 */
	test("splits on the last @, so the domain is never taken from inside the local part", () => {
		expect(normalizeLeadEmail('"a@b"@sergiodxa.com')).toBe('"a@b"@sergiodxa.com');
	});

	test("lowercases a string with no @ rather than rejecting it", () => {
		expect(normalizeLeadEmail("NotAnAddress")).toBe("notanaddress");
	});
});

describe("normalizeTrialUrl", () => {
	test.each([
		["https://example.com"],
		["https://example.com/"],
		["https://example.com/#pricing"],
		["https://example.com#pricing"],
		["https://EXAMPLE.com/"],
		["HTTPS://Example.com"],
	])("reduces %s to one key", (spelling) => {
		expect(normalizeTrialUrl(spelling)).toBe("https://example.com");
	});

	test("sorts search parameters by key", () => {
		expect(normalizeTrialUrl("https://example.com/api?b=2&a=1")).toBe(
			normalizeTrialUrl("https://example.com/api?a=1&b=2"),
		);
	});

	test("strips the slash off the path, not only off the end of the string", () => {
		expect(normalizeTrialUrl("https://example.com/health/?deep=1")).toBe(
			normalizeTrialUrl("https://example.com/health?deep=1"),
		);
	});

	test("drops the fragment before comparing anything else", () => {
		expect(normalizeTrialUrl("https://example.com/a?b=1#top")).toBe("https://example.com/a?b=1");
	});

	/** The exception. Two schemes are two endpoints, and each is worth its own free week. */
	test("keeps http and https apart on the same host", () => {
		expect(normalizeTrialUrl("http://example.com")).not.toBe(
			normalizeTrialUrl("https://example.com"),
		);
	});

	test("keeps the path's case, which servers are entitled to care about", () => {
		expect(normalizeTrialUrl("https://example.com/Status")).not.toBe(
			normalizeTrialUrl("https://example.com/status"),
		);
	});

	test("keeps a non-default port, and drops the default one", () => {
		expect(normalizeTrialUrl("https://example.com:8443")).toBe("https://example.com:8443");
		expect(normalizeTrialUrl("https://example.com:443")).toBe("https://example.com");
	});

	test("returns an unparseable string trimmed, so it still keys against itself", () => {
		expect(normalizeTrialUrl("  not a url  ")).toBe("not a url");
	});
});
