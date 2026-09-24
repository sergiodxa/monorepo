/**
 * The trace one invocation belongs to and the span that invocation is: started fresh or
 * continued from a caller, read from incoming headers and written into outgoing ones. One
 * invocation is one span, so every outbound call names the invocation's span as its parent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex, randomBytes } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";

import type { TraceParent } from "./traceparent.js";

import { currentTrace } from "./current.js";
import { parse as parseTraceParent, stringify as stringifyTraceParent } from "./traceparent.js";
import {
	parse as parseTraceState,
	stringify as stringifyTraceState,
	TraceState,
} from "./tracestate.js";

/** Bytes in a trace id, written as 32 hex digits. */
const TRACE_ID_BYTES = 16;

/** Bytes in a span id, written as 16 hex digits. */
const SPAN_ID_BYTES = 8;

/** The trace the running invocation belongs to, and the span that invocation is. */
export interface TraceContext {
	/** 32 lowercase hex digits shared by every hop of the request. */
	traceId: string;
	/** This invocation's span, the parent id of every call it makes. */
	spanId: string;
	/** The caller's span, `null` for a trace this invocation started. */
	parentSpanId: string | null;
	/** Whether the trace's originator may be recording it; propagated, never acted on here. */
	sampled: boolean;
	/** Whether the trace id was generated randomly (Level 2). */
	random: boolean;
	/** The vendor entries the caller sent, passed on to every callee. */
	state: TraceState;
}

export namespace TraceContext {
	export interface StartOptions {
		/**
		 * The head-sampling decision this trace starts with.
		 * @default true
		 */
		sampled?: boolean;
		/** Vendor entries to start with; empty by default. */
		state?: TraceState;
	}

	/**
	 * Which headers `inject` writes: both, `traceparent` alone for a callee that should not
	 * learn upstream vendor state, or neither.
	 */
	export type Propagation = "all" | "traceparent" | "none";
}

/**
 * A random id of `bytes` bytes as lowercase hex, drawn again in the vanishing case it comes
 * out all zero, since the specification forbids that value for either id.
 */
function randomId(bytes: number): string {
	let id = Hex.encode(randomBytes(bytes));
	while (/^0+$/.test(id)) id = Hex.encode(randomBytes(bytes));
	return id;
}

/**
 * A new root trace with fresh random ids, flagged `random` as Level 2 lets a generator
 * declare.
 *
 * @param options The sampling decision and any vendor entries to start with.
 * @example let trace = startTrace();
 */
export function startTrace(options: TraceContext.StartOptions = {}): TraceContext {
	return {
		traceId: randomId(TRACE_ID_BYTES),
		spanId: randomId(SPAN_ID_BYTES),
		parentSpanId: null,
		sampled: options.sampled ?? true,
		random: true,
		state: options.state ?? TraceState.EMPTY,
	};
}

/**
 * Continues a caller's trace: the same trace id and flags, a new span id for this
 * invocation, and the caller's span as its parent.
 *
 * @param parent The caller's `traceparent`, parsed.
 * @param state The caller's `tracestate`, parsed.
 * @example let trace = continueTrace(unwrap(parse(traceparent)));
 */
export function continueTrace(
	parent: TraceParent.Value,
	state: TraceState = TraceState.EMPTY,
): TraceContext {
	return {
		traceId: parent.traceId,
		spanId: randomId(SPAN_ID_BYTES),
		parentSpanId: parent.parentId,
		sampled: parent.sampled,
		random: parent.random,
		state,
	};
}

/**
 * Continues the trace `headers` carry, or starts one when `traceparent` is missing or
 * invalid, in which case `tracestate` is discarded unread. An invalid `tracestate` beside a
 * valid parent is dropped while the trace continues. Never fails.
 *
 * @param headers The incoming request's headers.
 * @example let trace = extract(request.headers);
 */
export function extract(headers: Headers): TraceContext {
	let header = headers.get("traceparent");
	if (header === null) return startTrace();

	let parent = parseTraceParent(header);
	if (isFailure(parent)) return startTrace();

	let stateHeader = headers.get("tracestate");
	if (stateHeader === null) return continueTrace(parent.data);

	let state = parseTraceState(stateHeader);
	return continueTrace(parent.data, isFailure(state) ? TraceState.EMPTY : state.data);
}

/**
 * The `traceparent` value naming this span as parent, for carrying a trace across a channel
 * with no headers, such as a Workers RPC argument.
 *
 * @param trace The invocation's trace.
 * @example await stub.subscribe(subject, toTraceParent(ctx.trace));
 */
export function toTraceParent(trace: TraceContext): string {
	return stringifyTraceParent({
		traceId: trace.traceId,
		parentId: trace.spanId,
		sampled: trace.sampled,
		random: trace.random,
	});
}

/**
 * Writes `traceparent` (this span as parent) and `tracestate` into `headers`, leaving a
 * header already present as it is; a `traceparent` the caller set keeps its own state, so no
 * `tracestate` is added beside it. Outside an invocation with no `trace` it writes nothing.
 *
 * @param headers The outgoing request's headers, changed in place.
 * @param trace The trace to propagate; the current one by default.
 * @param propagation Which headers to write.
 * @example inject(init.headers);
 */
export function inject(
	headers: Headers,
	trace: TraceContext | undefined = currentTrace(),
	propagation: TraceContext.Propagation = "all",
): void {
	if (trace === undefined || propagation === "none") return;
	if (headers.has("traceparent")) return;

	headers.set("traceparent", toTraceParent(trace));

	if (propagation !== "all" || headers.has("tracestate")) return;

	let state = stringifyTraceState(trace.state);
	if (state !== "") headers.set("tracestate", state);
}

/**
 * A copy of `request` carrying the trace, for forwarding to a Durable Object stub. A forwarded
 * request arrives with its caller's headers, so both trace headers are replaced: the callee
 * sees this span as its parent. The body moves to the copy; outside a trace the request is
 * returned as it is.
 *
 * @param request The request being forwarded.
 * @param trace The trace to carry; the current one by default.
 * @example let response = await stub.fetch(withTrace(request));
 */
export function withTrace(
	request: Request,
	trace: TraceContext | undefined = currentTrace(),
): Request {
	if (trace === undefined) return request;

	let copy = new Request(request);
	copy.headers.delete("traceparent");
	copy.headers.delete("tracestate");
	inject(copy.headers, trace);

	return copy;
}

/** The fields {@link traceFields} contributes to a wide event. */
export interface TraceFields {
	trace_id: string;
	span_id: string;
	/** Absent for a root, which a log skips rather than writing `null`. */
	parent_span_id: string | undefined;
	/** The flags byte as two hex digits, as `traceparent` writes it. */
	trace_flags: string;
	[key: string]: string | undefined;
}

/**
 * The fields every wide event carries, named as OpenTelemetry names them for logs, so a
 * record joins on `trace_id` and orders on `parent_span_id` in any log index.
 *
 * @param trace The invocation's trace.
 * @example ctx.log.set(traceFields(ctx.trace));
 */
export function traceFields(trace: TraceContext): TraceFields {
	return {
		trace_id: trace.traceId,
		span_id: trace.spanId,
		parent_span_id: trace.parentSpanId ?? undefined,
		trace_flags: toTraceParent(trace).slice(-2),
	};
}
