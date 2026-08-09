#!/usr/bin/env bun
/**
 * A self-contained example plugin, shown end-to-end with the config file that
 * loads it (`config.jsonc`) and the spec that uses it (`greet.spec`).
 * It is what a third-party plugin looks like: a Bun script that calls
 * `servePlugin` from `@pkg/spec` to speak the NDJSON-over-stdio line protocol,
 * exposing namespace "greet" with two permissionless observable tools.
 *
 * The writing-plugins guide (packages/spec/docs/writing-plugins.md) walks
 * through this file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { Plugin, ToolArg, ToolDescriptor, Value } from "@pkg/spec";

import { failure, success } from "@pkg/result";
import { servePlugin, ToolError } from "@pkg/spec";

/** The tools "greet" exposes, stable for the plugin's lifetime. */
const GREET_TOOLS: ToolDescriptor[] = [
	{
		name: "hello",
		summary: "Greet the given name.",
		kind: "observable",
		params: [{ name: "name", kind: "value", required: true, summary: "Who to greet." }],
	},
	{
		name: "shout",
		summary: "Return the given text uppercased.",
		kind: "observable",
		params: [{ name: "text", kind: "value", required: true, summary: "The text to uppercase." }],
	},
];

/**
 * Build the greet plugin. Exported so it can be exercised in-process; running
 * this file serves the same plugin over stdio for `spec run` to connect to.
 */
export function createGreetPlugin(): Plugin {
	return {
		namespace: "greet",
		describe() {
			return GREET_TOOLS;
		},
		async call(tool, args) {
			if (tool === "hello") return hello(args);
			if (tool === "shout") return shout(args);
			return failure(
				new ToolError(`Unknown tool "greet.${tool}"; this plugin exposes: hello, shout`),
			);
		},
	};
}

/** Greet the single string argument by name. */
function hello(args: ToolArg[]): Result<Value, ToolError> {
	let text = stringArgument(args);
	if (text === null) {
		return failure(new ToolError('greet.hello expects one string argument, e.g. hello "world"'));
	}
	return success(`Hello, ${text}!`);
}

/** Uppercase the single string argument. */
function shout(args: ToolArg[]): Result<Value, ToolError> {
	let text = stringArgument(args);
	if (text === null) {
		return failure(new ToolError('greet.shout expects one string argument, e.g. shout "hello"'));
	}
	return success(text.toUpperCase());
}

/** Read a lone string value argument, or null when the shape is wrong. */
function stringArgument(args: ToolArg[]): string | null {
	let first = args[0];
	if (args.length !== 1 || first === undefined || first.kind !== "value") return null;
	if (typeof first.value !== "string") return null;
	return first.value;
}

if (import.meta.main) {
	await servePlugin(createGreetPlugin());
}
