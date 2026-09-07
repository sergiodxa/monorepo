/**
 * Exercises the dispatcher against a recording queue: what it dispatches, what it
 * refuses, what its middleware installs, how a delivery is settled, the cron trigger
 * that enqueues without running anything, and the cron, queue, and job logs each of
 * those emits through the logger it was configured with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageBatch, Queue } from "@cloudflare/workers-types";
import type { QueueMock } from "@sdxc/cloudflare-mocks";

import { createQueue } from "@sdxc/cloudflare-mocks";
import { createLogger } from "@sdxc/logger";
import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";
import { afterEach, describe, expect, test, vi } from "vitest";

import * as cloudflare from "./adapters/cloudflare.js";

import type { AnyJobContext, JobDispatcherContext, JobMiddleware } from "./index.js";

import { createJobDispatcher, createJobHandler, job, jobs, JobQueueError } from "./index.js";

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Builds a map whose sends land in a recording queue binding, and a logger whose records are collected. */
function setup() {
	let binding = createQueue({ name: "ping" }) as QueueMock<unknown>;
	let queue = cloudflare.queue(() => binding as unknown as Queue);
	let records: Record<string, unknown>[] = [];
	let logger = createLogger({ service: "test", sink: (record) => void records.push(record) });

	let map = jobs({
		clean: job({ cron: "0 0 * * *" }),
		sweep: job({ cron: "0 0 * * *" }),
		checkHttp: job({ input: s.object({ monitorId: s.string() }) }),
	});

	/** The records of one kind, in the order they were emitted. */
	let ofKind = (kind: string) => records.filter((record) => record.kind === kind);

	return { binding, queue, map, logger, records, ofKind };
}

/** Delivers everything pending to the dispatcher, as the worker's `queue` handler would. */
function consume(
	binding: QueueMock<unknown>,
	handler: (batch: MessageBatch<unknown>) => Promise<void>,
) {
	return binding.consume((batch) => handler(batch as MessageBatch<unknown>));
}

describe("queue()", () => {
	test("runs the handler the message names", async () => {
		let { binding, queue, map, logger } = setup();
		let seen: string[] = [];

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, (ctx) => void seen.push(ctx.input.monitorId)),
		);

		await dispatcher.enqueue(map.checkHttp, { monitorId: "m1" });
		let result = await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(seen).toEqual(["m1"]);
		expect(result.acked).toHaveLength(1);
	});

	test("refuses a body naming no mapped job, forwarding it wrapped", async () => {
		let { binding, logger } = setup();
		let onInvalid = vi.fn();

		let dispatcher = createJobDispatcher({ onInvalid, logger });

		await binding.send({ type: "nobodyHome" });
		let result = await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(onInvalid).toHaveBeenCalledTimes(1);
		expect(onInvalid.mock.calls[0]?.[1]).toEqual({ invalid: { type: "nobodyHome" } });
		expect(result.acked).toHaveLength(1);
	});

	test("refuses a body that fails the job's schema without loading its handler", async () => {
		let { binding, queue, map, logger } = setup();
		let load = vi.fn(async () => ({
			default: createJobHandler(map.checkHttp, () => {}),
		}));

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(map.checkHttp, load);

		await binding.send({ type: "checkHttp", monitorId: 42 });
		let result = await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(load).not.toHaveBeenCalled();
		expect(result.acked).toHaveLength(1);
	});

	test("loads a handler once and reuses it", async () => {
		let { binding, queue, map, logger } = setup();
		let load = vi.fn(async () => ({ default: createJobHandler(map.clean, () => {}) }));

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(map.clean, load);

		await dispatcher.enqueue(map.clean);
		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(load).toHaveBeenCalledTimes(1);
	});

	test("retries a message whose handler asked to be retried", async () => {
		let { binding, queue, map, logger } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.retry()),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(result.retried).toHaveLength(1);
		expect(result.acked).toHaveLength(0);
	});

	test("acks a message whose handler gave up for good", async () => {
		let { binding, queue, map, logger } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.exit("never")),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(result.acked).toHaveLength(1);
		expect(result.retried).toHaveLength(0);
	});

	test("acks a delivery the handler finished early", async () => {
		let { binding, queue, map, logger } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.ack()),
		);

		await dispatcher.enqueue(map.clean);
		let result = await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(result.acked).toHaveLength(1);
	});

	test("tells the batch how many messages share the invocation", async () => {
		let { binding, queue, map, logger } = setup();
		let sizes: number[] = [];

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, (ctx) => void sizes.push(ctx.batchSize)),
		);

		await dispatcher.enqueueMany(map.checkHttp, [{ monitorId: "a" }, { monitorId: "b" }]);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(sizes).toEqual([2, 2]);
	});
});

describe("the queue log", () => {
	test("records the batch, carrying the worker's configuration", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, () => {}),
		);

		await dispatcher.enqueueMany(map.checkHttp, [{ monitorId: "a" }, { monitorId: "b" }]);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("queue")).toHaveLength(1);
		expect(ofKind("queue")[0]).toMatchObject({
			service: "test",
			kind: "queue",
			"queue.name": "ping",
			"queue.batch_size": 2,
			"job.count": 2,
			"jobs.done": 2,
			outcome: "ok",
		});
		expect(ofKind("queue")[0]).toHaveProperty("duration_ms");
	});

	test("counts every ending, and degrades when one of them was not ok", async () => {
		let { binding, queue, logger, ofKind } = setup();
		let map = jobs({
			done: job(),
			retried: job(),
			refused: job(),
			acked: job(),
		});

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.done,
			createJobHandler(map.done, () => {}),
		);
		dispatcher.map(
			map.retried,
			createJobHandler(map.retried, (ctx) => ctx.retry()),
		);
		dispatcher.map(
			map.refused,
			createJobHandler(map.refused, (ctx) => ctx.exit("never")),
		);
		dispatcher.map(
			map.acked,
			createJobHandler(map.acked, (ctx) => ctx.ack()),
		);

		await dispatcher.enqueue(map.done);
		await dispatcher.enqueue(map.retried);
		await dispatcher.enqueue(map.refused);
		await dispatcher.enqueue(map.acked);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("queue")[0]).toMatchObject({
			"queue.batch_size": 4,
			"job.count": 4,
			"jobs.done": 2,
			"jobs.retried": 1,
			"jobs.refused": 1,
			outcome: "degraded",
		});
	});

	test("fails when a job threw something that is none of the endings", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {
				throw new Error("boom");
			}),
		);

		await dispatcher.enqueue(map.clean);
		await expect(
			consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch)),
		).rejects.toThrow("boom");

		expect(ofKind("queue")[0]).toMatchObject({
			"jobs.failed": 1,
			outcome: "error",
			"error.type": "Error",
			"error.message": "boom",
		});
	});
});

describe("the job log", () => {
	test("emits one per message, naming the job and the delivery", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, () => {}),
		);

		await dispatcher.enqueueMany(map.checkHttp, [{ monitorId: "a" }, { monitorId: "b" }]);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		let logs = ofKind("job");

		expect(logs).toHaveLength(2);
		expect(logs[0]).toMatchObject({
			service: "test",
			kind: "job",
			"job.name": "checkHttp",
			"job.attempts": 1,
			"job.batch_size": 2,
			"job.ending": "done",
			outcome: "ok",
		});
		expect(logs[0]).toHaveProperty("job.id", expect.any(String));
		expect(logs[0]).not.toHaveProperty("job.cron");
	});

	test("records the schedule of a job that declares one", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({ "job.name": "clean", "job.cron": "0 0 * * *" });
	});

	test("ends done and ok when the handler acked early", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.ack()),
		);

		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({ "job.ending": "done", outcome: "ok" });
	});

	test("ends retry and degraded, noting why, when the handler asked for another delivery", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.retry({ reason: "Rate limited" })),
		);

		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({
			"job.ending": "retry",
			outcome: "degraded",
			notes: [
				expect.objectContaining({ level: "warn", name: "job.retry", reason: "Rate limited" }),
			],
		});
		expect(ofKind("job")[0]).not.toHaveProperty("job.delay_s");
	});

	test("records the delay a retry asked for, in seconds", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.retry({ delay: "5 minutes" })),
		);

		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({ "job.ending": "retry", "job.delay_s": 300 });
	});

	test("ends refuse and error, carrying the cause, when the handler gave up for good", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) =>
				ctx.exit("Team no longer exists", { cause: new RangeError("row is gone") }),
			),
		);

		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({
			"job.ending": "refuse",
			outcome: "error",
			"error.type": "Job.NonRetriable",
			"error.message": "Team no longer exists",
			"error.cause_type": "RangeError",
			"error.cause_message": "row is gone",
		});
	});

	test("ends failed and error, then rethrows, for anything else thrown", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {
				throw new TypeError("boom");
			}),
		);

		await dispatcher.enqueue(map.clean);
		await expect(
			consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch)),
		).rejects.toThrow("boom");

		expect(ofKind("job")[0]).toMatchObject({
			"job.ending": "failed",
			outcome: "error",
			"error.type": "TypeError",
			"error.message": "boom",
		});
		expect(ofKind("job")[0]).toHaveProperty("error.stack");
	});

	test("is the handler's `ctx.log`, so what it sets is on the record", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, (ctx) => {
				ctx.log.set({ monitor: { id: ctx.input.monitorId } });
				ctx.log.note("check.started");
			}),
		);

		await dispatcher.enqueue(map.checkHttp, { monitorId: "m1" });
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({
			"monitor.id": "m1",
			notes: [expect.objectContaining({ name: "check.started" })],
		});
	});

	test("records a message naming no mapped job as a refused job", async () => {
		let { binding, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ logger });

		await binding.send({ type: "nobodyHome" });
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({
			"job.name": "nobodyHome",
			"job.attempts": 1,
			"job.ending": "refused",
			"job.refusal": "unknown-job",
			"job.body": '{"type":"nobodyHome"}',
			outcome: "error",
			"error.type": "Job.Refused",
		});
		expect(ofKind("queue")[0]).toMatchObject({ "jobs.refused": 1, outcome: "degraded" });
	});

	test("records a message failing its job's schema as a refused job", async () => {
		let { binding, queue, map, logger, ofKind } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, () => {}),
		);

		await binding.send({ type: "checkHttp", monitorId: 42 });
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(ofKind("job")[0]).toMatchObject({
			"job.name": "checkHttp",
			"job.ending": "refused",
			"job.refusal": "invalid-input",
			outcome: "error",
		});
	});

	test("writes bare records to the console when the dispatcher has no logger", async () => {
		let { binding, queue, map } = setup();
		let consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
		let consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

		let dispatcher = createJobDispatcher({ queue });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(consoleLog).toHaveBeenCalledTimes(2);
		expect(consoleWarn).not.toHaveBeenCalled();
		expect(consoleLog.mock.calls[0]?.[0]).toMatchObject({ kind: "job", "job.ending": "done" });
		expect(consoleLog.mock.calls[0]?.[0]).not.toHaveProperty("service");
		expect(consoleLog.mock.calls[1]?.[0]).toMatchObject({ kind: "queue", "jobs.done": 1 });
	});
});

describe("maxAttempts", () => {
	/** A queue whose retries are this package's to count, which is what enables the ceiling. */
	function counted() {
		return { retries: "core" as const, send: () => Promise.resolve(success(undefined)) };
	}

	test("dead-letters a delivery that has spent the attempts allowed", async () => {
		let { map } = setup();
		let ran = vi.fn();

		let dispatcher = createJobDispatcher({ queue: counted(), maxAttempts: 3 });
		dispatcher.map(map.clean, createJobHandler(map.clean, ran));

		let settlement = await dispatcher.deliver({
			id: "message-1",
			attempts: 4,
			body: { job: "clean" },
		});

		expect(settlement).toEqual({ type: "dead-letter", reason: "retries_exhausted" });
		expect(ran).not.toHaveBeenCalled();
	});

	test("runs a delivery still inside the ceiling", async () => {
		let { map } = setup();
		let ran = vi.fn();

		let dispatcher = createJobDispatcher({ queue: counted(), maxAttempts: 3 });
		dispatcher.map(map.clean, createJobHandler(map.clean, ran));

		let settlement = await dispatcher.deliver({
			id: "message-1",
			attempts: 3,
			body: { job: "clean" },
		});

		expect(settlement).toEqual({ type: "ack" });
		expect(ran).toHaveBeenCalledTimes(1);
	});

	test("counts nothing for a queue that owns its own retries, whatever the ceiling says", async () => {
		let { queue, map } = setup();
		let ran = vi.fn();

		let dispatcher = createJobDispatcher({ queue, maxAttempts: 1 });
		dispatcher.map(map.clean, createJobHandler(map.clean, ran));

		let settlement = await dispatcher.deliver({
			id: "message-1",
			attempts: 99,
			body: { job: "clean" },
		});

		expect(settlement).toEqual({ type: "ack" });
		expect(ran).toHaveBeenCalledTimes(1);
	});

	test("counts nothing when no ceiling is declared", async () => {
		let { map } = setup();
		let ran = vi.fn();

		let dispatcher = createJobDispatcher({ queue: counted() });
		dispatcher.map(map.clean, createJobHandler(map.clean, ran));

		await dispatcher.deliver({ id: "message-1", attempts: 99, body: { job: "clean" } });

		expect(ran).toHaveBeenCalledTimes(1);
	});
});

describe("deliver()", () => {
	test("answers with the settlement a completed run asks for", async () => {
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher({ queue });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, () => undefined),
		);

		let settlement = await dispatcher.deliver({
			id: "message-1",
			attempts: 1,
			body: { job: "checkHttp", body: { monitorId: "m1" } },
		});

		expect(settlement).toEqual({ type: "ack" });
	});

	test("answers with the delay a retrying job asked to be held for", async () => {
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher({ queue });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => ctx.retry({ delay: "5 minutes" })),
		);

		let settlement = await dispatcher.deliver({
			id: "message-1",
			attempts: 1,
			body: { job: "clean" },
		});

		expect(settlement).toEqual({ type: "retry", delay: "5 minutes" });
	});

	test("dead-letters a body naming no mapped job", async () => {
		let { queue } = setup();
		let dispatcher = createJobDispatcher({ queue });

		let settlement = await dispatcher.deliver({
			id: "message-1",
			attempts: 1,
			body: { job: "nobodyHome" },
		});

		expect(settlement).toEqual({ type: "dead-letter", reason: "invalid_message" });
	});

	test("runs a flat body enqueued before the envelope", async () => {
		let { queue, map } = setup();
		let seen: string[] = [];

		let dispatcher = createJobDispatcher({ queue });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, (ctx) => void seen.push(ctx.input.monitorId)),
		);

		let settlement = await dispatcher.deliver({
			id: "message-1",
			attempts: 1,
			body: { type: "checkHttp", monitorId: "m1" },
		});

		expect(seen).toEqual(["m1"]);
		expect(settlement).toEqual({ type: "ack" });
	});

	test("hands the handler a payload declaring a reserved key of its own", async () => {
		let { queue } = setup();
		let shadowed = jobs({ clean: job({ input: s.object({ job: s.string() }) }) });
		let seen: string[] = [];

		let dispatcher = createJobDispatcher({ queue });
		dispatcher.map(
			shadowed.clean,
			createJobHandler(shadowed.clean, (ctx) => void seen.push(ctx.input.job)),
		);

		await dispatcher.deliver({
			id: "message-1",
			attempts: 1,
			body: { job: "clean", body: { job: "somethingElse" } },
		});

		expect(seen).toEqual(["somethingElse"]);
	});
});

describe("enqueue()", () => {
	test("writes the payload under the job's name", async () => {
		let { binding, queue, map } = setup();
		let dispatcher = createJobDispatcher({ queue });

		await dispatcher.enqueue(map.checkHttp, { monitorId: "m1" });

		expect(binding.messages.map((message) => message.body)).toEqual([
			{ job: "checkHttp", body: { monitorId: "m1" } },
		]);
	});

	test("writes only the name for a job that declares no payload", async () => {
		let { binding, queue, map } = setup();
		let dispatcher = createJobDispatcher({ queue });

		await dispatcher.enqueue(map.clean);

		expect(binding.messages.map((message) => message.body)).toEqual([{ job: "clean" }]);
	});

	test("carries a payload declaring a reserved key of its own", async () => {
		let { binding, queue } = setup();
		let dispatcher = createJobDispatcher({ queue });
		let shadowed = jobs({ clean: job({ input: s.object({ job: s.string(), type: s.string() }) }) });

		await dispatcher.enqueue(shadowed.clean, { job: "somethingElse", type: "somethingElse" });

		expect(binding.messages.map((message) => message.body)).toEqual([
			{ job: "clean", body: { job: "somethingElse", type: "somethingElse" } },
		]);
	});

	test("turns many payloads into one write", async () => {
		let { binding, queue, map } = setup();
		let dispatcher = createJobDispatcher({ queue });

		await dispatcher.enqueueMany(map.checkHttp, [{ monitorId: "a" }, { monitorId: "b" }]);

		expect(binding.sent).toHaveLength(2);
		expect(binding.messages.map((message) => message.body)).toEqual([
			{ job: "checkHttp", body: { monitorId: "a" } },
			{ job: "checkHttp", body: { monitorId: "b" } },
		]);
	});

	test("writes nothing when there is nothing to enqueue", async () => {
		let { binding, queue, map } = setup();
		let dispatcher = createJobDispatcher({ queue });

		await dispatcher.enqueueMany(map.checkHttp, []);

		expect(binding.sent).toHaveLength(0);
	});
});

describe("middleware", () => {
	test("installs a property the handler reads", async () => {
		let { binding, queue, map, logger } = setup();
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

		let dispatcher = createJobDispatcher({ queue, logger, middleware: [database()] });
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
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(seen).toEqual(["live"]);
	});

	test("installs every property of a long chain, and lets a later link read an earlier one", async () => {
		let { binding, queue, map, logger } = setup();
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
			queue,
			logger,
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
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		expect(seen).toEqual(["1-4"]);
	});

	test("runs in the order declared, around the handler", async () => {
		let { binding, queue, map, logger } = setup();
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

		let dispatcher = createJobDispatcher({ queue, logger, middleware: [first, second] });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => void order.push("handler")),
		);

		await dispatcher.enqueue(map.clean);
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

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
		let { binding, queue, map, logger } = setup();
		let ran = vi.fn();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(map.clean, createJobHandler(map.clean, ran));
		dispatcher.map(map.sweep, createJobHandler(map.sweep, ran));

		await dispatcher.tick({ now: new Date(0), only: "0 0 * * *" });

		expect(ran).not.toHaveBeenCalled();
		expect(binding.messages.map((message) => message.body)).toEqual([
			{ job: "clean" },
			{ job: "sweep" },
		]);
	});

	test("enqueues nothing for a cron no job declares", async () => {
		let { binding, queue, map, logger } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await dispatcher.tick({ now: new Date(0), only: "*/5 * * * *" });

		expect(binding.messages).toHaveLength(0);
	});

	test("records the trigger and how many jobs it enqueued", async () => {
		let { queue, map, logger, records } = setup();

		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);
		dispatcher.map(
			map.sweep,
			createJobHandler(map.sweep, () => {}),
		);

		await cloudflare.worker(dispatcher).scheduled({
			cron: "0 0 * * *",
			scheduledTime: 1_700_000_000_000,
			noRetry() {},
		});

		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			service: "test",
			kind: "cron",
			"cron.expression": "0 0 * * *",
			"cron.scheduled_at": 1_700_000_000_000,
			"jobs.enqueued": 2,
			outcome: "ok",
		});
	});

	test("fails the cron log when the queue write throws", async () => {
		let { map, logger, records } = setup();

		let dispatcher = createJobDispatcher({
			logger,
			queue: {
				retries: "backend",
				send: async () => failure(new JobQueueError("queue is full", { code: "unavailable" })),
			},
		});
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);

		await expect(dispatcher.tick({ now: new Date(0), only: "0 0 * * *" })).rejects.toThrow(
			"queue is full",
		);

		expect(records[0]).toMatchObject({
			kind: "cron",
			outcome: "error",
			"error.message": "queue is full",
		});
		expect(records[0]).not.toHaveProperty("jobs.enqueued");
	});

	test("reports every job that has a handler, so a map can be checked against it", () => {
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher({ queue });
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
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher({ queue });
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
		let { queue, map } = setup();

		let dispatcher = createJobDispatcher({ queue });
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
