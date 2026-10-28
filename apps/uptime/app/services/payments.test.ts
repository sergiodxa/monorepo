/**
 * Unit tests for the soft-launch payments gate on the guest probe.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { isPaymentsFacilitatorUrl, paymentsEnabled } from "./payments";

describe("isPaymentsFacilitatorUrl", () => {
	test("disables charging for soft-launch values", () => {
		expect(isPaymentsFacilitatorUrl(null)).toBe(false);
		expect(isPaymentsFacilitatorUrl("")).toBe(false);
		expect(isPaymentsFacilitatorUrl("memory")).toBe(false);
	});

	test("enables charging for a real facilitator and for Vitest stubs", () => {
		expect(isPaymentsFacilitatorUrl("https://facilitator.example")).toBe(true);
		expect(isPaymentsFacilitatorUrl("test-X402_FACILITATOR_URL")).toBe(true);
	});
});

describe("paymentsEnabled", () => {
	test("is true under the Vitest cloudflare:workers stub", () => {
		expect(paymentsEnabled()).toBe(true);
	});
});
