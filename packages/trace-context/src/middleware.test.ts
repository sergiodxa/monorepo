/**
 * Tests for the router middleware: `trace()` continues the trace a request arrives with or
 * starts one, publishes it as `ctx.trace`, binds it for `currentTrace()`, stamps the request's
 * log, joins a trace a host already bound, and restarts when `accept` refuses the caller's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { TraceContext } from "./context.js";

import { startTrace } from "./context.js";
import { currentTrace, runWithTrace } from "./current.js";
import { CurrentTrace, trace } from "./middleware.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";
const TRACEPARENT = `00-${TRACE_ID}-${PARENT_ID}-01`;

/** A logger whose records land in an array the test reads. */
function collectingLogger() {
	let records: Record<string, unknown>[] = [];
	let logger = createLogger({ service: "test", sink: (record) => void records.push(record) });
	return { logger, records };
}

describe("trace middleware", () => {
	test("continues the caller's trace, publishes ctx.trace, binds it, and stamps the log", async () => {
		let { logger, records } = collectingLogger();
		let router = createRouter({ middleware: [log(logger), trace()] });
		let seen: { published?: TraceContext; current?: TraceContext; keyed?: TraceContext } = {};
		router.get("/", (ctx) => {
			seen = { published: ctx.trace, current: currentTrace(), keyed: ctx.get(CurrentTrace) };
			return new Response("ok");
		});

		await router.fetch(
			new Request("https://example.com/", { headers: { traceparent: TRACEPARENT } }),
		);

		expect(seen.published).toMatchObject({ traceId: TRACE_ID, parentSpanId: PARENT_ID });
		expect(seen.current).toBe(seen.published);
		expect(seen.keyed).toBe(seen.published);
		expect(records[0]).toMatchObject({
			kind: "request",
			trace_id: TRACE_ID,
			span_id: seen.published?.spanId,
			parent_span_id: PARENT_ID,
			trace_flags: "01",
		});
	});

	test("starts a trace for a request that carries none, leaving parent_span_id off the log", async () => {
		let { logger, records } = collectingLogger();
		let router = createRouter({ middleware: [log(logger), trace()] });
		router.get("/", () => new Response("ok"));

		await router.fetch(new Request("https://example.com/"));

		expect(records[0]?.trace_id).toMatch(/^[0-9a-f]{32}$/);
		expect(records[0]).not.toHaveProperty("parent_span_id");
		expect(currentTrace()).toBeUndefined();
	});

	test("joins a trace a host already bound", async () => {
		let bound = startTrace();
		let router = createRouter({ middleware: [trace()] });
		let published: TraceContext | undefined;
		router.get("/", (ctx) => {
			published = ctx.trace;
			return new Response("ok");
		});

		await runWithTrace(bound, () =>
			router.fetch(new Request("https://example.com/", { headers: { traceparent: TRACEPARENT } })),
		);

		expect(published).toBe(bound);
	});

	test("starts a new trace when accept refuses the caller's, and notes the dropped header", async () => {
		let { logger, records } = collectingLogger();
		let router = createRouter({ middleware: [log(logger), trace({ accept: () => false })] });
		let published: TraceContext | undefined;
		router.get("/", (ctx) => {
			published = ctx.trace;
			return new Response("ok");
		});

		await router.fetch(
			new Request("https://example.com/", { headers: { traceparent: TRACEPARENT } }),
		);

		expect(published?.traceId).not.toBe(TRACE_ID);
		expect(published?.parentSpanId).toBeNull();
		expect(records[0]?.notes).toEqual([
			expect.objectContaining({ name: "trace.rejected", traceparent: TRACEPARENT }),
		]);
	});

	test("works without a log", async () => {
		let router = createRouter({ middleware: [trace()] });
		router.get("/", (ctx) => new Response(ctx.trace.traceId));

		let response = await router.fetch(
			new Request("https://example.com/", { headers: { traceparent: TRACEPARENT } }),
		);

		expect(await response.text()).toBe(TRACE_ID);
	});
});
