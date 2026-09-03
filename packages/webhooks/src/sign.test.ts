/**
 * Tests for outbound signing.
 *
 * The published Standard Webhooks vector pins the signature byte for byte, which
 * is the only check that proves an off-the-shelf receiver will accept what this
 * produces; the rest cover the header ownership and body-exactness guarantees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { InvalidDeliveryError, InvalidSecretError } from "./errors";
import { sign } from "./sign";

/**
 * Test vector published with the Standard Webhooks reference implementation: this
 * secret, id, timestamp, and body must produce exactly this signature.
 */
const VECTOR = {
	secret: "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
	id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
	timestamp: 1614265330,
	body: '{"test": 2432232314}',
	signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
} as const;

describe("sign", () => {
	test("reproduces the published test vector", async () => {
		let signed = unwrap(
			await sign(VECTOR.body, {
				secret: VECTOR.secret,
				id: VECTOR.id,
				timestamp: VECTOR.timestamp,
			}),
		);

		expect(signed.signature).toBe(VECTOR.signature);
	});

	test("reproduces the vector from the whsec_ prefixed secret", async () => {
		let signed = unwrap(
			await sign(VECTOR.body, {
				secret: `whsec_${VECTOR.secret}`,
				id: VECTOR.id,
				timestamp: VECTOR.timestamp,
			}),
		);

		expect(signed.signature).toBe(VECTOR.signature);
	});

	test("sets the three specification headers", async () => {
		let signed = unwrap(
			await sign(VECTOR.body, {
				secret: VECTOR.secret,
				id: VECTOR.id,
				timestamp: VECTOR.timestamp,
			}),
		);

		expect(signed.headers.get("webhook-id")).toBe(VECTOR.id);
		expect(signed.headers.get("webhook-timestamp")).toBe("1614265330");
		expect(signed.headers.get("webhook-signature")).toBe(VECTOR.signature);
	});

	test("returns headers the caller can mutate", async () => {
		let signed = unwrap(await sign({}, { secret: VECTOR.secret, id: "msg_1", timestamp: 1 }));

		signed.headers.set("Content-Type", "application/json");

		expect(signed.headers.get("content-type")).toBe("application/json");
	});

	test("builds a fresh Headers instance per call", async () => {
		let first = unwrap(await sign({}, { secret: VECTOR.secret, id: "msg_1", timestamp: 1 }));
		let second = unwrap(await sign({}, { secret: VECTOR.secret, id: "msg_2", timestamp: 1 }));

		first.headers.set("x-delivery-attempt", "2");

		expect(second.headers).not.toBe(first.headers);
		expect(second.headers.get("x-delivery-attempt")).toBeNull();
		expect(second.headers.get("webhook-id")).toBe("msg_2");
	});

	test("signs a string payload exactly as given", async () => {
		let body = '{ "spaced":  true }';
		let signed = unwrap(await sign(body, { secret: VECTOR.secret, id: "msg_1", timestamp: 1 }));

		expect(signed.body).toBe(body);
	});

	test("serializes a non-string payload once, as JSON", async () => {
		let signed = unwrap(
			await sign({ test: 2432232314 }, { secret: VECTOR.secret, id: "msg_1", timestamp: 1 }),
		);

		expect(signed.body).toBe('{"test":2432232314}');
	});

	test("reads a Date as whole seconds", async () => {
		let fromDate = unwrap(
			await sign(VECTOR.body, {
				secret: VECTOR.secret,
				id: VECTOR.id,
				timestamp: new Date(VECTOR.timestamp * 1000 + 750),
			}),
		);

		expect(fromDate.timestamp).toBe(VECTOR.timestamp);
		expect(fromDate.signature).toBe(VECTOR.signature);
	});

	test("fails without a usable secret", async () => {
		let result = await sign(VECTOR.body, { secret: "", id: "msg_1", timestamp: 1 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidSecretError);
	});

	test("fails on an empty delivery id", async () => {
		let result = await sign(VECTOR.body, { secret: VECTOR.secret, id: "", timestamp: 1 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidDeliveryError);
	});

	test("fails on a fractional timestamp", async () => {
		let result = await sign(VECTOR.body, { secret: VECTOR.secret, id: "msg_1", timestamp: 1.5 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidDeliveryError);
	});

	test("fails on an invalid Date", async () => {
		let result = await sign(VECTOR.body, {
			secret: VECTOR.secret,
			id: "msg_1",
			timestamp: new Date("nope"),
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidDeliveryError);
	});

	test("fails on a payload with no JSON representation", async () => {
		let result = await sign(undefined, { secret: VECTOR.secret, id: "msg_1", timestamp: 1 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidDeliveryError);
	});

	test("fails on a payload with a circular reference", async () => {
		let payload: Record<string, unknown> = {};
		payload.self = payload;

		let result = await sign(payload, { secret: VECTOR.secret, id: "msg_1", timestamp: 1 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidDeliveryError);
	});

	test("keeps the secret out of failure messages", async () => {
		let result = await sign(undefined, { secret: VECTOR.secret, id: "msg_1", timestamp: 1 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).not.toContain(VECTOR.secret);
	});
});
