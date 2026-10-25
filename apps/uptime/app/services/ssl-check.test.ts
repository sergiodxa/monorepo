/**
 * Tests for the per-monitor certificate check's pure rules: which host a monitor's
 * certificate is looked up for, and which columns each log answer writes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { monitoredHost, transparencyPatch } from "~/app/services/ssl-check";

const NOW = Date.parse("2026-10-24T12:00:00Z");

describe("monitoredHost", () => {
	test("reads the host from the monitored URL", () => {
		expect(monitoredHost("https://www.acme-shop.com:8443/health?x=1")).toBe("www.acme-shop.com");
	});

	test("answers an empty host for a URL that cannot be parsed", () => {
		expect(monitoredHost("not a url")).toBe("");
	});
});

describe("transparencyPatch", () => {
	test("writes a found certificate's expiry and issuer", () => {
		let notAfter = Date.parse("2027-01-01T00:00:00Z");

		expect(
			transparencyPatch(
				{
					status: "found",
					certificate: {
						sha256: "abc",
						names: ["www.acme-shop.com"],
						issuer: "Let's Encrypt",
						notBefore: NOW - 1000,
						notAfter,
					},
				},
				NOW,
			),
		).toEqual({
			ssl_expires_at: notAfter,
			ssl_issuer: "Let's Encrypt",
			ssl_transparency_status: "found",
			ssl_transparency_checked_at: NOW,
		});
	});

	test("records only the status when the logs found nothing or could not be read", () => {
		expect(transparencyPatch({ status: "not-found" }, NOW)).toEqual({
			ssl_transparency_status: "not-found",
			ssl_transparency_checked_at: NOW,
		});
		expect(
			transparencyPatch({ status: "unavailable", reason: "Cert Spotter answered 502" }, NOW),
		).toEqual({
			ssl_transparency_status: "unavailable",
			ssl_transparency_checked_at: NOW,
		});
	});
});
