/**
 * Exercises what happens around the handler: the timeout that aborts its signal
 * and stops the dispatcher waiting, the monitor ping a completed run sends, the
 * dead-letter batches the dispatcher records itself, and the errors it does not own —
 * each read back off the job log the run emits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageBatch } from "@cloudflare/workers-types";
import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { JSONValue } from "@sdxc/types";

import { createQueue } from "@sdxc/cloudflare-mocks";
import { createLogger } from "@sdxc/logger";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { createJobDispatcher, createJobHandler, job, jobs } from "./index.js";

const UPTIME_URL = "https://uptime.sergiodxa.com";
const MONITOR_ID = "monitor-1";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

afterEach(() => vi.useRealTimers());

/** Builds a map whose sends land in a recording queue binding, and a logger whose records are collected. */
function setup() {
	let queue = createQueue({ name: "ping" }) as QueueMock<unknown>;
	let records: Record<string, unknown>[] = [];
	let logger = createLogger({ service: "test", sink: (record) => void records.push(record) });

	let map = jobs({
		clean: job(),
		watched: job({ monitorId: MONITOR_ID }),
	});

	/** The queue write a dispatcher in these tests is built with. */
	let send = async (bodies: JSONValue[]) => {
		await queue.sendBatch(bodies.map((body) => ({ body })));
	};

	/** The records of one kind, in the order they were emitted. */
	let ofKind = (kind: string) => records.filter((record) => record.kind === kind);

	return { queue, map, send, logger, records, ofKind };
}

/** Delivers everything pending to the dispatcher, as the worker's `queue` handler would. */
function consume(
	queue: QueueMock<unknown>,
	handler: (batch: MessageBatch<unknown>) => Promise<void>,
) {
	return queue.consume((batch) => handler(batch as MessageBatch<unknown>));
}

describe("timeouts", () => {
	test("aborts the signal and stops waiting for a handler that ignores it", async () => {
		let { queue, map, send, logger, ofKind } = setup();
		let aborted = vi.fn();

		vi.useFakeTimers();

		let dispatcher = createJobDispatcher({ send, logger, timeout: "1 second" });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => {
				ctx.signal.addEventListener("abort", () => aborted());
				return new Promise<void>(() => {});
			}),
		);

		await dispatcher.enqueue(map.clean);

		let running = consume(queue, (batch) => dispatcher.queue(batch));
		await vi.advanceTimersByTimeAsync(1_000);
		expect(aborted).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(5_000);
		let result = await running;

		expect(result.retried).toHaveLength(1);
		expect(ofKind("job")[0]).toMatchObject({
			"job.ending": "timeout",
			outcome: "error",
			"error.type": "Job.Timeout",
		});
		expect(ofKind("queue")[0]).toMatchObject({ "jobs.timed_out": 1, outcome: "degraded" });
	});

	test("lets a handler that gives up settle it first", async () => {
		let { queue, map, send, logger, ofKind } = setup();

		vi.useFakeTimers();

		let dispatcher = createJobDispatcher({ send, logger, timeout: "1 second" });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, async (ctx) => {
				await new Promise<void>((resolve) => ctx.signal.addEventListener("abort", () => resolve()));
				ctx.ack();
			}),
		);

		await dispatcher.enqueue(map.clean);

		let running = consume(queue, (batch) => dispatcher.queue(batch));
		await vi.advanceTimersByTimeAsync(1_000);
		let result = await running;

		expect(result.acked).toHaveLength(1);
		expect(ofKind("job")[0]).toMatchObject({ "job.ending": "timeout", outcome: "error" });
	});

	test("reports a job that timed itself out", async () => {
		let { queue, map, send, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ send, logger, timeout: "1 minute" });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.timeout("Still fetching")),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.retried).toHaveLength(1);
		expect(ofKind("job")[0]).toMatchObject({
			"job.ending": "timeout",
			outcome: "error",
			"error.type": "Job.Timeout",
			"error.message": "Still fetching",
		});
	});

	test("waits indefinitely when no timeout is configured", async () => {
		let { queue, map, send, logger } = setup();

		let dispatcher = createJobDispatcher({ send, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => {
				expect(ctx.signal.aborted).toBe(false);
			}),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
	});
});

describe("the monitor ping", () => {
	test("reports a completed run to the job's monitor", async () => {
		let { queue, map, send, logger, ofKind } = setup();
		let pinged = vi.fn();

		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, ({ request }) => {
				pinged(request.headers.get("Authorization"));
				return HttpResponse.json({ ok: true });
			}),
		);

		let dispatcher = createJobDispatcher({ send, logger, uptime: () => "token-1" });
		dispatcher.map(
			map.watched,
			createJobHandler(map.watched, () => {}),
		);

		await dispatcher.enqueue(map.watched);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(pinged).toHaveBeenCalledWith("Bearer token-1");
		expect(result.acked).toHaveLength(1);
		expect(ofKind("job")[0]).toMatchObject({ "job.ending": "done", outcome: "ok" });
	});

	test("skips the ping when the job names no monitor", async () => {
		let { queue, map, send, logger } = setup();

		let dispatcher = createJobDispatcher({ send, logger, uptime: () => "token-1" });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
	});

	test("acks the message when the ping itself fails, leaving the run done", async () => {
		let { queue, map, send, logger, ofKind } = setup();

		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, () =>
				HttpResponse.text("nope", { status: 500 }),
			),
		);

		let dispatcher = createJobDispatcher({ send, logger, uptime: () => "token-1" });
		dispatcher.map(
			map.watched,
			createJobHandler(map.watched, () => {}),
		);

		await dispatcher.enqueue(map.watched);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(ofKind("job")[0]).toMatchObject({
			"job.ending": "done",
			outcome: "degraded",
			notes: [
				expect.objectContaining({
					level: "warn",
					name: "job.uptime_failed",
					error: "Fetch failed with status 500: nope",
				}),
			],
		});
		expect(ofKind("queue")[0]).toMatchObject({ "jobs.done": 1 });
	});
});

describe("the dead-letter queue", () => {
	test("records a body the dispatcher refused as a dead-lettered job, and acks it", async () => {
		let dlq = createQueue({ name: "ping-dlq" }) as QueueMock<unknown>;
		let { logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ logger, deadLetterQueue: "ping-dlq" });

		await dlq.send({ invalid: { type: "nobodyHome" } });
		let result = await consume(dlq, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(ofKind("job")[0]).toMatchObject({
			"job.name": "nobodyHome",
			"job.attempts": 1,
			"job.ending": "dead_letter",
			"job.dead_letter": "invalid_message",
			"job.body": '{"type":"nobodyHome"}',
			outcome: "error",
			"error.type": "Job.DeadLettered",
		});
		expect(ofKind("queue")[0]).toMatchObject({
			"queue.name": "ping-dlq",
			"jobs.dead_lettered": 1,
			outcome: "degraded",
		});
	});

	test("records a body that exhausted its retries as a dead-lettered job, and acks it", async () => {
		let dlq = createQueue({ name: "ping-dlq" }) as QueueMock<unknown>;
		let { logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ logger, deadLetterQueue: "ping-dlq" });

		await dlq.send({ type: "clean" });
		let result = await consume(dlq, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(ofKind("job")[0]).toMatchObject({
			"job.name": "clean",
			"job.ending": "dead_letter",
			"job.dead_letter": "retries_exhausted",
			"job.body": '{"type":"clean"}',
			outcome: "error",
		});
	});
});

describe("errors the package does not own", () => {
	test("re-throws so the platform retries the invocation", async () => {
		let { queue, map, send, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ send, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {
				throw new Error("boom");
			}),
		);

		await dispatcher.enqueue(map.clean);

		await expect(consume(queue, (batch) => dispatcher.queue(batch))).rejects.toThrow("boom");
		expect(ofKind("job")[0]).toMatchObject({
			"job.ending": "failed",
			outcome: "error",
			"error.message": "boom",
		});
	});

	test("refuses a handler written for a different job", async () => {
		let { queue, map, send, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ send, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.watched, () => {}),
		);

		await dispatcher.enqueue(map.clean);

		await expect(consume(queue, (batch) => dispatcher.queue(batch))).rejects.toThrow(
			/mapped to a handler written for/,
		);
		expect(ofKind("job")[0]).toMatchObject({ "job.ending": "failed", outcome: "error" });
	});
});
