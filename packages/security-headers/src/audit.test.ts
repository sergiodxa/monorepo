/**
 * Tests for `audit`: the verdict for each security header when it is sent well, left out, or
 * sent with a value that leaves the page open, including several CSP policies at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Audit } from "./audit.js";

import { audit } from "./audit.js";

const HTTPS = new URL("https://sdxc.dev/");

const STRONG: Record<string, string> = {
	"content-security-policy":
		"default-src 'self'; script-src 'self' 'nonce-abc' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'",
	"strict-transport-security": "max-age=63072000; includeSubDomains; preload",
	"x-content-type-options": "nosniff",
	"referrer-policy": "strict-origin-when-cross-origin",
	"permissions-policy": "camera=(), microphone=(), geolocation=(self)",
	"cross-origin-opener-policy": "same-origin",
};

/**
 * The finding for one header after auditing `headers`.
 *
 * @param headers - The response headers
 * @param header - The header to pick
 * @param url - The response URL
 */
function finding(
	headers: Record<string, string>,
	header: string,
	url: URL = HTTPS,
): Audit.Finding | undefined {
	return audit(new Headers(headers), url).find((item) => item.header === header);
}

describe("audit", () => {
	test("grades a strong header set ok throughout", () => {
		let findings = audit(new Headers(STRONG), HTTPS);

		expect(findings.map((item) => [item.header, item.status])).toEqual([
			["content-security-policy", "ok"],
			["strict-transport-security", "ok"],
			["x-content-type-options", "ok"],
			["x-frame-options", "ok"],
			["referrer-policy", "ok"],
			["permissions-policy", "ok"],
			["cross-origin-opener-policy", "ok"],
		]);
	});

	test("reports every header missing from an empty response", () => {
		let findings = audit(new Headers(), HTTPS);

		expect(findings.every((item) => item.status === "missing" && item.value === null)).toBe(true);
	});

	describe("content-security-policy", () => {
		test("notes that a Report-Only policy alone blocks nothing", () => {
			let result = finding(
				{ "content-security-policy-report-only": "default-src 'self'" },
				"content-security-policy",
			);

			expect(result?.status).toBe("missing");
			expect(result?.notes[0]).toContain("Report-Only");
		});

		test("flags unsafe-inline without a nonce, unsafe-eval and permissive sources", () => {
			let result = finding(
				{ "content-security-policy": "script-src 'unsafe-inline' 'unsafe-eval' https:" },
				"content-security-policy",
			);

			expect(result?.status).toBe("weak");
			expect(result?.notes).toEqual([
				"'unsafe-inline' in script-src lets any inline script run",
				"'unsafe-eval' in script-src lets strings run as code",
				"https: in script-src allows scripts from any host",
				"object-src is not 'none', so plugins can load",
			]);
		});

		test("flags a policy that restricts no scripts", () => {
			let result = finding(
				{ "content-security-policy": "img-src 'self'; object-src 'none'" },
				"content-security-policy",
			);

			expect(result?.notes).toEqual([
				"No script-src or default-src restricts where scripts load from",
			]);
		});

		test("accepts host sources under strict-dynamic", () => {
			let result = finding(
				{
					"content-security-policy":
						"script-src 'nonce-abc' 'strict-dynamic' https: 'unsafe-inline'; object-src 'none'",
				},
				"content-security-policy",
			);

			expect(result?.status).toBe("ok");
		});

		test("holds a weakness only when every policy shares it", () => {
			let result = finding(
				{
					"content-security-policy":
						"script-src *; object-src 'none', script-src 'self'; object-src 'none'",
				},
				"content-security-policy",
			);

			expect(result?.status).toBe("ok");
		});

		test("reports a value the parser rejects as weak", () => {
			let result = finding(
				{ "content-security-policy": "script_src 'self'" },
				"content-security-policy",
			);

			expect(result?.status).toBe("weak");
			expect(result?.notes[0]).toContain("Invalid directive name");
		});
	});

	describe("strict-transport-security", () => {
		test("flags a max-age under 180 days", () => {
			let result = finding(
				{ "strict-transport-security": 'max-age="300"' },
				"strict-transport-security",
			);

			expect(result?.notes).toEqual(["max-age=300 is under 180 days (15552000 seconds)"]);
		});

		test("flags a value without max-age", () => {
			let result = finding(
				{ "strict-transport-security": "includeSubDomains" },
				"strict-transport-security",
			);

			expect(result?.notes).toEqual(["No valid max-age directive"]);
		});

		test("flags a page served over http", () => {
			let result = finding(STRONG, "strict-transport-security", new URL("http://sdxc.dev/"));

			expect(result?.status).toBe("weak");
		});
	});

	test("flags an X-Content-Type-Options other than nosniff", () => {
		expect(finding({ "x-content-type-options": "sniff" }, "x-content-type-options")?.status).toBe(
			"weak",
		);
	});

	describe("x-frame-options", () => {
		test("accepts DENY and SAMEORIGIN in any case", () => {
			expect(finding({ "x-frame-options": "deny" }, "x-frame-options")?.status).toBe("ok");
			expect(finding({ "x-frame-options": "SAMEORIGIN" }, "x-frame-options")?.status).toBe("ok");
		});

		test("flags ALLOW-FROM, which browsers ignore", () => {
			let result = finding({ "x-frame-options": "ALLOW-FROM https://a.com" }, "x-frame-options");

			expect(result?.status).toBe("weak");
		});
	});

	describe("referrer-policy", () => {
		test("grades the last recognized token", () => {
			let result = finding(
				{ "referrer-policy": "no-referrer, unsafe-url, made-up" },
				"referrer-policy",
			);

			expect(result?.notes).toEqual([
				"unsafe-url sends the full URL, path and query included, to other origins",
			]);
		});

		test("flags a value with no recognized token", () => {
			expect(finding({ "referrer-policy": "made-up" }, "referrer-policy")?.status).toBe("weak");
		});
	});

	describe("permissions-policy", () => {
		test("flags a powerful feature open to every origin", () => {
			let result = finding(
				{ "permissions-policy": "camera=*, fullscreen=*" },
				"permissions-policy",
			);

			expect(result?.notes).toEqual(["camera=* lets every embedded origin use it"]);
		});

		test("reports a value the parser rejects as weak", () => {
			expect(finding({ "permissions-policy": "camera=(" }, "permissions-policy")?.status).toBe(
				"weak",
			);
		});
	});

	test("flags a cross-origin-opener-policy of unsafe-none", () => {
		let result = finding(
			{ "cross-origin-opener-policy": 'unsafe-none; report-to="coop"' },
			"cross-origin-opener-policy",
		);

		expect(result?.status).toBe("weak");
	});
});
