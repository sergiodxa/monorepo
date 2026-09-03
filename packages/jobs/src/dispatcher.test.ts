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
import type { JSONValue } from "@pkg/types";

import { createQueue } from "@pkg/cloudflare-mocks";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { AnyJobContext, JobDispatcherContext, JobMiddleware } from "./index";

import { createJobDispatcher, createJobHandler, job, jobs } from "./index";

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

	let map = jobs({
		clean: job({ cron: "0 0 * * *" }),
		sweep: job({ cron: "0 0 * * *" }),
		checkHttp: job({ input: s.object({ monitorId: s.string() }) }),
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

describe("queue()", () => {
	test("runs the handler the message names", async () => {
		let { queue, map, send } = setup();
		let seen: string[] = [];

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, (ctx) => void seen.push(ctx.input.monitorId)),
		);

		await dispatcher.enqueue(map.checkHttp, { monitorId: "m1" });
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
		let { queue, map, send } = setup();
		let load = vi.fn(async () => ({
			default: createJobHandler(map.checkHttp, () => {}),
		}));

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(map.checkHttp, load);

		await queue.send({ type: "checkHttp", monitorId: 42 });
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(load).not.toHaveBeenCalled();
		expect(result.acked).toHaveLength(1);
	});

	test("loads a handler once and reuses it", async () => {
		let { queue, map, send } = setup();
		let load = vi.fn(async () => ({ default: createJobHandler(map.clean, () => {}) }));

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(map.clean, load);

		await dispatcher.enqueue(map.clean);
		await dispatcher.enqueue(map.clean);
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(load).toHaveBeenCalledTimes(1);
	});

	test("retries a message whose handler asked to be retried", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.retry()),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.retried).toHaveLength(1);
		expect(result.acked).toHaveLength(0);
	});

	test("acks a message whose handler gave up for good", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.exit("never")),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(result.retried).toHaveLength(0);
	});

	test("acks a delivery the handler finished early", async () => {
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.ack()),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(queue, (batch) => dispatcher.queue(batch));

		expect(result.acked).toHaveLength(1);
	});

	test("tells the batch how many messages share the invocation", async () => {
		let { queue, map, send } = setup();
		let sizes: number[] = [];

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, (ctx) => void sizes.push(ctx.batchSize)),
		);

		await dispatcher.enqueueMany(map.checkHttp, [{ monitorId: "a" }, { monitorId: "b" }]);
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(sizes).toEqual([2, 2]);
	});
});

describe("enqueue()", () => {
	test("writes the payload's fields alongside the job's name", async () => {
		let { queue, map, send } = setup();
		let dispatcher = createJobDispatcher({ send });

		await dispatcher.enqueue(map.checkHttp, { monitorId: "m1" });

		expect(queue.messages.map((message) => message.body)).toEqual([
			{ type: "checkHttp", monitorId: "m1" },
		]);
	});

	test("writes only the name for a job that declares no payload", async () => {
		let { queue, map, send } = setup();
		let dispatcher = createJobDispatcher({ send });

		await dispatcher.enqueue(map.clean);

		expect(queue.messages.map((message) => message.body)).toEqual([{ type: "clean" }]);
	});

	test("keeps a payload from misrouting itself with a type of its own", async () => {
		let { queue, send } = setup();
		let dispatcher = createJobDispatcher({ send });
		let shadowed = jobs({ clean: job({ input: s.object({ type: s.string() }) }) });

		await dispatcher.enqueue(shadowed.clean, { type: "somethingElse" });

		expect(queue.messages.map((message) => message.body)).toEqual([{ type: "clean" }]);
	});

	test("turns many payloads into one write", async () => {
		let { queue, map, send } = setup();
		let dispatcher = createJobDispatcher({ send });

		await dispatcher.enqueueMany(map.checkHttp, [{ monitorId: "a" }, { monitorId: "b" }]);

		expect(queue.sent).toHaveLength(2);
		expect(queue.messages.map((message) => message.body)).toEqual([
			{ type: "checkHttp", monitorId: "a" },
			{ type: "checkHttp", monitorId: "b" },
		]);
	});

	test("writes nothing when there is nothing to enqueue", async () => {
		let { queue, map, send } = setup();
		let dispatcher = createJobDispatcher({ send });

		await dispatcher.enqueueMany(map.checkHttp, []);

		expect(queue.sent).toHaveLength(0);
	});
});

describe("middleware", () => {
	test("installs a property the handler reads", async () => {
		let { queue, map, send } = setup();
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

		let dispatcher = createJobDispatcher({ send, middleware: [database()] });
		let seen: string[] = [];

		type Context = JobDispatcherContext<typeof dispatcher>;

		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => {
				let context = ctx as Context;
				seen.push(context.database.label);
			}),
		);

		await dispatcher.enqueue(map.clean);
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(seen).toEqual(["live"]);
	});

	test("installs every property of a long chain, and lets a later link read an earlier one", async () => {
		let { queue, map, send } = setup();
		let First = createContextKey<string>();
		let Second = createContextKey<string>();
		let Third = createContextKey<string>();
		let Fourth = createContextKey<string>();

		function publish<Key extends object>(
			key: Key,
			property: string,
			value: (ctx: AnyJobContext) => string,
		) {
			return (async (ctx, next) => {
				ctx.set(key, value(ctx) as never, { property });
				await next();
			}) as JobMiddleware;
		}

		let dispatcher = createJobDispatcher({
			send,
			middleware: [
				publish(First, "first", () => "1"),
				publish(Second, "second", () => "2"),
				publish(Third, "third", () => "3"),
				/** Reads what the first link published, which is only reachable by key. */
				publish(Fourth, "fourth", (ctx) => `${ctx.require(First)}-4`),
			],
		});

		let seen: string[] = [];

		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => {
				let context = ctx as AnyJobContext;
				seen.push(context.require(Fourth));
			}),
		);

		await dispatcher.enqueue(map.clean);
		await consume(queue, (batch) => dispatcher.queue(batch));

		expect(seen).toEqual(["1-4"]);
	});

	test("runs in the order declared, around the handler", async () => {
		let { queue, map, send } = setup();
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

		let dispatcher = createJobDispatcher({ send, middleware: [first, second] });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => void order.push("handler")),
		);

		await dispatcher.enqueue(map.clean);
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
		let { queue, map, send } = setup();
		let ran = vi.fn();

		let dispatcher = createJobDispatcher({ send });
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
		let { queue, map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await dispatcher.scheduled({ cron: "*/5 * * * *", scheduledTime: 0, noRetry() {} });

		expect(queue.messages).toHaveLength(0);
	});

	test("reports every job that has a handler, so a map can be checked against it", () => {
		let { map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, () => {}),
		);

		expect(dispatcher.mapped.map((job) => job.name)).toEqual(["clean", "checkHttp"]);
		expect(dispatcher.mapped).not.toContain(map.sweep);
	});

	test("reports the distinct crons its mapped jobs declare", () => {
		let { map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
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
	test("refuses to enqueue when it was built without a queue to write to", async () => {
		let { map } = setup();

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await expect(dispatcher.enqueue(map.clean)).rejects.toThrow(/cannot enqueue/);
	});

	test("refuses to map one name twice", () => {
		let { map, send } = setup();

		let dispatcher = createJobDispatcher({ send });
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
