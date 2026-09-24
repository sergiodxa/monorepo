/**
 * Exercises trace propagation through jobs: the envelope carrying the enqueuing invocation's
 * trace, a delivered job continuing it as `ctx.trace` and on its log, a cron tick and a queue
 * batch each starting a root, and an envelope from before tracing still dispatching.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageBatch, Queue } from "@cloudflare/workers-types";
import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { TraceContext } from "@sdxc/trace-context";

import { createQueue } from "@sdxc/cloudflare-mocks";
import { createLogger } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";
import { currentTrace, runWithTrace, startTrace, toTraceParent } from "@sdxc/trace-context";
import { parse as parseTraceState } from "@sdxc/trace-context/tracestate";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import * as cloudflare from "./adapters/cloudflare.js";

import {
	createJobContext,
	createJobDispatcher,
	createJobHandler,
	job,
	jobs,
	messageBody,
} from "./index.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";
const TRACEPARENT = `00-${TRACE_ID}-${PARENT_ID}-01`;

/** A map, a recording queue binding, and a logger whose records are collected. */
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
	let ofKind = (kind: string) => records.filter((record) => record.kind === kind);
	return { binding, queue, logger, map, ofKind };
}

/** Delivers everything pending to the dispatcher, as the worker's `queue` handler would. */
function consume(
	binding: QueueMock<unknown>,
	handler: (batch: MessageBatch<unknown>) => Promise<void>,
) {
	return binding.consume((batch) => handler(batch as MessageBatch<unknown>));
}

describe("the envelope", () => {
	test("carries the current trace, naming the enqueuing span as parent", () => {
		let map = jobs({ checkHttp: job({ input: s.object({ monitorId: s.string() }) }) });
		let trace = startTrace({ state: unwrap(parseTraceState("rojo=1")) });

		let body = runWithTrace(trace, () => messageBody(map.checkHttp, { monitorId: "m1" }));

		expect(body).toEqual({
			job: "checkHttp",
			body: { monitorId: "m1" },
			traceparent: toTraceParent(trace),
			tracestate: "rojo=1",
		});
	});

	test("leaves both trace members out outside an invocation, and tracestate for an empty state", () => {
		let map = jobs({ clean: job() });
		expect(messageBody(map.clean)).toEqual({ job: "clean" });

		let trace = startTrace();
		expect(runWithTrace(trace, () => messageBody(map.clean))).toEqual({
			job: "clean",
			traceparent: toTraceParent(trace),
		});
	});

	test("enqueue() writes the trace of the invocation it runs in", async () => {
		let { binding, queue, map } = setup();
		let dispatcher = createJobDispatcher({ queue });
		let trace = startTrace();

		await runWithTrace(trace, () => dispatcher.enqueueMany(map.checkHttp, [{ monitorId: "a" }]));

		expect(binding.messages.map((message) => message.body)).toEqual([
			{ job: "checkHttp", body: { monitorId: "a" }, traceparent: toTraceParent(trace) },
		]);
	});
});

describe("a delivered job", () => {
	test("continues the envelope's trace as ctx.trace, binds it, and stamps its log", async () => {
		let { logger, map, ofKind } = setup();
		let seen: { trace?: TraceContext; current?: TraceContext } = {};

		let dispatcher = createJobDispatcher({ logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => {
				seen = { trace: ctx.trace, current: currentTrace() };
			}),
		);

		await dispatcher.deliverBatch(
			[
				{
					id: "message-1",
					attempts: 1,
					body: { job: "clean", traceparent: TRACEPARENT, tracestate: "rojo=1" },
				},
			],
			{ apply: () => {} },
		);

		expect(seen.trace).toMatchObject({ traceId: TRACE_ID, parentSpanId: PARENT_ID });
		expect(seen.current).toBe(seen.trace);
		expect([...(seen.trace?.state.entries() ?? [])]).toEqual([["rojo", "1"]]);
		expect(ofKind("job")[0]).toMatchObject({
			trace_id: TRACE_ID,
			span_id: seen.trace?.spanId,
			parent_span_id: PARENT_ID,
			trace_flags: "01",
		});
	});

	test("starts a trace for an envelope written before tracing, and still dispatches it", async () => {
		let { logger, map, ofKind } = setup();
		let seen: TraceContext | undefined;

		let dispatcher = createJobDispatcher({ logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, (ctx) => {
				seen = ctx.trace;
			}),
		);

		let settlements: unknown[] = [];
		await dispatcher.deliverBatch(
			[{ id: "message-1", attempts: 1, body: { job: "checkHttp", body: { monitorId: "m1" } } }],
			{ apply: (_, settlement) => void settlements.push(settlement) },
		);

		expect(settlements).toEqual([{ type: "ack" }]);
		expect(seen?.parentSpanId).toBeNull();
		expect(ofKind("job")[0]?.trace_id).toBe(seen?.traceId);
		expect(ofKind("job")[0]).not.toHaveProperty("parent_span_id");
	});

	test("starts a trace for an invalid traceparent and ignores its tracestate", async () => {
		let { map } = setup();
		let seen: TraceContext | undefined;

		let dispatcher = createJobDispatcher();
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, (ctx) => {
				seen = ctx.trace;
			}),
		);

		await dispatcher.deliver({
			id: "message-1",
			attempts: 1,
			body: { job: "clean", traceparent: "garbage", tracestate: "rojo=1" },
		});

		expect(seen?.parentSpanId).toBeNull();
		expect(seen?.state.size).toBe(0);
	});

	test("hands its own span to the jobs it enqueues", async () => {
		let { binding, queue, map } = setup();
		let parent: TraceContext | undefined;

		let dispatcher = createJobDispatcher({ queue });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, async (ctx) => {
				parent = ctx.trace;
				await dispatcher.enqueue(map.sweep);
			}),
		);

		await dispatcher.deliver({
			id: "message-1",
			attempts: 1,
			body: { job: "clean", traceparent: TRACEPARENT },
		});

		expect(binding.messages.map((message) => message.body)).toEqual([
			{ job: "sweep", traceparent: `00-${TRACE_ID}-${parent?.spanId}-01` },
		]);
	});
});

describe("roots", () => {
	test("one tick's jobs share the trace the cron log starts", async () => {
		let { binding, queue, logger, map, ofKind } = setup();
		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.clean,
			createJobHandler(map.clean, () => {}),
		);
		dispatcher.map(
			map.sweep,
			createJobHandler(map.sweep, () => {}),
		);

		await dispatcher.tick({ now: new Date(0), only: "0 0 * * *" });

		let cron = ofKind("cron")[0];
		expect(cron?.trace_id).toMatch(/^[0-9a-f]{32}$/);
		expect(cron).not.toHaveProperty("parent_span_id");
		let expected = `00-${String(cron?.trace_id)}-${String(cron?.span_id)}-03`;
		expect(binding.messages.map((message) => message.body)).toEqual([
			{ job: "clean", traceparent: expected },
			{ job: "sweep", traceparent: expected },
		]);
		expect(currentTrace()).toBeUndefined();
	});

	test("a queue batch starts its own root, and each job continues its envelope's trace", async () => {
		let { binding, queue, logger, map, ofKind } = setup();
		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			map.checkHttp,
			createJobHandler(map.checkHttp, () => {}),
		);

		await runWithTrace(startTrace(), () => dispatcher.enqueue(map.checkHttp, { monitorId: "m1" }));
		let enqueued = binding.messages[0]?.body as { traceparent: string };
		await consume(binding, (batch) => cloudflare.worker(dispatcher).queue(batch));

		let batch = ofKind("queue")[0];
		let run = ofKind("job")[0];
		expect(batch?.trace_id).toMatch(/^[0-9a-f]{32}$/);
		expect(batch).not.toHaveProperty("parent_span_id");
		expect(run?.trace_id).toBe(enqueued.traceparent.slice(3, 35));
		expect(run?.trace_id).not.toBe(batch?.trace_id);
	});
});

describe("JobContext", () => {
	test("takes the trace it is handed, or the current one, or starts one", () => {
		let map = jobs({ clean: job() });
		let handed = startTrace();
		let bound = startTrace();

		expect(createJobContext(map.clean, { id: "1", attempts: 1, trace: handed }).trace).toBe(handed);
		expect(
			runWithTrace(bound, () => createJobContext(map.clean, { id: "1", attempts: 1 }).trace),
		).toBe(bound);
		expect(createJobContext(map.clean, { id: "1", attempts: 1 }).trace.parentSpanId).toBeNull();
	});
});
