/**
 * Tests the HTTP facilitator client: auth headers on `/verify` and `/settle`,
 * and the memory facilitator settle path used in local development.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { PaymentPayload, PaymentRequirements } from "./types.js";

import { HTTPFacilitator, MemoryFacilitator } from "./facilitator.js";

const FACILITATOR = "https://facilitator.test";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Minimal payload that matches the requirements below. */
function payload(requirements: PaymentRequirements): PaymentPayload {
	return {
		x402Version: 2,
		accepted: requirements,
		payload: { payer: "0xbuyer" },
	};
}

/** Requirements the memory and HTTP doubles settle. */
function requirements(): PaymentRequirements {
	return {
		scheme: "exact",
		network: "eip155:84532",
		amount: "1000",
		asset: "0xasset",
		payTo: "0xpayto",
		maxTimeoutSeconds: 60,
		extra: null,
	};
}

describe("HTTPFacilitator", () => {
	test("forwards configured Authorization on verify and settle", async () => {
		let seen: string[] = [];
		server.use(
			http.post(`${FACILITATOR}/verify`, ({ request }) => {
				seen.push(request.headers.get("authorization") ?? "");
				return HttpResponse.json({ isValid: true, payer: "0xbuyer" });
			}),
			http.post(`${FACILITATOR}/settle`, ({ request }) => {
				seen.push(request.headers.get("authorization") ?? "");
				return HttpResponse.json({
					success: true,
					payer: "0xbuyer",
					transaction: "0xabc",
					network: "eip155:84532",
					amount: "1000",
				});
			}),
		);

		let facilitator = new HTTPFacilitator({
			url: FACILITATOR,
			headers: { Authorization: "Bearer cdp-token" },
		});
		let req = requirements();
		let body = payload(req);

		let verified = await facilitator.verify(body, req);
		expect(isSuccess(verified)).toBe(true);

		let settled = await facilitator.settle(body, req);
		expect(isSuccess(settled)).toBe(true);
		expect(seen).toEqual(["Bearer cdp-token", "Bearer cdp-token"]);
	});
});

describe("MemoryFacilitator", () => {
	test("settles a matching payload", async () => {
		let facilitator = new MemoryFacilitator();
		let req = requirements();
		let settled = await facilitator.settle(payload(req), req);
		expect(isSuccess(settled)).toBe(true);
		if (isSuccess(settled)) {
			expect(settled.data.success).toBe(true);
			expect(settled.data.payer).toBe("0xbuyer");
		}
	});
});
