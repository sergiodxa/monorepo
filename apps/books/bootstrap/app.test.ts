/**
 * Tests that the router gives every request a trace: the request's wide event carries
 * `trace_id` and `span_id`, and a caller's `traceparent` is continued, so the record
 * joins the trace the caller started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createLogger } from "@sdxc/logger";
import { beforeEach, describe, expect, test, vi } from "vitest";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";

/** The records the router's logger wrote during the current test. */
let records: Record<string, unknown>[] = [];

/** Replaces the worker's console logger with one whose records the test reads. */
vi.doMock("./logger", () => ({
	logger: createLogger({ service: "books", sink: (record) => void records.push(record) }),
}));

let { fetchApp } = await import("~/app/lib/test/router");

beforeEach(() => {
	records = [];
});

describe("request tracing", () => {
	test("stamps a new trace on the request's log when the caller sends none", async () => {
		let response = await fetchApp("/healthcheck");

		expect(response.status).toBe(200);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			kind: "request",
			trace_id: expect.stringMatching(/^[0-9a-f]{32}$/),
			span_id: expect.stringMatching(/^[0-9a-f]{16}$/),
		});
		expect(records[0]).not.toHaveProperty("parent_span_id");
	});

	test("continues the caller's traceparent", async () => {
		await fetchApp("/healthcheck", { headers: { traceparent: `00-${TRACE_ID}-${PARENT_ID}-01` } });

		expect(records[0]).toMatchObject({
			trace_id: TRACE_ID,
			parent_span_id: PARENT_ID,
			trace_flags: "01",
		});
		expect(records[0]?.span_id).not.toBe(PARENT_ID);
	});
});
