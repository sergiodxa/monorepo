/**
 * Router-level tests for a priced operation: unpaid → 402, memory payment → 200.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaymentRequired, PaymentRequirements } from "@sdxc/x402";

import { isFailure } from "@sdxc/result";
import { PAYMENT_REQUIRED, PAYMENT_RESPONSE, PAYMENT_SIGNATURE, decodeHeader } from "@sdxc/x402";
import { memoryPaymentSignature } from "@sdxc/x402/testing";
import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

/**
 * Reads the first accept entry off a 402 `PAYMENT-REQUIRED` header so the retry
 * signature matches whatever wallet/network the seller actually advertised.
 *
 * @param header - Raw `PAYMENT-REQUIRED` value
 */
function acceptedRequirements(header: string | null): PaymentRequirements {
	expect(header).toBeTruthy();
	let decoded = decodeHeader(header!);
	expect(isFailure(decoded)).toBe(false);
	if (isFailure(decoded)) throw new Error("unreachable");
	let body = decoded.data as PaymentRequired;
	expect(body.accepts.length).toBeGreaterThan(0);
	return body.accepts[0]!;
}

describe("POST /v1/semver.satisfies", () => {
	let router: ReturnType<typeof createWebRouter>;

	beforeAll(() => {
		router = createWebRouter();
	});

	test("answers 402 without payment", async () => {
		let response = await router.fetch(
			new Request("https://apis.sdxc.dev/v1/semver.satisfies", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					version: "1.2.3",
					comparison: "^",
					against: "1.0.0",
				}),
			}),
		);
		expect(response.status).toBe(402);
		expect(response.headers.get(PAYMENT_REQUIRED)).toBeTruthy();
	});

	test("runs the operation after a memory payment", async () => {
		let challenge = await router.fetch(
			new Request("https://apis.sdxc.dev/v1/semver.satisfies", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					version: "1.2.3",
					comparison: "^",
					against: "1.0.0",
				}),
			}),
		);
		expect(challenge.status).toBe(402);
		let requirements = acceptedRequirements(challenge.headers.get(PAYMENT_REQUIRED));

		let response = await router.fetch(
			new Request("https://apis.sdxc.dev/v1/semver.satisfies", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					[PAYMENT_SIGNATURE]: memoryPaymentSignature(requirements),
				},
				body: JSON.stringify({
					version: "1.2.3",
					comparison: "^",
					against: "1.0.0",
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get(PAYMENT_RESPONSE)).toBeTruthy();
		let body = (await response.json()) as {
			operation: string;
			result: { satisfies: boolean };
		};
		expect(body.operation).toBe("semver.satisfies");
		expect(body.result.satisfies).toBe(true);
	});

	test("answers 404 for an unknown operation", async () => {
		let response = await router.fetch(
			new Request("https://apis.sdxc.dev/v1/nope", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
			}),
		);
		expect(response.status).toBe(404);
	});
});
