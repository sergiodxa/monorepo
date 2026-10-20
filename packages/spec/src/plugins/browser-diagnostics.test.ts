/**
 * Unit tests for the shared CDP diagnostics grammar: argument parsing and
 * value shaping that both browser backends share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ToolArg } from "../values.js";

import {
	BROWSER_DIAGNOSTIC_TOOLS,
	DEFAULT_TRACE_CATEGORIES,
	DEFAULT_TRACE_PATH,
	cdpResultToValue,
	metricsToValue,
	readCdpCall,
	readTraceCategories,
	readTraceStopPath,
	traceStopValue,
} from "./browser-diagnostics.js";

function value(text: string | number | boolean | null | object): ToolArg {
	return { kind: "value", value: text as never };
}

describe("BROWSER_DIAGNOSTIC_TOOLS", () => {
	test("names the four CDP diagnostics tools both backends share", () => {
		expect(BROWSER_DIAGNOSTIC_TOOLS.map((tool) => tool.name)).toEqual([
			"trace.start",
			"trace.stop",
			"metrics",
			"cdp",
		]);
	});

	test("every diagnostic tool requires net", () => {
		for (let tool of BROWSER_DIAGNOSTIC_TOOLS) {
			expect(tool.requires).toBe("net");
		}
	});
});

describe(readTraceCategories.name, () => {
	test("defaults to the DevTools Performance category set", () => {
		let result = readTraceCategories([]);
		expect(isFailure(result)).toBe(false);
		if (!isFailure(result)) expect(result.data).toBe(DEFAULT_TRACE_CATEGORIES);
	});

	test("accepts a custom categories string", () => {
		let result = readTraceCategories([value("devtools.timeline")]);
		expect(isFailure(result)).toBe(false);
		if (!isFailure(result)) expect(result.data).toBe("devtools.timeline");
	});

	test("rejects an empty categories string", () => {
		let result = readTraceCategories([value("  ")]);
		expect(isFailure(result)).toBe(true);
	});
});

describe(readTraceStopPath.name, () => {
	test("defaults to trace.json", () => {
		let result = readTraceStopPath([]);
		expect(isFailure(result)).toBe(false);
		if (!isFailure(result)) expect(result.data).toBe(DEFAULT_TRACE_PATH);
	});

	test("accepts a workspace-relative path", () => {
		let result = readTraceStopPath([value("checkout.json")]);
		expect(isFailure(result)).toBe(false);
		if (!isFailure(result)) expect(result.data).toBe("checkout.json");
	});
});

describe(readCdpCall.name, () => {
	test("reads a method with no params", () => {
		let result = readCdpCall([value("Performance.getMetrics")]);
		expect(isFailure(result)).toBe(false);
		if (!isFailure(result)) {
			expect(result.data).toEqual({ method: "Performance.getMetrics", params: {} });
		}
	});

	test("reads a method with a params object", () => {
		let result = readCdpCall([
			value("Runtime.evaluate"),
			value({ expression: "1+1", awaitPromise: false }),
		]);
		expect(isFailure(result)).toBe(false);
		if (!isFailure(result)) {
			expect(result.data.method).toBe("Runtime.evaluate");
			expect(result.data.params).toEqual({ expression: "1+1", awaitPromise: false });
		}
	});

	test("rejects a method without a Domain. prefix", () => {
		let result = readCdpCall([value("navigate")]);
		expect(isFailure(result)).toBe(true);
	});

	test("rejects array params", () => {
		let result = readCdpCall([value("Network.enable"), value([1, 2])]);
		expect(isFailure(result)).toBe(true);
	});
});

describe(metricsToValue.name, () => {
	test("flattens name/value pairs and drops malformed entries", () => {
		expect(
			metricsToValue([
				{ name: "JSHeapUsedSize", value: 10 },
				{ name: "skip" },
				{ value: 3 },
				{ name: "Nodes", value: 4 },
			]),
		).toEqual({ JSHeapUsedSize: 10, Nodes: 4 });
	});
});

describe(traceStopValue.name, () => {
	test("returns path and event_count for the language to bind", () => {
		expect(traceStopValue("flow.json", 12)).toEqual({ path: "flow.json", event_count: 12 });
	});
});

describe(cdpResultToValue.name, () => {
	test("passes through language scalars and objects", () => {
		expect(cdpResultToValue(null)).toEqual({ status: "success", data: null });
		expect(cdpResultToValue({ metrics: [] })).toEqual({
			status: "success",
			data: { metrics: [] },
		});
	});
});
