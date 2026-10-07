/**
 * Covers `evaluateCaa` table-driven: RFC 8659 §4.3's `issue`/`issuewild` combinations for
 * plain and wildcard names, additive authorizations, `iodef`-only sets, critical tags,
 * and RFC 8657's account and validation-method bindings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parseRecordData } from "../parse-record-data.js";

import type { CAA } from "./types.js";

import { evaluateCaa } from "./evaluate.js";

/** An RRset from presentation lines. */
function rrset(...lines: string[]): CAA.Record[] {
	return lines.map((line) => unwrap(parseRecordData("CAA", line)));
}

/** `issue` for one CA, `issuewild` for another. */
const WILD = rrset('0 issue "ca1.example.net"', '0 issuewild "ca2.example.org"');

/** `issue` for one CA, wildcard certificates forbidden. */
const WILD2 = rrset('0 issue "ca1.example.net"', '0 issuewild ";"');

/** Only `issuewild`, which leaves non-wildcard names unrestricted. */
const WILD3 = rrset('0 issuewild "ca2.example.org"');

describe("evaluateCaa", () => {
	test("allows any CA without records", () => {
		expect(evaluateCaa([], { domain: "example.com", issuer: "ca1.example.net" })).toEqual({
			allowed: true,
			reason: "no-policy",
		});
	});

	test.each<[string, CAA.Record[], string, string, CAA.Decision["reason"]]>([
		["wild", WILD, "example.com", "ca1.example.net", "authorized"],
		["wild", WILD, "example.com", "ca2.example.org", "not-authorized"],
		["wild", WILD, "*.example.com", "ca2.example.org", "authorized"],
		["wild", WILD, "*.example.com", "ca1.example.net", "not-authorized"],
		["wild2", WILD2, "example.com", "ca1.example.net", "authorized"],
		["wild2", WILD2, "*.example.com", "ca1.example.net", "forbidden"],
		["wild3", WILD3, "example.com", "ca1.example.net", "unrestricted"],
		["wild3", WILD3, "*.example.com", "ca2.example.org", "authorized"],
		["wild3", WILD3, "*.example.com", "ca1.example.net", "not-authorized"],
	])("%s: %s by %s is %s", (_, records, domain, issuer, reason) => {
		expect(evaluateCaa(records, { domain, issuer }).reason).toBe(reason);
	});

	test("falls back to issue for a wildcard when no issuewild exists", () => {
		let records = rrset('0 issue "ca1.example.net"');
		expect(evaluateCaa(records, { domain: "*.example.com", issuer: "ca1.example.net" })).toEqual({
			allowed: true,
			reason: "authorized",
			property: {
				kind: "issue",
				critical: false,
				issuer: "ca1.example.net",
				malformed: false,
				parameters: [],
			},
		});
	});

	test("adds authorizations up, an empty issuer beside a named one included", () => {
		let records = rrset('0 issue ";"', '0 issue "ca1.example.net"');
		expect(evaluateCaa(records, { domain: "example.com", issuer: "ca1.example.net" }).allowed).toBe(
			true,
		);
	});

	test("names the issuers a refused request could use", () => {
		let records = rrset('0 issue "pki.goog"', '0 issue "digicert.com"', '0 issue "pki.goog"');
		expect(evaluateCaa(records, { domain: "example.com", issuer: "letsencrypt.org" })).toEqual({
			allowed: false,
			reason: "not-authorized",
			issuers: ["pki.goog", "digicert.com"],
		});
	});

	test("matches issuers exactly, case-insensitively, against any of the CA's identifiers", () => {
		let records = rrset('0 issue "Sectigo.com"');
		let request = { domain: "example.com", issuer: ["comodoca.com", "SECTIGO.com."] };
		expect(evaluateCaa(records, request).reason).toBe("authorized");
		expect(
			evaluateCaa(rrset('0 issue "acme.letsencrypt.org"'), {
				domain: "example.com",
				issuer: "letsencrypt.org",
			}).reason,
		).toBe("not-authorized");
	});

	test("forbids issuance with a malformed value", () => {
		expect(
			evaluateCaa(rrset('0 issue "%%%%%"'), { domain: "example.com", issuer: "ca.example" }),
		).toEqual({ allowed: false, reason: "forbidden" });
	});

	test("leaves a set of only iodef and non-critical unknown tags unrestricted", () => {
		let records = rrset('0 iodef "mailto:a@example.com"', '0 contactemail "a@example.com"');
		expect(evaluateCaa(records, { domain: "example.com", issuer: "ca.example" }).reason).toBe(
			"unrestricted",
		);
	});

	test("refuses on a critical unknown tag before reading anything else", () => {
		let records = rrset('0 issue "ca.example"', '128 tbs "Unknown"');
		expect(evaluateCaa(records, { domain: "example.com", issuer: "ca.example" })).toEqual({
			allowed: false,
			reason: "critical-tag",
			property: { kind: "unknown", critical: true, tag: "tbs", value: "Unknown" },
		});
	});

	test("ignores reserved flag bits", () => {
		let records = rrset('1 issue "ca.example"', '2 tbs "Unknown"');
		expect(evaluateCaa(records, { domain: "example.com", issuer: "ca.example" }).reason).toBe(
			"authorized",
		);
	});

	describe("RFC 8657 bindings", () => {
		let account = "https://acme.example/acct/1";
		let bound = rrset(
			`0 issue "ca.example; accounturi=${account}; validationmethods=dns-01,http-01"`,
		);

		test.each<[Partial<CAA.Request>, CAA.Decision["reason"]]>([
			[{ accountUri: account, validationMethod: "dns-01" }, "authorized"],
			[
				{ accountUri: "https://acme.example/acct/2", validationMethod: "dns-01" },
				"account-mismatch",
			],
			[{ accountUri: account, validationMethod: "tls-alpn-01" }, "validation-method-mismatch"],
			[{}, "authorized"],
			[{ validationMethod: "http-01" }, "authorized"],
			[{ accountUri: account }, "authorized"],
		])("%j is %s", (request, reason) => {
			expect(
				evaluateCaa(bound, { domain: "example.com", issuer: "ca.example", ...request }).reason,
			).toBe(reason);
		});

		test("never satisfies a property with two accounturi parameters", () => {
			let records = rrset(`0 issue "ca.example; accounturi=${account}; accounturi=${account}"`);
			expect(evaluateCaa(records, { domain: "example.com", issuer: "ca.example" }).reason).toBe(
				"account-mismatch",
			);
		});

		test.each([
			'0 issue "ca.example; validationmethods="',
			'0 issue "ca.example; validationmethods=dns-01,,http-01"',
			'0 issue "ca.example; validationmethods=dns-01; validationmethods=dns-01"',
		])("never satisfies %s", (line) => {
			expect(
				evaluateCaa(rrset(line), {
					domain: "example.com",
					issuer: "ca.example",
					validationMethod: "dns-01",
				}).reason,
			).toBe("validation-method-mismatch");
		});

		test("authorizes through another property when one binding excludes the request", () => {
			let records = rrset(
				`0 issue "ca.example; accounturi=https://acme.example/acct/2"`,
				`0 issue "ca.example; accounturi=${account}"`,
			);
			let decision = evaluateCaa(records, {
				domain: "example.com",
				issuer: "ca.example",
				accountUri: account,
			});
			expect(decision).toMatchObject({
				reason: "authorized",
				property: { parameters: [{ key: "accounturi", value: account }] },
			});
		});
	});
});
