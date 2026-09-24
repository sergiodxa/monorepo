/**
 * Exercises the in-process trace: starting and continuing one, extracting it from incoming
 * headers (and restarting on anything invalid), injecting it into outgoing ones, binding it
 * to the running invocation, and the log fields it contributes to every wide event.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse as parseTraceParent } from "./traceparent.js";
import { parse as parseTraceState, stringify as stringifyTraceState } from "./tracestate.js";

import {
	continueTrace,
	currentTrace,
	extract,
	inject,
	runWithTrace,
	startTrace,
	toTraceParent,
	traceFields,
	withTrace,
} from "./index.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";
const TRACEPARENT = `00-${TRACE_ID}-${PARENT_ID}-01`;

describe("startTrace", () => {
	test("mints random lowercase hex ids and flags them random and sampled", () => {
		let trace = startTrace();
		expect(trace.traceId).toMatch(/^[0-9a-f]{32}$/);
		expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
		expect(trace.parentSpanId).toBeNull();
		expect(trace).toMatchObject({ sampled: true, random: true });
		expect(trace.state.size).toBe(0);
		expect(startTrace().traceId).not.toBe(trace.traceId);
	});

	test("takes the sampling decision and a state", () => {
		let state = unwrap(parseTraceState("rojo=1"));
		let trace = startTrace({ sampled: false, state });
		expect(trace.sampled).toBe(false);
		expect(trace.state).toBe(state);
	});
});

describe("continueTrace", () => {
	test("keeps the trace id and flags, names the caller as parent, and mints a new span", () => {
		let parent = unwrap(parseTraceParent(`00-${TRACE_ID}-${PARENT_ID}-02`));
		let trace = continueTrace(parent);
		expect(trace).toMatchObject({
			traceId: TRACE_ID,
			parentSpanId: PARENT_ID,
			sampled: false,
			random: true,
		});
		expect(trace.spanId).toMatch(/^[0-9a-f]{16}$/);
		expect(trace.spanId).not.toBe(PARENT_ID);
	});
});

describe("extract", () => {
	test("continues the trace a valid traceparent names, with its tracestate", () => {
		let trace = extract(new Headers({ traceparent: TRACEPARENT, tracestate: "rojo=1,congo=2" }));
		expect(trace).toMatchObject({ traceId: TRACE_ID, parentSpanId: PARENT_ID, sampled: true });
		expect(stringifyTraceState(trace.state)).toBe("rojo=1,congo=2");
	});

	test("starts a new trace without a traceparent", () => {
		let trace = extract(new Headers({ tracestate: "rojo=1" }));
		expect(trace.parentSpanId).toBeNull();
		expect(trace.state.size).toBe(0);
	});

	test("starts a new trace and discards tracestate when traceparent is invalid", () => {
		let trace = extract(
			new Headers({ traceparent: `00-${"0".repeat(32)}-${PARENT_ID}-01`, tracestate: "rojo=1" }),
		);
		expect(trace.traceId).not.toBe("0".repeat(32));
		expect(trace.parentSpanId).toBeNull();
		expect(trace.state.size).toBe(0);
	});

	test("continues the trace but drops an invalid tracestate", () => {
		let trace = extract(new Headers({ traceparent: TRACEPARENT, tracestate: "Bad=1" }));
		expect(trace.traceId).toBe(TRACE_ID);
		expect(trace.state.size).toBe(0);
	});

	test("reads tracestate split across several header fields as one list", () => {
		let headers = new Headers([
			["traceparent", TRACEPARENT],
			["tracestate", "rojo=1"],
			["tracestate", "congo=2"],
		]);
		expect(stringifyTraceState(extract(headers).state)).toBe("rojo=1,congo=2");
	});
});

describe("inject", () => {
	test("writes this span as the parent, and the state", () => {
		let trace = extract(new Headers({ traceparent: TRACEPARENT, tracestate: "rojo=1" }));
		let headers = new Headers();
		inject(headers, trace);
		expect(headers.get("traceparent")).toBe(`00-${TRACE_ID}-${trace.spanId}-01`);
		expect(headers.get("tracestate")).toBe("rojo=1");
	});

	test("defaults to the current trace, and writes nothing outside one", () => {
		let outside = new Headers();
		inject(outside);
		expect([...outside.keys()]).toEqual([]);

		let trace = startTrace();
		let inside = new Headers();
		runWithTrace(trace, () => inject(inside));
		expect(inside.get("traceparent")).toBe(toTraceParent(trace));
	});

	test("leaves a traceparent already present, and adds no state beside it", () => {
		let trace = startTrace({ state: unwrap(parseTraceState("rojo=1")) });
		let headers = new Headers({ traceparent: TRACEPARENT });
		inject(headers, trace);
		expect(headers.get("traceparent")).toBe(TRACEPARENT);
		expect(headers.has("tracestate")).toBe(false);
	});

	test("leaves a tracestate already present", () => {
		let trace = startTrace({ state: unwrap(parseTraceState("rojo=1")) });
		let headers = new Headers({ tracestate: "mine=1" });
		inject(headers, trace);
		expect(headers.get("tracestate")).toBe("mine=1");
	});

	test("writes no tracestate header for an empty state", () => {
		let headers = new Headers();
		inject(headers, startTrace());
		expect(headers.has("tracestate")).toBe(false);
	});

	test("narrows to traceparent, or to nothing", () => {
		let trace = startTrace({ state: unwrap(parseTraceState("rojo=1")) });

		let parentOnly = new Headers();
		inject(parentOnly, trace, "traceparent");
		expect(parentOnly.has("traceparent")).toBe(true);
		expect(parentOnly.has("tracestate")).toBe(false);

		let none = new Headers();
		inject(none, trace, "none");
		expect([...none.keys()]).toEqual([]);
	});
});

describe("withTrace", () => {
	test("replaces the traceparent a forwarded request arrived with by this span's", async () => {
		let incoming = new Request("https://example.com/", {
			method: "POST",
			body: "payload",
			headers: { traceparent: TRACEPARENT, tracestate: "rojo=1", "x-kept": "yes" },
		});
		let trace = extract(incoming.headers);

		let forwarded = withTrace(incoming, trace);

		expect(forwarded.headers.get("traceparent")).toBe(toTraceParent(trace));
		expect(forwarded.headers.get("traceparent")).not.toBe(TRACEPARENT);
		expect(forwarded.headers.get("tracestate")).toBe("rojo=1");
		expect(forwarded.headers.get("x-kept")).toBe("yes");
		expect(forwarded.method).toBe("POST");
		expect(await forwarded.text()).toBe("payload");
	});

	test("drops a forwarded tracestate the trace does not carry", () => {
		let incoming = new Request("https://example.com/", { headers: { tracestate: "stale=1" } });
		let forwarded = withTrace(incoming, startTrace());
		expect(forwarded.headers.has("tracestate")).toBe(false);
	});

	test("returns the request unchanged outside a trace", () => {
		let request = new Request("https://example.com/");
		expect(withTrace(request)).toBe(request);
	});

	test("defaults to the current trace", () => {
		let trace = startTrace();
		let forwarded = runWithTrace(trace, () => withTrace(new Request("https://example.com/")));
		expect(forwarded.headers.get("traceparent")).toBe(toTraceParent(trace));
	});
});

describe("currentTrace", () => {
	test("is undefined outside runWithTrace and restored after a nested one", async () => {
		expect(currentTrace()).toBeUndefined();
		let outer = startTrace();
		let inner = startTrace();

		await runWithTrace(outer, async () => {
			expect(currentTrace()).toBe(outer);
			await runWithTrace(inner, async () => {
				await Promise.resolve();
				expect(currentTrace()).toBe(inner);
			});
			expect(currentTrace()).toBe(outer);
		});

		expect(currentTrace()).toBeUndefined();
	});
});

describe("traceFields", () => {
	test("names the fields as OpenTelemetry does, with the flags as two hex digits", () => {
		let trace = continueTrace(unwrap(parseTraceParent(`00-${TRACE_ID}-${PARENT_ID}-03`)));
		expect(traceFields(trace)).toEqual({
			trace_id: TRACE_ID,
			span_id: trace.spanId,
			parent_span_id: PARENT_ID,
			trace_flags: "03",
		});
	});

	test("leaves parent_span_id undefined for a root", () => {
		let fields = traceFields(startTrace({ sampled: false }));
		expect(fields.parent_span_id).toBeUndefined();
		expect(fields.trace_flags).toBe("02");
	});
});
