/**
 * Tests the Base64 JSON codecs for x402 payment headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	decodeHeader,
	decodePaymentSignature,
	encodeHeader,
	encodePaymentRequired,
} from "./headers.js";

describe("encodeHeader / decodeHeader", () => {
	test("round-trips a JSON object", () => {
		let encoded = encodeHeader({ hello: "world", n: 1 });
		let decoded = decodeHeader(encoded);
		expect(isSuccess(decoded)).toBe(true);
		if (isSuccess(decoded)) expect(decoded.data).toEqual({ hello: "world", n: 1 });
	});

	test("refuses garbage", () => {
		let decoded = decodeHeader("%%%");
		expect(isFailure(decoded)).toBe(true);
	});
});

describe("payment required / signature", () => {
	test("encodes a PaymentRequired body", () => {
		let header = encodePaymentRequired({
			x402Version: 2,
			resource: { url: "https://apis.example/v1/qr", description: "Encode a QR" },
			accepts: [
				{
					scheme: "exact",
					network: "eip155:84532",
					amount: "1000",
					asset: "0xusdc",
					payTo: "0xpay",
					maxTimeoutSeconds: 60,
				},
			],
		});
		let decoded = decodeHeader(header);
		expect(isSuccess(decoded)).toBe(true);
	});

	test("decodes a well-formed payment signature", () => {
		let header = encodeHeader({
			x402Version: 2,
			accepted: {
				scheme: "exact",
				network: "eip155:84532",
				amount: "1000",
				asset: "0xusdc",
				payTo: "0xpay",
				maxTimeoutSeconds: 60,
			},
			payload: { payer: "0xbuyer" },
		});
		let decoded = decodePaymentSignature(header);
		expect(isSuccess(decoded)).toBe(true);
		if (isSuccess(decoded)) expect(decoded.data.payload.payer).toBe("0xbuyer");
	});

	test("refuses a signature without accepted", () => {
		let header = encodeHeader({ x402Version: 2, payload: {} });
		expect(isFailure(decodePaymentSignature(header))).toBe(true);
	});
});
