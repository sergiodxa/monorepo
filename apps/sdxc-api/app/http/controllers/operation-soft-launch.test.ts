/**
 * Soft-launch mode: when payments are disabled the priced operation runs without
 * a PAYMENT-SIGNATURE and without answering 402.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PAYMENT_REQUIRED, PAYMENT_RESPONSE } from "@sdxc/x402";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.doMock("~/app/services/payments", () => ({
	paymentsEnabled: () => false,
	isPaymentsFacilitatorUrl: () => false,
}));

let createWebRouter: typeof import("~/app/initializers/router").createWebRouter;

describe("POST /v1/* soft-launch (payments disabled)", () => {
	let router: ReturnType<typeof createWebRouter>;

	beforeAll(async () => {
		({ createWebRouter } = await import("~/app/initializers/router"));
		router = createWebRouter();
	});

	test("runs the operation without a payment signature", async () => {
		let response = await router.fetch(
			new Request("https://api.sdxc.dev/v1/semver.satisfies", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					version: "1.2.3",
					comparison: "^",
					against: "1.0.0",
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get(PAYMENT_REQUIRED)).toBeNull();
		expect(response.headers.get(PAYMENT_RESPONSE)).toBeNull();
		let body = (await response.json()) as {
			operation: string;
			payment: null;
			result: { satisfies: boolean };
		};
		expect(body.operation).toBe("semver.satisfies");
		expect(body.payment).toBeNull();
		expect(body.result.satisfies).toBe(true);
	});
});
