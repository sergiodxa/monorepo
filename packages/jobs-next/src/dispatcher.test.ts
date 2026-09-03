/**
 * Exercises the dispatcher against a recording queue: what it dispatches, what it
 * refuses, what its middleware installs, how a delivery is settled, and the
 * cron trigger that enqueues without running anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageBatch } from "@cloudflare/workers-types";
import type { QueueMock } from "@pkg/cloudflare-mocks";

import { createQueue } from "@pkg/cloudflare-mocks";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { JobMiddleware, JobDispatcherContext } from "./index";

import {
	createJobHandler,
	createJobDispatcher,
	job,
	jobs,
	NonRetriableError,
	RetryError,
} from "./index";

let consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
let consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
	consoleInfo.mockClear();
	consoleError.mockClear();
});

afterEach(() => {
	vi.useRealTimers();
});

/** Builds a map whose sends land in a recording queue binding. */
function setup() {
	let queue = createQueue({ name: "ping" }) as QueueMock<unknown>;

	let map = jobs(
		{
			clean: job({ cron: "0 0 * * *" }),
			sweep: job({ cron: "0 0 * * *" }),
			checkHttp: job({ input: s.object({ monitorId: s.string() }) }),
		},
		{ send: async (bodies) => void (await queue.sendBatch(bodies.map((body) => ({ body })))) },
	);

	return { queue, map };
}

/** Delivers everything pending to the dispatcher, as the worker's `queue` handler would. */
function consume(
	queue: QueueMock<unknown>,
	handler: (batch: MessageBatch<unknown>) => Promise<void>,
) {
	return queue.consume((batch) => handler(batch as MessageBatch<unknown>));
}

describe("queue()", () => {
	test("runs the handler the message names", async () => {
		let { queue, map } = setup();
		let seen: string[] = [];

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, ({ input }) => void seen.push(input.monitorId)),
		);

		await map.checkHttp.enqueue({ monitorId: "m1" });
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(seen).toEqual(["m1"]);
		expect(result.acked).toHaveLength(1);
	});

	test("refuses a body naming no mapped job, forwarding it wrapped", async () => {
		let { queue } = setup();
		let onInvalid = vi.fn();

		let dispatcher = createJobDispatcher({ onInvalid });

		await queue.send({ type: "nobodyHome" });
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(onInvalid).toHaveBeenCalledTimes(1);
		expect(onInvalid.mock.calls[0]?.[1]).toEqual({ invalid: { type: "nobodyHome" } });
		expect(result.acked).toHaveLength(1);
	});

	test("refuses a body that fails the job's schema without loading its handler", async () => {
		let { queue, map } = setup();
		let load = vi.fn(async () => ({
			default: createJobHandler(map.checkHttp, () => {}),
		}));

		let dispatcher = createJobDispatcher();
		dispatcher.map(map.checkHttp, load);

		await queue.send({ type: "checkHttp", monitorId: 42 });
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(load).not.toHaveBeenCalled();
		expect(result.acked).toHaveLength(1);
	});

	test("loads a handler once and reuses it", async () => {
		let { queue, map } = setup();
		let load = vi.fn(async () => ({ default: createJobHandler(map.clean, () => {}) }));

		let dispatcher = createJobDispatcher();
		dispatcher.map(map.clean, load);

		await map.clean.enqueue();
		await map.clean.enqueue();
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(load).toHaveBeenCalledTimes(1);
	});

	test("retries a message whose handler throws RetryError", async () => {
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {
				throw new RetryError("later");
			}),
		);

		await map.clean.enqueue();
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.retried).toHaveLength(1);
		expect(result.acked).toHaveLength(0);
	});

	test("acks a message whose handler throws NonRetriableError", async () => {
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {
				throw new NonRetriableError("never");
			}),
		);

		await map.clean.enqueue();
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(result.retried).toHaveLength(0);
	});

	test("settles a delivery the handler retried itself", async () => {
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, ({ retry }) => retry()),
		);

		await map.clean.enqueue();
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.retried).toHaveLength(1);
	});

	test("tells the batch how many messages share the invocation", async () => {
		let { queue, map } = setup();
		let sizes: number[] = [];

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, ({ batchSize }) => void sizes.push(batchSize)),
		);

		await map.checkHttp.enqueueMany([{ monitorId: "a" }, { monitorId: "b" }]);
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(sizes).toEqual([2, 2]);
	});
});

describe("middleware", () => {
	test("installs a property the handler reads", async () => {
		let { queue, map } = setup();
		let Database = createContextKey<{ label: string }>();

		function database(): JobMiddleware<{
			key: typeof Database;
			value: { label: string };
			property: "database";
		}> {
			return async (ctx, next) => {
				ctx.set(Database, { label: "live" }, { property: "database" });
				await next();
			};
		}

		let dispatcher = createJobDispatcher({ middleware: [database()] });
		let seen: string[] = [];

		type Context = JobDispatcherContext<typeof dispatcher>;

		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => {
				let context = ctx as Context;
				seen.push(context.database.label);
			}),
		);

		await map.clean.enqueue();
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(seen).toEqual(["live"]);
	});

	test("runs in the order declared, around the handler", async () => {
		let { queue, map } = setup();
		let order: string[] = [];

		let first: JobMiddleware = async (_ctx, next) => {
			order.push("first:before");
			await next();
			order.push("first:after");
		};

		let second: JobMiddleware = async (_ctx, next) => {
			order.push("second:before");
			await next();
			order.push("second:after");
		};

		let dispatcher = createJobDispatcher({ middleware: [first, second] });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => void order.push("handler")),
		);

		await map.clean.enqueue();
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(order).toEqual([
			"first:before",
			"second:before",
			"handler",
			"second:after",
			"first:after",
		]);
	});
});

describe("scheduled()", () => {
	test("enqueues every job on that cron in one write, running none", async () => {
		let { queue, map } = setup();
		let ran = vi.fn();

		let dispatcher = createJobDispatcher();
		dispatcher.map(map.clean, createJobHandler(map.clean, ran));
		dispatcher.map(map.sweep, createJobHandler(map.sweep, ran));

		await dispatcher.scheduled({ cron: "0 0 * * *", scheduledTime: 0, noRetry() {} });

		expect(ran).not.toHaveBeenCalled();
		expect(queue.messages.map((message) => message.body)).toEqual([
			{ type: "clean" },
			{ type: "sweep" },
		]);
	});

	test("enqueues nothing for a cron no job declares", async () => {
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await dispatcher.scheduled({ cron: "*/5 * * * *", scheduledTime: 0, noRetry() {} });

		expect(queue.messages).toHaveLength(0);
	});

	test("reports the distinct crons its mapped jobs declare", () => {
		let { map } = setup();

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);
		dispatcher.map(
			map.sweep,
			createJobHandler(map.sweep, () => {}),
		);
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, () => {}),
		);

		expect(dispatcher.crons).toEqual(["0 0 * * *"]);
	});
});

describe("map()", () => {
	test("refuses to map one name twice", () => {
		let { map } = setup();

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		expect(() =>
			dispatcher.map(
				map.clean,
				createJobHandler(map.clean, () => {}),
			),
		).toThrow(/already mapped/);
	});
});
