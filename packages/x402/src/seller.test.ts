/**
 * Tests the seller challenge and the memory-facilitator collect path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { PAYMENT_REQUIRED, PAYMENT_SIGNATURE } from "./headers.js";
import { memoryPaymentSignature, testSeller } from "./testing.js";

describe("Seller", () => {
	test("challenge answers 402 with PAYMENT-REQUIRED", () => {
		let seller = testSeller();
		let response = seller.challenge({
			amount: "1000",
			resource: { url: "https://apis.example/v1/qr", description: "QR" },
		});
		expect(response.status).toBe(402);
		expect(response.headers.get(PAYMENT_REQUIRED)).toBeTruthy();
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	test("collect settles a memory payment signature", async () => {
		let seller = testSeller();
		let requirements = seller.requirements("1000");
		let request = new Request("https://apis.example/v1/qr", {
			method: "POST",
			headers: { [PAYMENT_SIGNATURE]: memoryPaymentSignature(requirements) },
		});
		let receipt = await seller.collect(request, {
			amount: "1000",
			resource: { url: "https://apis.example/v1/qr", description: "QR" },
		});
		expect(isSuccess(receipt)).toBe(true);
		if (isSuccess(receipt)) {
			expect(receipt.data.amount).toBe("1000");
			expect(receipt.data.transaction).toMatch(/^memory-/);
		}
	});

	test("collect refuses a missing signature", async () => {
		let seller = testSeller();
		let receipt = await seller.collect(
			new Request("https://apis.example/v1/qr", { method: "POST" }),
			{
				amount: "1000",
				resource: { url: "https://apis.example/v1/qr", description: "QR" },
			},
		);
		expect(isFailure(receipt)).toBe(true);
	});

	test("collect refuses a wrong amount", async () => {
		let seller = testSeller();
		let wrong = seller.requirements("999");
		let request = new Request("https://apis.example/v1/qr", {
			method: "POST",
			headers: { [PAYMENT_SIGNATURE]: memoryPaymentSignature(wrong) },
		});
		let receipt = await seller.collect(request, {
			amount: "1000",
			resource: { url: "https://apis.example/v1/qr", description: "QR" },
		});
		expect(isFailure(receipt)).toBe(true);
	});
});
