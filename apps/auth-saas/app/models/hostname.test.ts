/**
 * Behavioural tests for `Hostname.getStatusMessage`, which derives the
 * human-readable state shown for a custom domain from its stored status and
 * the Cloudflare SSL sub-status, exercised through direct input/output assertions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import Hostname from "./hostname";

describe("Hostname.getStatusMessage", () => {
	test("reports Active once the hostname is active, ignoring ssl_status", () => {
		expect(Hostname.getStatusMessage({ status: "active", ssl_status: null })).toBe("Active");
		expect(Hostname.getStatusMessage({ status: "active", ssl_status: "pending_validation" })).toBe(
			"Active",
		);
	});

	test("reports pending DNS validation while ssl awaits validation", () => {
		expect(
			Hostname.getStatusMessage({ status: "pending_validation", ssl_status: "pending_validation" }),
		).toBe("Pending DNS validation");
	});

	test("reports certificate issuance while ssl is pending_issuance", () => {
		expect(
			Hostname.getStatusMessage({ status: "pending_validation", ssl_status: "pending_issuance" }),
		).toBe("SSL certificate being issued");
	});

	test("reports certificate deployment while ssl is pending_deployment", () => {
		expect(
			Hostname.getStatusMessage({ status: "pending_validation", ssl_status: "pending_deployment" }),
		).toBe("SSL certificate being deployed");
	});

	test("falls back to the raw status when ssl_status is unrecognised", () => {
		expect(
			Hostname.getStatusMessage({ status: "pending_validation", ssl_status: "initializing" }),
		).toBe("Status: pending_validation");
	});

	test("falls back to the raw status when there is no ssl_status", () => {
		expect(Hostname.getStatusMessage({ status: "deleted", ssl_status: null })).toBe(
			"Status: deleted",
		);
	});
});
