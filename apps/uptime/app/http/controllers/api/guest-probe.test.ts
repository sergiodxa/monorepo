/**
 * Tests `POST /api/v1/guest/probe`: unpaid callers get an x402 challenge; marketing
 * `/try` is not covered here and stays free.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PaymentRequired } from "@sdxc/x402";

import { isFailure } from "@sdxc/result";
import { PAYMENT_REQUIRED, decodeHeader } from "@sdxc/x402";
import { x402 } from "@sdxc/x402/middleware";
import { createRouter } from "remix/router";
import { beforeAll, describe, expect, test } from "vitest";

import { GUEST_PROBE_AMOUNT } from "~/app/http/middleware/require-guest-probe-payment";
import { sellerConfig } from "~/app/initializers/x402";
import routes from "~/routes/web";

describe("POST /api/v1/guest/probe", () => {
	let router: ReturnType<typeof createRouter>;

	beforeAll(async () => {
		router = createRouter({ middleware: [x402(sellerConfig())] });
		let controller = await import("~/app/http/controllers/api/guest-probe");
		router.map(routes.api.v1.guestProbe, controller.default);
	});

	test("answers 402 with Bazaar metadata when unpaid", async () => {
		let response = await router.fetch(
			new Request("https://uptime.example/api/v1/guest/probe", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ url: "https://example.com" }),
			}),
		);
		expect(response.status).toBe(402);
		let header = response.headers.get(PAYMENT_REQUIRED);
		expect(header).toBeTruthy();
		let decoded = decodeHeader(header!);
		expect(isFailure(decoded)).toBe(false);
		if (isFailure(decoded)) throw new Error("unreachable");
		let body = decoded.data as PaymentRequired;
		expect(body.accepts[0]?.amount).toBe(GUEST_PROBE_AMOUNT);
		expect(body.extensions?.bazaar).toBeTruthy();
	});
});
