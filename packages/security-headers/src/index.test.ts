/**
 * Tests for the policy set: which headers a policy produces, HSTS preload eligibility and its
 * `https:`-only rule, a response's own headers winning in `apply`, and `override` patching a
 * policy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { SecurityHeaders } from "./index.js";

import { apply, entries, override, stringifyStrictTransportSecurity } from "./index.js";

const HTTPS = { url: new URL("https://example.com/") };

describe("entries", () => {
	test("writes the reader-style non-CSP policy", () => {
		let policy: SecurityHeaders.Policy = {
			referrerPolicy: "no-referrer",
			strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
			crossOriginOpenerPolicy: "same-origin",
			crossOriginResourcePolicy: "same-origin",
			permissionsPolicy: { camera: [], "browsing-topics": [] },
			xFrameOptions: "DENY",
		};

		expect(entries(policy, HTTPS)).toEqual([
			["strict-transport-security", "max-age=63072000; includeSubDomains; preload"],
			["referrer-policy", "no-referrer"],
			["permissions-policy", "camera=(), browsing-topics=()"],
			["cross-origin-opener-policy", "same-origin"],
			["cross-origin-resource-policy", "same-origin"],
			["x-frame-options", "DENY"],
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

	test("writes a referrer fallback list and cross-origin embedder policies", () => {
		let headers = entries(
			{
				referrerPolicy: ["no-referrer", "strict-origin-when-cross-origin"],
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
});

describe("override", () => {
	let base: SecurityHeaders.Policy = {
		referrerPolicy: "strict-origin",
		crossOriginOpenerPolicy: "same-origin",
		xFrameOptions: "DENY",
	};

	test("replaces a scalar header and removes one set to null", () => {
		let patched = override(base, { referrerPolicy: "no-referrer", crossOriginOpenerPolicy: null });

		expect(patched).toEqual({
			referrerPolicy: "no-referrer",
			xFrameOptions: "DENY",
		});
	});

	test("leaves the base policy untouched", () => {
		override(base, { referrerPolicy: null, xFrameOptions: "SAMEORIGIN" });

		expect(base.referrerPolicy).toBe("strict-origin");
		expect(base.xFrameOptions).toBe("DENY");
	});
});
