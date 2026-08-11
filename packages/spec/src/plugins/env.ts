/**
 * The built-in `env` capability: read one named environment variable the
 * caller granted. It is how a spec names a secret without containing one
 * (ADR-007 §6) — the suite says which variable holds the session cookie or the
 * API token, and the environment says what it is. Every read is gated on the
 * `env` permission for that exact name, so a spec can never widen its own
 * reach by asking for a different variable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value } from "../values";

import { ToolError } from "../errors";
import { formatValue } from "../values";

/** Descriptors of every tool the `env` namespace exposes. */
const ENV_TOOLS: ToolDescriptor[] = [
	{
		name: "get",
		summary: "Read a granted environment variable, optionally falling back to a value.",
		kind: "observable",
		requires: "env",
		params: [
			{
				name: "name",
				kind: "value",
				required: true,
				summary: "Exact name of the variable, which must be granted with `--allow-env`.",
			},
			{
				name: "fallback",
				kind: "value",
				required: false,
				summary: "Value to read when the variable is unset; without it, unset is an error.",
			},
		],
	},
];

/**
 * Create the built-in `env` plugin (namespace `"env"`). `env.get NAME` reads
 * the variable and fails when it is unset; `env.get NAME fallback` reads the
 * fallback instead, for the variable a local run may reasonably leave unset.
 * The permission check comes first either way: a fallback covers an absent
 * value, never an absent grant.
 */
export function createEnvPlugin(): Plugin {
	return {
		namespace: "env",
		describe() {
			return ENV_TOOLS;
		},
		async call(tool, args, context) {
			if (tool !== "get") {
				return failure(new ToolError(`env has no tool named "${tool}"; tools: get`));
			}
			return get(args, context);
		},
	};
}

/** `env.get name [fallback]` — the whole capability. */
function get(args: ToolArg[], context: ToolContext): Result<Value, SpecError> {
	if (args.length > 2) {
		return failure(
			new ToolError("env.get takes at most two arguments: a variable name and a fallback"),
		);
	}
	let name = stringArg(args, 0);
	if (isFailure(name)) return name;
	let allowed = context.permissions.checkEnv(name.data);
	if (isFailure(allowed)) return allowed;
	let value = process.env[name.data];
	if (value !== undefined) return success(value);
	let fallback = args[1];
	if (fallback !== undefined) {
		if (fallback.kind !== "value") {
			return failure(
				new ToolError("env.get expects a value for its fallback argument (position 2)"),
			);
		}
		return success(fallback.value);
	}
	return failure(
		new ToolError(
			`the environment variable ${formatValue(name.data)} is not set; set it, or give env.get a fallback value`,
		),
	);
}

/** Extract the variable name: a required string, never a bare word. */
function stringArg(args: ToolArg[], index: number): Result<string, ToolError> {
	let arg = args[index];
	if (arg === undefined || arg.kind !== "value" || typeof arg.value !== "string") {
		return failure(
			new ToolError(`env.get expects a string for its name argument (position ${index + 1})`),
		);
	}
	return success(arg.value);
}
