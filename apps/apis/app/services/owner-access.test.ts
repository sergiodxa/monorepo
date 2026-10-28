/**
 * Unit tests for the operator Bearer check: matching token, wrong token, missing
 * header and empty secret all decide bypass without throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isOwnerRequest } from "~/app/services/owner-access";

/** Value the Vitest `cloudflare:workers` stub answers for `OWNER_ACCESS_TOKEN`. */
const STUB_TOKEN = "test-OWNER_ACCESS_TOKEN";

describe("isOwnerRequest", () => {
	test("accepts the stub Owner Bearer token", () => {
		let request = new Request("https://api.sdxc.dev/v1/semver.satisfies", {
			headers: { Authorization: `Bearer ${STUB_TOKEN}` },
		});
		expect(isOwnerRequest(request)).toBe(true);
	});

	test("rejects a wrong Bearer token without revealing the secret", () => {
		let request = new Request("https://api.sdxc.dev/v1/semver.satisfies", {
			headers: { Authorization: "Bearer wrong-token" },
		});
		expect(isOwnerRequest(request)).toBe(false);
	});

	test("rejects a request with no Authorization header", () => {
		let request = new Request("https://api.sdxc.dev/v1/semver.satisfies");
		expect(isOwnerRequest(request)).toBe(false);
	});

	test("rejects a non-Bearer Authorization scheme", () => {
		let request = new Request("https://api.sdxc.dev/v1/semver.satisfies", {
			headers: { Authorization: `Token ${STUB_TOKEN}` },
		});
		expect(isOwnerRequest(request)).toBe(false);
	});
});
