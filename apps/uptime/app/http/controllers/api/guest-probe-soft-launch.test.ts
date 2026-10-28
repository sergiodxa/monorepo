/**
 * Soft-launch mode for the guest probe: when payments are disabled the payment
 * guard passes through unpaid. The handler is a stub so the assertion stays on
 * the guard rather than Durable Object bindings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { PAYMENT_REQUIRED } from "@sdxc/x402";
import { x402 } from "@sdxc/x402/middleware";
import { createAction, createRouter } from "remix/router";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.doMock("~/app/services/payments", () => ({
	paymentsEnabled: () => false,
	isPaymentsFacilitatorUrl: () => false,
}));

describe("POST /api/v1/guest/probe soft-launch (payments disabled)", () => {
	let router: ReturnType<typeof createRouter>;

	beforeAll(async () => {
		let { sellerConfig } = await import("~/app/initializers/x402");
		let { requireGuestProbePayment } =
			await import("~/app/http/middleware/require-guest-probe-payment");
		let routes = (await import("~/routes/web")).default;
		router = createRouter({
			middleware: [log() as Middleware, x402(sellerConfig())],
		});
		router.map(
			routes.api.v1.guestProbe,
			createAction(routes.api.v1.guestProbe, {
				middleware: [requireGuestProbePayment],
				/**
				 * Stub handler: soft-launch only needs the payment guard to pass.
				 */
				handler: async () =>
					new Response(JSON.stringify({ ok: true }), {
						status: 200,
						headers: { "content-type": "application/json" },
					}),
			}),
		);
	});

	test("does not answer 402 when unpaid", async () => {
		let response = await router.fetch(
			new Request("https://uptime.example/api/v1/guest/probe", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ url: "https://example.com" }),
			}),
		);
		expect(response.headers.get(PAYMENT_REQUIRED)).toBeNull();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});
});
