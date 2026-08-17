/**
 * Tests for inbound verification.
 *
 * The published Standard Webhooks vector proves a real sender's delivery is
 * accepted, and every rejection path is exercised separately, because the value of
 * typed failures is that a caller can tell an attack from an unmodelled body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { ReplayStore } from "./replay-store";
import type { SignedDelivery } from "./sign";

import {
	DuplicateDeliveryError,
	InvalidSecretError,
	MalformedSignatureError,
	MalformedTimestampError,
	MissingHeaderError,
	PayloadValidationError,
	ReplayStoreError,
	SignatureMismatchError,
	StaleTimestampError,
	UnreadableBodyError,
} from "./errors";
import { sign } from "./sign";
import { verify } from "./verify";

/**
 * Test vector published with the Standard Webhooks reference implementation, used
 * here as a delivery produced by an independent implementation.
 */
const VECTOR = {
	secret: "MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
	id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
	timestamp: 1614265330,
	body: '{"test": 2432232314}',
	signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
} as const;

/** Secret used by the freshly signed deliveries. */
const SECRET = "c2VjcmV0LXVzZWQtYnktdGhlLXNlbmRlcg";

/** A second secret, standing in for the one a rotation is moving away from. */
const PREVIOUS_SECRET = "cHJldmlvdXMtc2VjcmV0LXRoYXQtcm90YXRlZA";

/** Endpoint the test requests are addressed to; nothing reads it. */
const ENDPOINT = "https://example.com/webhooks/inbound";

/** Tolerance wide enough to accept the vector's 2021 timestamp. */
const WIDE_TOLERANCE: DurationInput = "3650 days";

/** Body used by the freshly signed deliveries. */
const BODY = '{"type":"subscription.created","amount":100}';

/** Counter behind the unique delivery ids each signed delivery gets. */
let deliveries = 0;

/** In-memory `ReplayStore`, recording what was asked of it. */
class MemoryReplayStore implements ReplayStore {
	/** Remembered ids mapped to the TTL they were remembered with. */
	remembered = new Map<string, DurationInput>();

	/** Ids `seen()` was called with, in order. */
	lookups: string[] = [];

	/** Whether the id is currently remembered. */
	async seen(id: string): Promise<boolean> {
		this.lookups.push(id);
		return this.remembered.has(id);
	}

	/** Records the id and the TTL it was given. */
	async remember(id: string, ttl: DurationInput): Promise<void> {
		this.remembered.set(id, ttl);
	}
}

/** A `ReplayStore` whose backing storage is unavailable. */
class BrokenReplayStore implements ReplayStore {
	/**
	 * @param failing Operation that throws; the other one succeeds.
	 */
	constructor(private failing: "seen" | "remember") {}

	/** Throws when configured to fail on reads. */
	async seen(): Promise<boolean> {
		if (this.failing === "seen") throw new Error("KV unavailable");
		return false;
	}

	/** Throws when configured to fail on writes. */
	async remember(): Promise<void> {
		if (this.failing === "remember") throw new Error("KV unavailable");
	}
}

/** Signs a delivery the way a sender would, with a unique id and the current time. */
async function signed(
	options: { body?: string; secret?: string; id?: string; timestamp?: Date | number } = {},
): Promise<SignedDelivery> {
	deliveries += 1;

	return unwrap(
		await sign(options.body ?? BODY, {
			secret: options.secret ?? SECRET,
			id: options.id ?? `msg_${deliveries}`,
			timestamp: options.timestamp ?? new Date(),
		}),
	);
}

/** Wraps a signed delivery in the request a sender would send, optionally altering the body. */
function toRequest(delivery: SignedDelivery, body: string = delivery.body): Request {
	return new Request(ENDPOINT, { method: "POST", headers: delivery.headers, body });
}

/** Builds the vector's delivery as an inbound request. */
function vectorRequest(): Request {
	let headers = new Headers({
		"webhook-id": VECTOR.id,
		"webhook-timestamp": String(VECTOR.timestamp),
		"webhook-signature": VECTOR.signature,
	});

	return new Request(ENDPOINT, { method: "POST", headers, body: VECTOR.body });
}

describe("verify", () => {
	test("accepts the published test vector", async () => {
		let result = await verify(vectorRequest(), {
			secret: VECTOR.secret,
			tolerance: WIDE_TOLERANCE,
		});

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;

		expect(result.data.id).toBe(VECTOR.id);
		expect(result.data.timestamp.getTime()).toBe(VECTOR.timestamp * 1000);
		expect(result.data.body).toBe(VECTOR.body);
		expect(result.data.payload).toEqual({ test: 2432232314 });
	});

	test("accepts the published test vector from the whsec_ prefixed secret", async () => {
		let result = await verify(vectorRequest(), {
			secret: `whsec_${VECTOR.secret}`,
			tolerance: WIDE_TOLERANCE,
		});

		expect(isSuccess(result)).toBe(true);
	});

	test("accepts a delivery signed by this package", async () => {
		let result = await verify(toRequest(await signed()), { secret: SECRET });

		expect(isSuccess(result)).toBe(true);
	});

	test("returns the body exactly as received", async () => {
		let body = '{\n  "spaced" :  true\n}';
		let result = await verify(toRequest(await signed({ body })), { secret: SECRET });

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.body).toBe(body);
	});

	test("rejects a tampered body", async () => {
		let delivery = await signed();
		let result = await verify(toRequest(delivery, `${delivery.body} `), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(SignatureMismatchError);
	});

	test("rejects a tampered signature", async () => {
		let delivery = await signed();
		delivery.headers.set("webhook-signature", "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(SignatureMismatchError);
	});

	test("rejects a tampered delivery id", async () => {
		let delivery = await signed();
		delivery.headers.set("webhook-id", "msg_replaced");

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(SignatureMismatchError);
	});

	test("rejects a secret that does not match", async () => {
		let result = await verify(toRequest(await signed()), { secret: PREVIOUS_SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(SignatureMismatchError);
	});

	test("rejects a timestamp older than the tolerance", async () => {
		let delivery = await signed({ timestamp: new Date(Date.now() - 10 * 60 * 1000) });
		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(StaleTimestampError);
	});

	test("rejects a timestamp further ahead than the tolerance", async () => {
		let delivery = await signed({ timestamp: new Date(Date.now() + 10 * 60 * 1000) });
		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(StaleTimestampError);
	});

	test("accepts a timestamp inside a widened tolerance", async () => {
		let delivery = await signed({ timestamp: new Date(Date.now() - 10 * 60 * 1000) });
		let result = await verify(toRequest(delivery), { secret: SECRET, tolerance: "30 minutes" });

		expect(isSuccess(result)).toBe(true);
	});

	test("rejects everything when the tolerance type is bypassed", async () => {
		let delivery = await signed();
		// @ts-expect-error - only reachable through a cast; it must narrow, never widen
		let result = await verify(toRequest(delivery), { secret: SECRET, tolerance: "not a duration" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(StaleTimestampError);
	});

	test("reports the accepted tolerance on a stale delivery", async () => {
		let timestamp = new Date(Date.now() - 10 * 60 * 1000);
		let result = await verify(toRequest(await signed({ timestamp })), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		if (!(result.error instanceof StaleTimestampError)) return;

		expect(result.error.toleranceMs).toBe(5 * 60 * 1000);
		expect(result.error.timestamp.getTime()).toBe(Math.floor(timestamp.getTime() / 1000) * 1000);
	});

	test("rejects a missing webhook-id header", async () => {
		let delivery = await signed();
		delivery.headers.delete("webhook-id");

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MissingHeaderError);
		if (result.error instanceof MissingHeaderError) expect(result.error.header).toBe("webhook-id");
	});

	test("rejects a missing webhook-timestamp header", async () => {
		let delivery = await signed();
		delivery.headers.delete("webhook-timestamp");

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MissingHeaderError);
		if (result.error instanceof MissingHeaderError) {
			expect(result.error.header).toBe("webhook-timestamp");
		}
	});

	test("rejects a missing webhook-signature header", async () => {
		let delivery = await signed();
		delivery.headers.delete("webhook-signature");

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MissingHeaderError);
		if (result.error instanceof MissingHeaderError) {
			expect(result.error.header).toBe("webhook-signature");
		}
	});

	test("rejects a timestamp header that is not a second count", async () => {
		let delivery = await signed();
		delivery.headers.set("webhook-timestamp", "2026-07-29T00:00:00Z");

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MalformedTimestampError);
	});

	test("rejects a signature header with no readable v1 value", async () => {
		let delivery = await signed();
		delivery.headers.set("webhook-signature", "sha256=deadbeef");

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(MalformedSignatureError);
	});

	test("fails closed when no secret is configured", async () => {
		let result = await verify(toRequest(await signed()), {});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidSecretError);
	});

	test("fails closed when the configured secret is unset", async () => {
		let result = await verify(toRequest(await signed()), { secret: "" });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidSecretError);
	});

	test("accepts a delivery signed with the second secret of a rotation", async () => {
		let delivery = await signed({ secret: PREVIOUS_SECRET });
		let result = await verify(toRequest(delivery), { secrets: [SECRET, PREVIOUS_SECRET] });

		expect(isSuccess(result)).toBe(true);
	});

	test("accepts a header carrying several signatures when one matches", async () => {
		let delivery = await signed();
		let matching = delivery.signature;
		delivery.headers.set("webhook-signature", `v1a,AAAA v1,+/8= ${matching}`);

		let result = await verify(toRequest(delivery), { secret: SECRET });

		expect(isSuccess(result)).toBe(true);
	});

	test("attaches the delivery id to a failure", async () => {
		let delivery = await signed({ id: "msg_attributable" });
		let result = await verify(toRequest(delivery, "tampered"), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.deliveryId).toBe("msg_attributable");
	});

	test("keeps the secret and the signature out of failure values", async () => {
		let delivery = await signed();
		let result = await verify(toRequest(delivery, "tampered"), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;

		let serialized = `${result.error.message} ${JSON.stringify(result.error)}`;
		expect(serialized).not.toContain(SECRET);
		expect(serialized).not.toContain(delivery.signature.slice(3));
	});

	test("rejects a body that was already read", async () => {
		let request = toRequest(await signed());
		await request.text();

		let result = await verify(request, { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(UnreadableBodyError);
	});

	describe("with a schema", () => {
		let schema = s.object({ type: s.string(), amount: s.number() });

		test("parses the verified body into the schema's type", async () => {
			let result = await verify(toRequest(await signed()), { secret: SECRET, schema });

			expect(isSuccess(result)).toBe(true);
			if (!isSuccess(result)) return;

			expect(result.data.payload.type).toBe("subscription.created");
			expect(result.data.payload.amount).toBe(100);
		});

		test("reports an unexpected shape as a parsing failure, not an authentication failure", async () => {
			let body = '{"type":"subscription.created","amount":"one hundred"}';
			let result = await verify(toRequest(await signed({ body })), { secret: SECRET, schema });

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;

			expect(result.error).toBeInstanceOf(PayloadValidationError);
			expect(result.error).not.toBeInstanceOf(SignatureMismatchError);
		});

		test("keeps the verified body and issues on the parsing failure", async () => {
			let body = '{"type":"subscription.created"}';
			let result = await verify(toRequest(await signed({ body })), { secret: SECRET, schema });

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;
			if (!(result.error instanceof PayloadValidationError)) return;

			expect(result.error.body).toBe(body);
			expect(result.error.issues.length).toBeGreaterThan(0);
		});

		test("still rejects an unauthentic request before parsing it", async () => {
			let delivery = await signed();
			let result = await verify(toRequest(delivery, '{"type":1}'), { secret: SECRET, schema });

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) expect(result.error).toBeInstanceOf(SignatureMismatchError);
		});
	});

	test("reports a verified body that is not JSON as a parsing failure", async () => {
		let result = await verify(toRequest(await signed({ body: "not json" })), { secret: SECRET });

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		if (!(result.error instanceof PayloadValidationError)) return;

		expect(result.error.body).toBe("not json");
	});

	describe("with a replay store", () => {
		test("rejects a delivery id that was already accepted", async () => {
			let store = new MemoryReplayStore();
			let delivery = await signed();

			let first = await verify(toRequest(delivery), { secret: SECRET, store });
			let second = await verify(toRequest(delivery), { secret: SECRET, store });

			expect(isSuccess(first)).toBe(true);
			expect(isFailure(second)).toBe(true);
			if (isFailure(second)) expect(second.error).toBeInstanceOf(DuplicateDeliveryError);
		});

		test("accepts a different delivery id", async () => {
			let store = new MemoryReplayStore();

			expect(isSuccess(await verify(toRequest(await signed()), { secret: SECRET, store }))).toBe(
				true,
			);
			expect(isSuccess(await verify(toRequest(await signed()), { secret: SECRET, store }))).toBe(
				true,
			);
		});

		test("remembers an accepted id for twice the tolerance by default", async () => {
			let store = new MemoryReplayStore();
			let delivery = await signed();

			await verify(toRequest(delivery), { secret: SECRET, store });

			expect(store.remembered.get(delivery.id)).toBe(10 * 60 * 1000);
		});

		test("remembers an accepted id for a configured ttl", async () => {
			let store = new MemoryReplayStore();
			let delivery = await signed();

			await verify(toRequest(delivery), { secret: SECRET, store, ttl: "1 hour" });

			expect(store.remembered.get(delivery.id)).toBe("1 hour");
		});

		test("never touches the store for an unauthentic request", async () => {
			let store = new MemoryReplayStore();
			let delivery = await signed();

			await verify(toRequest(delivery, "tampered"), { secret: SECRET, store });

			expect(store.lookups).toEqual([]);
			expect(store.remembered.size).toBe(0);
		});

		test("does not remember a delivery whose payload was rejected", async () => {
			let store = new MemoryReplayStore();
			let delivery = await signed({ body: "not json" });

			await verify(toRequest(delivery), { secret: SECRET, store });

			expect(store.remembered.size).toBe(0);
		});

		test("fails closed when the store cannot be read", async () => {
			let result = await verify(toRequest(await signed()), {
				secret: SECRET,
				store: new BrokenReplayStore("seen"),
			});

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;
			expect(result.error).toBeInstanceOf(ReplayStoreError);
			if (result.error instanceof ReplayStoreError) expect(result.error.operation).toBe("seen");
		});

		test("fails closed when the accepted id cannot be recorded", async () => {
			let result = await verify(toRequest(await signed()), {
				secret: SECRET,
				store: new BrokenReplayStore("remember"),
			});

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;
			expect(result.error).toBeInstanceOf(ReplayStoreError);
			if (result.error instanceof ReplayStoreError) expect(result.error.operation).toBe("remember");
		});
	});
});
