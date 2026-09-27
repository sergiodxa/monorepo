/**
 * Checks disposable-domain detection against the bundled list: exact entries, subdomains
 * of a listed domain, the case and trailing-dot forms a caller may pass, and the
 * `Result` form that reports which listed domain matched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { DISPOSABLE_DOMAINS } from "./disposable-domains.js";
import { checkDisposable, DisposableDomainError, isDisposableDomain } from "./disposable.js";
import { parseEmailAddress } from "./parse.js";

describe("isDisposableDomain", () => {
	test("matches a listed domain", () => {
		expect(isDisposableDomain("mailinator.com")).toBe(true);
	});

	test("matches any subdomain of a listed domain", () => {
		expect(isDisposableDomain("x.mailinator.com")).toBe(true);
		expect(isDisposableDomain("a.b.mailinator.com")).toBe(true);
	});

	test("matches regardless of case and a trailing dot", () => {
		expect(isDisposableDomain("MailInator.COM.")).toBe(true);
	});

	test("leaves a sibling of a listed subdomain alone", () => {
		expect(isDisposableDomain("0-mailer.dynv6.net")).toBe(true);
		expect(isDisposableDomain("dynv6.net")).toBe(false);
		expect(isDisposableDomain("other.dynv6.net")).toBe(false);
	});

	test("leaves ordinary providers and look-alike suffixes alone", () => {
		expect(isDisposableDomain("gmail.com")).toBe(false);
		expect(isDisposableDomain("realmailinator.com")).toBe(false);
		expect(isDisposableDomain("com")).toBe(false);
		expect(isDisposableDomain("")).toBe(false);
	});

	test("bundles every entry as a lowercase ASCII domain", () => {
		let entries = DISPOSABLE_DOMAINS.trim().split("\n");
		expect(entries.length).toBeGreaterThan(1000);
		for (let entry of entries) expect(entry).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
	});
});

describe("checkDisposable", () => {
	test("passes an address on an ordinary domain through", () => {
		let address = unwrap(parseEmailAddress("jane@example.com"));
		expect(unwrap(checkDisposable(address))).toBe(address);
	});

	test("refuses a disposable address, naming the listed domain it matched", () => {
		let result = checkDisposable(unwrap(parseEmailAddress("jane@inbox.Mailinator.com")));

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(DisposableDomainError);
		expect(result.error.reason).toBe("disposable-domain");
		expect(result.error.domain).toBe("mailinator.com");
	});
});

describe("the bundled list's declared type", () => {
	/**
	 * Typechecks only while the list is declared `string`: a literal type would reject any
	 * other string here, and would copy the whole list into the published declaration file.
	 */
	test("is string, so the declaration file stays small", () => {
		let other: typeof DISPOSABLE_DOMAINS = "any other string";
		expect(other).toBe("any other string");
	});
});
