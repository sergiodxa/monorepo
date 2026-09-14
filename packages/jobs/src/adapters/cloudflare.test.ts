/**
 * Exercises the Cloudflare backend against the platform's own limits: the envelope and
 * content type it writes, the batch ceiling it chunks at, the delay it refuses rather than
 * shortens, the failure it reports when the binding will not take a write, and the
 * dead-letter queue its worker handlers write to and consume.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageBatch, Queue } from "@cloudflare/workers-types";

import { createQueue } from "@sdxc/cloudflare-mocks";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test, vi } from "vitest";

import type { JobDelivery, JobMessage, Settlement } from "../queue.js";

import type { JobWorkerTarget } from "./cloudflare.js";

import { queue, worker } from "./cloudflare.js";

/** The adapter over a recording binding, plus the binding itself. */
function setup() {
	let binding = createQueue({ name: "ping" });

	return {
		binding,
		sendBatch: vi.spyOn(binding, "sendBatch"),
		platform: queue(() => binding as unknown as Queue),
	};
}

describe("queue()", () => {
	test("leaves the retry ceiling to the platform", () => {
		let { platform } = setup();

		expect(platform.retries).toBe("backend");
	});

	test("writes the envelope as JSON", async () => {
		let { binding, platform } = setup();

		unwrap(await platform.send([{ job: "checkHttp", body: { monitorId: "m1" } }]));

		expect(binding.sent).toEqual([
			expect.objectContaining({
				body: { job: "checkHttp", body: { monitorId: "m1" } },
				contentType: "json",
			}),
		]);
	});

	test("writes no body for a job that carries no payload", async () => {
		let { binding, platform } = setup();

		unwrap(await platform.send([{ job: "clean" }]));

		expect(binding.messages.map((message) => message.body)).toEqual([{ job: "clean" }]);
	});

	test("resolves the binding per call, so importing a producer touches none", async () => {
		let binding = createQueue({ name: "ping" });
		let reads = 0;
		let platform = queue(() => {
			reads += 1;
			return binding as unknown as Queue;
		});

		expect(reads).toBe(0);

		unwrap(await platform.send([{ job: "clean" }]));

		expect(reads).toBe(1);
	});

	test("enqueues nothing for an empty list", async () => {
		let { sendBatch, platform } = setup();

		unwrap(await platform.send([]));

		expect(sendBatch).not.toHaveBeenCalled();
	});

	test("chunks a batch past the ceiling a single write accepts", async () => {
		let { binding, sendBatch, platform } = setup();
		let messages: JobMessage[] = Array.from({ length: 250 }, () => ({ job: "clean" }));

		unwrap(await platform.send(messages));

		expect(sendBatch).toHaveBeenCalledTimes(3);
		expect(binding.messages).toHaveLength(250);
	});

	test("carries a delay the platform can hold", async () => {
		let { binding, platform } = setup();

		unwrap(await platform.send([{ job: "clean", delay: "5 minutes" }]));

		expect(binding.sent).toEqual([expect.objectContaining({ delaySeconds: 300 })]);
	});

	test("refuses a delay longer than a message is held for, rather than shortening it", async () => {
		let { sendBatch, platform } = setup();

		let result = await platform.send([{ job: "clean", delay: "3 days" }]);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.code).toBe("unsupported_delay");
		expect(sendBatch).not.toHaveBeenCalled();
	});

	test("refuses the whole batch when one message asks to be held too long", async () => {
		let { sendBatch, platform } = setup();

		let result = await platform.send([{ job: "clean" }, { job: "clean", delay: "3 days" }]);

		expect(isSuccess(result)).toBe(false);
		expect(sendBatch).not.toHaveBeenCalled();
	});

	test("reports a binding that refuses the write, carrying the original as its cause", async () => {
		let refused = new Error("queue is over its backlog limit");
		let platform = queue(() => ({ sendBatch: () => Promise.reject(refused) }) as unknown as Queue);

		let result = await platform.send([{ job: "clean" }]);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.code).toBe("unavailable");
			expect(result.error.cause).toBe(refused);
		}
	});
});

/** What the adapter told the dispatcher about a batch it handed over. */
interface Handover {
	queue: string | undefined;
	deadLettered: boolean | undefined;
	deliveries: JobDelivery[];
}

/**
 * A dispatcher stand-in that settles every delivery the same way and records what it was
 * told, so a worker's own decisions are read without a job map behind them.
 *
 * @param settlement What every delivery in the batch ends as.
 */
function target(settlement: Settlement): { handover: Handover; dispatcher: JobWorkerTarget } {
	let handover: Handover = { queue: undefined, deadLettered: undefined, deliveries: [] };

	return {
		handover,
		dispatcher: {
			async deliverBatch(deliveries, options) {
				handover.queue = options.queue;
				handover.deadLettered = options.deadLettered;
				handover.deliveries = deliveries;

				for (let delivery of deliveries) await options.apply(delivery, settlement);
			},
			tick: () => Promise.resolve(),
		},
	};
}

/** Drives one batch through a worker's queue handler. */
function deliver(
	binding: ReturnType<typeof createQueue>,
	handlers: { queue: (batch: MessageBatch<unknown>) => Promise<void> },
) {
	return binding.consume((batch) => handlers.queue(batch as MessageBatch<unknown>));
}

describe("worker()", () => {
	test("writes a refused body to the dead-letter queue, wrapped, and acks it", async () => {
		let binding = createQueue({ name: "ping" });
		let dlq = createQueue({ name: "ping-dlq" });
		let { dispatcher } = target({ type: "dead-letter", reason: "invalid_message" });

		await binding.send({ job: "nobodyHome" });
		let result = await deliver(binding, worker(dispatcher, { deadLetter: () => dlq as Queue }));

		expect(dlq.messages.map((message) => message.body)).toEqual([
			{ invalid: { job: "nobodyHome" } },
		]);
		expect(result.acked).toHaveLength(1);
	});

	test("acks a refused body where it stands when no dead-letter binding was given", async () => {
		let binding = createQueue({ name: "ping" });
		let { dispatcher } = target({ type: "dead-letter", reason: "invalid_message" });

		await binding.send({ job: "nobodyHome" });
		let result = await deliver(binding, worker(dispatcher));

		expect(result.acked).toHaveLength(1);
	});

	test("leaves a message unacked when the dead-letter queue will not take it", async () => {
		let binding = createQueue({ name: "ping" });
		let refused = new Error("queue is over its backlog limit");
		let dlq = { send: () => Promise.reject(refused) } as unknown as Queue;
		let { dispatcher } = target({ type: "dead-letter", reason: "invalid_message" });

		await binding.send({ job: "nobodyHome" });
		let result = await deliver(binding, worker(dispatcher, { deadLetter: () => dlq })).catch(
			(error: unknown) => error,
		);

		expect(result).toBe(refused);
		expect(binding.messages).toHaveLength(1);
	});

	test("tells the dispatcher a batch from the dead-letter queue is dead-lettered", async () => {
		let dlq = createQueue({ name: "ping-dlq" });
		let { handover, dispatcher } = target({ type: "ack" });

		await dlq.send({ invalid: { job: "nobodyHome" } });
		await deliver(dlq, worker(dispatcher, { deadLetterQueue: "ping-dlq" }));

		expect(handover).toMatchObject({ queue: "ping-dlq", deadLettered: true });
	});

	test("dispatches a batch from the work queue, whatever the dead-letter queue is called", async () => {
		let binding = createQueue({ name: "ping" });
		let { handover, dispatcher } = target({ type: "ack" });

		await binding.send({ job: "clean" });
		await deliver(binding, worker(dispatcher, { deadLetterQueue: "ping-dlq" }));

		expect(handover).toMatchObject({ queue: "ping", deadLettered: false });
	});
});
