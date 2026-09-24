/**
 * Tests for the policy set: which headers a policy produces, HSTS preload eligibility and its
 * `https:`-only rule, `X-Frame-Options` derived from `frame-ancestors`, a response's own headers
 * winning in `apply`, and `override` patching a policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { SecurityHeaders } from "./index.js";

import { apply, entries, override, stringifyStrictTransportSecurity } from "./index.js";

const HTTPS = { url: new URL("https://example.com/") };

describe("entries", () => {
	test("writes the reader-style policy byte for byte", () => {
		let policy: SecurityHeaders.Policy = {
			contentSecurityPolicy: {
				defaultSrc: ["none"],
				scriptSrc: ["self"],
				styleSrc: ["self", "unsafe-inline"],
				frameAncestors: ["none"],
			},
			referrerPolicy: "no-referrer",
			strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
			crossOriginOpenerPolicy: "same-origin",
			crossOriginResourcePolicy: "same-origin",
			permissionsPolicy: { camera: [], "browsing-topics": [] },
		};

		expect(entries(policy, HTTPS)).toEqual([
			[
				"content-security-policy",
				"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
			],
			["x-frame-options", "DENY"],
			["strict-transport-security", "max-age=63072000; includeSubDomains; preload"],
			["referrer-policy", "no-referrer"],
			["permissions-policy", "camera=(), browsing-topics=()"],
			["cross-origin-opener-policy", "same-origin"],
			["cross-origin-resource-policy", "same-origin"],
			["x-content-type-options", "nosniff"],
		]);
	});

	test("writes nosniff by default and leaves it out when disabled", () => {
		expect(entries({}, HTTPS)).toEqual([["x-content-type-options", "nosniff"]]);
		expect(entries({ noSniff: false }, HTTPS)).toEqual([]);
	});

	test("skips HSTS on a plain HTTP request", () => {
		let headers = entries(
			{ strictTransportSecurity: { maxAge: 31536000 }, noSniff: false },
			{ url: new URL("http://localhost:3000/") },
		);

		expect(headers).toEqual([]);
	});

	test("derives X-Frame-Options from frame-ancestors", () => {
		let frameOptions = (frameAncestors: string[]) =>
			entries({ contentSecurityPolicy: { frameAncestors }, noSniff: false }, HTTPS).find(
				([name]) => name === "x-frame-options",
			)?.[1];

		expect(frameOptions(["none"])).toBe("DENY");
		expect(frameOptions([])).toBe("DENY");
		expect(frameOptions(["self"])).toBe("SAMEORIGIN");
		expect(frameOptions(["self", "https://partner.example"])).toBeUndefined();
		expect(frameOptions(["*"])).toBeUndefined();
	});

	test("derives nothing from a report-only frame-ancestors", () => {
		let headers = entries(
			{ contentSecurityPolicyReportOnly: { frameAncestors: ["none"] }, noSniff: false },
			HTTPS,
		);

		expect(headers).toEqual([["content-security-policy-report-only", "frame-ancestors 'none'"]]);
	});

	test("substitutes the nonce into both CSP headers", () => {
		let headers = entries(
			{
				contentSecurityPolicy: { scriptSrc: ["nonce"] },
				contentSecurityPolicyReportOnly: { scriptSrc: ["nonce", "strict-dynamic"] },
				noSniff: false,
			},
			{ ...HTTPS, nonce: "abc" },
		);

		expect(headers).toEqual([
			["content-security-policy", "script-src 'nonce-abc'"],
			["content-security-policy-report-only", "script-src 'nonce-abc' 'strict-dynamic'"],
		]);
	});

	test("writes a referrer fallback list and the reporting endpoints", () => {
		let headers = entries(
			{
				referrerPolicy: ["no-referrer", "strict-origin-when-cross-origin"],
				reportingEndpoints: { csp: "/reports/csp", default: "https://reports.example.com/" },
				crossOriginEmbedderPolicy: "require-corp",
				crossOriginEmbedderPolicyReportOnly: "credentialless",
				noSniff: false,
			},
			HTTPS,
		);

		expect(headers).toEqual([
			["referrer-policy", "no-referrer, strict-origin-when-cross-origin"],
			["cross-origin-embedder-policy", "require-corp"],
			["cross-origin-embedder-policy-report-only", "credentialless"],
			["reporting-endpoints", 'csp="/reports/csp", default="https://reports.example.com/"'],
		]);
	});

	test("denies a feature whose origin RFC 9651 cannot carry, keeping the rest", () => {
		let headers = entries(
			{
				permissionsPolicy: { camera: ["https://ünïcode.example"], usb: ["self"], Bad: [] },
				noSniff: false,
			},
			HTTPS,
		);

		expect(headers).toEqual([["permissions-policy", "camera=(), usb=(self)"]]);
	});
});

describe("stringifyStrictTransportSecurity", () => {
	test("writes every directive", () => {
		expect(
			stringifyStrictTransportSecurity({
				maxAge: 31536000,
				includeSubDomains: true,
				preload: true,
			}),
		).toBe("max-age=31536000; includeSubDomains; preload");
	});

	test("refuses preload below a year", () => {
		expect(
			stringifyStrictTransportSecurity({ maxAge: 86400, includeSubDomains: true, preload: true }),
		).toBe("max-age=86400; includeSubDomains");
	});

	test("refuses preload without includeSubDomains", () => {
		expect(stringifyStrictTransportSecurity({ maxAge: 63072000, preload: true })).toBe(
			"max-age=63072000",
		);
	});

	test("writes max-age as a whole, non-negative number of seconds", () => {
		expect(stringifyStrictTransportSecurity({ maxAge: 3600.7 })).toBe("max-age=3600");
		expect(stringifyStrictTransportSecurity({ maxAge: -1 })).toBe("max-age=0");
	});
});

describe("apply", () => {
	test("writes each header the response has not set for itself", () => {
		let headers = new Headers({ "referrer-policy": "origin" });
		apply(
			headers,
			{ referrerPolicy: "no-referrer", crossOriginOpenerPolicy: "same-origin" },
			HTTPS,
		);

		expect(headers.get("referrer-policy")).toBe("origin");
		expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
		expect(headers.get("x-content-type-options")).toBe("nosniff");
	});

	test("leaves X-Frame-Options out when the response wrote its own CSP", () => {
		let headers = new Headers({ "content-security-policy": "frame-ancestors *" });
		apply(headers, { contentSecurityPolicy: { frameAncestors: ["none"] } }, HTTPS);

		expect(headers.get("content-security-policy")).toBe("frame-ancestors *");
		expect(headers.has("x-frame-options")).toBe(false);
	});
});

describe("override", () => {
	let base: SecurityHeaders.Policy = {
		contentSecurityPolicy: { defaultSrc: ["self"], frameAncestors: ["none"] },
		referrerPolicy: "strict-origin",
		crossOriginOpenerPolicy: "same-origin",
	};

	test("merges a CSP patch directive by directive", () => {
		let patched = override(base, { contentSecurityPolicy: { frameAncestors: ["*"] } });

		expect(patched.contentSecurityPolicy).toEqual({ defaultSrc: ["self"], frameAncestors: ["*"] });
	});

	test("replaces a scalar header and removes one set to null", () => {
		let patched = override(base, { referrerPolicy: "no-referrer", crossOriginOpenerPolicy: null });

		expect(patched).toEqual({
			contentSecurityPolicy: base.contentSecurityPolicy,
			referrerPolicy: "no-referrer",
		});
	});

	test("removes a whole CSP set to null and starts one the base lacks", () => {
		let patched = override(base, {
			contentSecurityPolicy: null,
			contentSecurityPolicyReportOnly: { scriptSrc: ["self"], sandbox: null },
		});

		expect(patched.contentSecurityPolicy).toBeUndefined();
		expect(patched.contentSecurityPolicyReportOnly).toEqual({ scriptSrc: ["self"] });
	});

	test("leaves the base policy untouched", () => {
		override(base, { referrerPolicy: null, contentSecurityPolicy: { defaultSrc: null } });

		expect(base.referrerPolicy).toBe("strict-origin");
		expect(base.contentSecurityPolicy).toEqual({ defaultSrc: ["self"], frameAncestors: ["none"] });
	});
});
