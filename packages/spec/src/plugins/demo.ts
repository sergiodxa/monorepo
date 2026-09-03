#!/usr/bin/env bun
/**
 * The reference external plugin: a runnable script that proves the stdio
 * transport's language neutrality. It exposes namespace "demo" with a `say`
 * action that echoes its input back and an `upper` observable that returns
 * the uppercased text. Both tools are open to every caller, regardless of
 * granted permissions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolDescriptor } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { ToolError } from "../errors.js";
import { servePlugin } from "../transport-stdio.js";
import { formatValue } from "../values.js";

/** The tools the demo plugin exposes, stable for the plugin's lifetime. */
const DEMO_TOOLS: ToolDescriptor[] = [
	{
		name: "say",
		summary: "Echo the given value back to the caller.",
		kind: "action",
		params: [{ name: "text", kind: "value", required: true, summary: "The value to echo back." }],
	},
	{
		name: "upper",
		summary: "Return the given text uppercased.",
		kind: "observable",
		params: [{ name: "text", kind: "value", required: true, summary: "The text to uppercase." }],
	},
];

/**
 * Build the demo plugin. Exported so tests can exercise the tools in-process;
 * running this file serves the same plugin over stdio.
 */
export function createDemoPlugin(): Plugin {
	return {
		namespace: "demo",
		describe() {
			return DEMO_TOOLS;
		},
		async call(tool, args) {
			if (tool === "say") return say(args);
			if (tool === "upper") return upper(args);
			return failure(new ToolError(`Unknown tool "demo.${tool}"; this plugin exposes: say, upper`));
		},
	};
}

/** Echo the single value argument back, whatever its shape. */
function say(args: ToolArg[]): Result<Value, SpecError> {
	let first = args[0];
	if (args.length !== 1 || first === undefined || first.kind !== "value") {
		return failure(new ToolError('demo.say expects exactly one value argument, e.g. say "hello"'));
	}
	return success(first.value);
}

function upper(args: ToolArg[]): Result<Value, SpecError> {
	let first = args[0];
	if (args.length !== 1 || first === undefined || first.kind !== "value") {
		return failure(
			new ToolError('demo.upper expects exactly one value argument, e.g. upper "hello"'),
		);
	}
	if (typeof first.value !== "string") {
		return failure(new ToolError(`demo.upper expects a string, got ${formatValue(first.value)}`));
	}
	return success(first.value.toUpperCase());
}

if (import.meta.main) {
	await servePlugin(createDemoPlugin());
}
