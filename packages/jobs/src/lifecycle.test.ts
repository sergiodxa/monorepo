/**
 * Exercises what happens around the handler: the timeout that aborts its signal
 * and stops the dispatcher waiting, the monitor ping a completed run sends, the
 * dead-letter batches the dispatcher records itself, and the errors it does not own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageBatch } from "@cloudflare/workers-types";
import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { JSONValue } from "@sdxc/types";

import { createQueue } from "@sdxc/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { createJobDispatcher, createJobHandler, job, jobs } from "./index.js";

const UPTIME_URL = "https://uptime.sergiodxa.com";
const MONITOR_ID = "monitor-1";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
let consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
	consoleInfo.mockClear();
	consoleError.mockClear();
});

afterEach(() => vi.useRealTimers());

/** Builds a map whose sends land in a recording queue binding. */
function setup() {
	let queue = createQueue({ name: "ping" }) as QueueMock<unknown>;

	let map = jobs({
		clean: job(),
		watched: job({ monitorId: MONITOR_ID }),
	});

	/** The queue write a dispatcher in these tests is built with. */
	let send = async (bodies: JSONValue[]) => {
		await queue.sendBatch(bodies.map((body) => ({ body })));
	};

	return { queue, map, send };
}

/** Delivers everything pending to the dispatcher, as the worker's `queue` handler would. */
function consume(
	queue: QueueMock<unknown>,
	handler: (batch: MessageBatch<unknown>) => Promise<void>,
) {
	return queue.consume((batch) => handler(batch as MessageBatch<unknown>));
}

/** Every event name the batched logger flushed in this test. */
function events() {
	return [...consoleInfo.mock.calls, ...consoleError.mock.calls].flatMap((call) =>
		call.flatMap((entry) => {
			if (typeof entry !== "object" || entry === null) return [];
			if (!("events" in entry) || !Array.isArray(entry.events)) return [];
			return entry.events.map((logged: { event: string }) => logged.event);
		}),
	);
}

describe("timeouts", () => {
	test("aborts the signal and stops waiting for a handler that ignores it", async () => {
		let { queue, map, send } = setup();
		let aborted = vi.fn();

		vi.useFakeTimers();

		let dispatcher = createJobDispatcher({ send, timeout: "1 second" });
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
		expect(events()).toContain("job.timed-out");
	});

	test("lets a handler that gives up settle it first", async () => {
		let { queue, map, send } = setup();

		vi.useFakeTimers();

		let dispatcher = createJobDispatcher({ send, timeout: "1 second" });
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
		expect(events()).toContain("job.timed-out");
	});

	test("reports a job that timed itself out", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send, timeout: "1 minute" });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.timeout()),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.retried).toHaveLength(1);
		expect(events()).toContain("job.timed-out");
	});

	test("waits indefinitely when no timeout is configured", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
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
		let { queue, map, send } = setup();
		let pinged = vi.fn();

		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, ({ request }) => {
				pinged(request.headers.get("Authorization"));
				return HttpResponse.json({ ok: true });
			}),
		);

		let dispatcher = createJobDispatcher({ send, uptime: () => "token-1" });
		dispatcher.map(
			map.watched,
			createJobHandler(map.watched, () => {}),
		);

		await dispatcher.enqueue(map.watched);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(pinged).toHaveBeenCalledWith("Bearer token-1");
		expect(result.acked).toHaveLength(1);
		expect(events()).toContain("job.completed");
	});

	test("skips the ping when the job names no monitor", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send, uptime: () => "token-1" });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
	});

	test("acks the message when the ping itself fails", async () => {
		let { queue, map, send } = setup();

		server.use(
			http.post(`${UPTIME_URL}/api/v1/cron-jobs/${MONITOR_ID}/ping`, () =>
				HttpResponse.text("nope", { status: 500 }),
			),
		);

		let dispatcher = createJobDispatcher({ send, uptime: () => "token-1" });
		dispatcher.map(
			map.watched,
			createJobHandler(map.watched, () => {}),
		);

		await dispatcher.enqueue(map.watched);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(events()).toContain("job.uptime-failed");
	});
});

describe("the dead-letter queue", () => {
	test("records a body the dispatcher refused, and acks it", async () => {
		let dlq = createQueue({ name: "ping-dlq" }) as QueueMock<unknown>;

		let dispatcher = createJobDispatcher({ deadLetterQueue: "ping-dlq" });

		await dlq.send({ invalid: { type: "nobodyHome" } });
		let result = await consume(dlq, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(events()).toContain("job.dead_letter.invalid_message");
	});

	test("records a body that exhausted its retries, and acks it", async () => {
		let dlq = createQueue({ name: "ping-dlq" }) as QueueMock<unknown>;

		let dispatcher = createJobDispatcher({ deadLetterQueue: "ping-dlq" });

		await dlq.send({ type: "clean" });
		let result = await consume(dlq, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(events()).toContain("job.dead_letter.retries_exhausted");
	});
});

describe("errors the package does not own", () => {
	test("re-throws so the platform retries the invocation", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {
				throw new Error("boom");
			}),
		);

		await dispatcher.enqueue(map.clean);

		await expect(consume(queue, (batch) => dispatcher.queue(batch))).rejects.toThrow("boom");
		expect(events()).toContain("job.failed");
	});

	test("refuses a handler written for a different job", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.clean,
			createJobHandler(map.watched, () => {}),
		);

		await dispatcher.enqueue(map.clean);

		await expect(consume(queue, (batch) => dispatcher.queue(batch))).rejects.toThrow(
			/mapped to a handler written for/,
		);
	});
});
