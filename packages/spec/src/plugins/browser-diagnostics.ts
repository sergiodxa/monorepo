/**
 * Shared Chrome DevTools Protocol diagnostics for the `browser` capability:
 * Performance traces, runtime metrics, and a one-shot CDP escape hatch. Both
 * backends expose the same tool names so a `.spec` never names the protocol.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { ToolDescriptor } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { ToolError } from "../errors.js";
import { formatValue } from "../values.js";

/**
 * Default Tracing categories: the DevTools Performance panel set, so a
 * stopped trace opens in `chrome://tracing` or Perfetto without extra flags.
 */
export const DEFAULT_TRACE_CATEGORIES =
	"-*,devtools.timeline,v8.execute,disabled-by-default-devtools.timeline";

/** Workspace path used when `trace.stop` omits an explicit file name. */
export const DEFAULT_TRACE_PATH = "trace.json";

/** Tool descriptors both browser backends register for CDP diagnostics. */
export const BROWSER_DIAGNOSTIC_TOOLS: ToolDescriptor[] = [
	{
		name: "trace.start",
		summary:
			'Start a Chrome Performance trace: `browser.trace.start`, or `browser.trace.start "devtools.timeline,v8.execute"`.',
		kind: "action",
		requires: "net",
		params: [
			{
				name: "categories",
				kind: "value",
				required: false,
				summary:
					"Comma-separated CDP Tracing categories; defaults to the DevTools Performance set.",
			},
		],
	},
	{
		name: "trace.stop",
		summary:
			'Stop the open Performance trace and write it: `browser.trace.stop`, or `browser.trace.stop "checkout.json"`.',
		kind: "action",
		requires: "net",
		params: [
			{
				name: "path",
				kind: "value",
				required: false,
				summary: `Workspace-relative path for the chrome://tracing JSON; defaults to "${DEFAULT_TRACE_PATH}".`,
			},
		],
	},
	{
		name: "metrics",
		summary:
			"Read Chrome Performance.getMetrics as a name→value object: `let m = browser.metrics`.",
		kind: "observable",
		requires: "net",
		params: [],
	},
	{
		name: "cdp",
		summary:
			'Send one CDP command and return its result: `browser.cdp "Performance.getMetrics"`, or with params `browser.cdp "Runtime.evaluate" { expression: "1+1" }`.',
		kind: "action",
		requires: "net",
		params: [
			{
				name: "method",
				kind: "value",
				required: true,
				summary: 'CDP method name, e.g. "Network.enable" or "Performance.getMetrics".',
			},
			{
				name: "params",
				kind: "value",
				required: false,
				summary: "Optional params object the method accepts.",
			},
		],
	},
];

/**
 * Read the optional categories string for `trace.start`. Omitted means the
 * DevTools Performance default set.
 */
export function readTraceCategories(args: ToolArg[]): Result<string, SpecError> {
	if (args.length === 0) return success(DEFAULT_TRACE_CATEGORIES);
	if (args.length > 1) {
		return failure(
			new ToolError(
				'browser.trace.start takes at most one categories string, e.g. browser.trace.start "devtools.timeline"',
			),
		);
	}
	let first = args[0];
	if (first === undefined || first.kind !== "value" || typeof first.value !== "string") {
		return failure(
			new ToolError(
				`browser.trace.start expects a categories string, got ${first === undefined ? "nothing" : formatArg(first)}`,
			),
		);
	}
	if (first.value.trim() === "") {
		return failure(new ToolError("browser.trace.start categories must be a non-empty string"));
	}
	return success(first.value);
}

/**
 * Read the optional workspace path for `trace.stop`. Omitted means
 * {@link DEFAULT_TRACE_PATH}.
 */
export function readTraceStopPath(args: ToolArg[]): Result<string, SpecError> {
	if (args.length === 0) return success(DEFAULT_TRACE_PATH);
	if (args.length > 1) {
		return failure(
			new ToolError(
				'browser.trace.stop takes at most one path, e.g. browser.trace.stop "checkout.json"',
			),
		);
	}
	let first = args[0];
	if (first === undefined || first.kind !== "value" || typeof first.value !== "string") {
		return failure(
			new ToolError(
				`browser.trace.stop expects a path string, got ${first === undefined ? "nothing" : formatArg(first)}`,
			),
		);
	}
	if (first.value.trim() === "") {
		return failure(new ToolError("browser.trace.stop path must be a non-empty string"));
	}
	return success(first.value);
}

/**
 * Read `browser.cdp`'s method and optional params object.
 */
export function readCdpCall(
	args: ToolArg[],
): Result<{ method: string; params: Record<string, unknown> }, SpecError> {
	if (args.length === 0 || args.length > 2) {
		return failure(
			new ToolError(
				'browser.cdp takes a method and optional params: browser.cdp "Performance.getMetrics", or browser.cdp "Runtime.evaluate" { expression: "1+1" }',
			),
		);
	}
	let methodArg = args[0];
	if (
		methodArg === undefined ||
		methodArg.kind !== "value" ||
		typeof methodArg.value !== "string"
	) {
		return failure(
			new ToolError(
				`browser.cdp expects a method string first, got ${methodArg === undefined ? "nothing" : formatArg(methodArg)}`,
			),
		);
	}
	if (methodArg.value.trim() === "" || !methodArg.value.includes(".")) {
		return failure(
			new ToolError(
				`browser.cdp method must look like "Domain.method", got ${formatValue(methodArg.value)}`,
			),
		);
	}
	if (args.length === 1) return success({ method: methodArg.value, params: {} });
	let paramsArg = args[1];
	if (
		paramsArg === undefined ||
		paramsArg.kind !== "value" ||
		typeof paramsArg.value !== "object" ||
		paramsArg.value === null ||
		Array.isArray(paramsArg.value)
	) {
		return failure(
			new ToolError(
				`browser.cdp params must be an object, got ${paramsArg === undefined ? "nothing" : formatArg(paramsArg)}`,
			),
		);
	}
	return success({
		method: methodArg.value,
		params: paramsArg.value as Record<string, unknown>,
	});
}

/**
 * Shape `trace.stop` returns so a spec can bind the path and how many events
 * landed, without pulling the whole timeline into a value.
 */
export function traceStopValue(path: string, eventCount: number): ValueObject {
	return { path, event_count: eventCount };
}

/**
 * Turn Performance.getMetrics' `{ metrics: [{ name, value }, …] }` into a flat
 * name→number object a `.spec` can bind and assert against.
 */
export function metricsToValue(
	metrics: readonly { name?: unknown; value?: unknown }[],
): ValueObject {
	let out: ValueObject = {};
	for (let entry of metrics) {
		if (typeof entry.name !== "string") continue;
		if (typeof entry.value !== "number") continue;
		out[entry.name] = entry.value;
	}
	return out;
}

/**
 * Coerce a CDP command result into a {@link Value} the language can bind.
 * Objects and arrays keep their shape; everything else stringifies only when
 * it is already a language scalar.
 */
export function cdpResultToValue(result: unknown): Result<Value, SpecError> {
	if (result === undefined || result === null) return success(null);
	if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
		return success(result);
	}
	if (Array.isArray(result) || (typeof result === "object" && result !== null)) {
		return success(result as Value);
	}
	return failure(
		new ToolError(`browser.cdp returned a value the language cannot bind: ${typeof result}`),
	);
}

/** Render one tool argument for an error message. */
function formatArg(arg: ToolArg): string {
	if (arg.kind === "word") return `word ${arg.word}`;
	return formatValue(arg.value);
}
