/**
 * The built-in `spec` capability: what this run and this attempt are called.
 * Generated data reproduces from the seed, so a spec that needs a value no
 * earlier run produced — a unique email, a unique slug — composes `spec.nonce`
 * into it explicitly. Every tool reads the identity the runner already fixed,
 * so all are `observable` and need no permission grant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { ExpectationError, ToolError } from "../errors.js";
import { formatValue, valueEquals } from "../values.js";

const SPEC_TOOLS = ["run_id", "attempt", "nonce"] as const;

type SpecTool = (typeof SPEC_TOOLS)[number];

/**
 * The optional expected value every reading observable takes, so
 * `expect spec.attempt 2` asserts as directly as `expect browser.url "…"` does.
 */
const EXPECTED_PARAM: ToolParam = {
	name: "expected",
	kind: "value",
	required: false,
	summary: "When given, the value this run's identity must have.",
};

/** Descriptors of every tool the `spec` namespace exposes. */
const DESCRIPTORS: ToolDescriptor[] = [
	{
		name: "run_id",
		summary: "The identifier of this run, shared by every test; `--run-id=` replays it.",
		kind: "observable",
		params: [EXPECTED_PARAM],
	},
	{
		name: "attempt",
		summary: "Which attempt of this test is running, counting from 1.",
		kind: "observable",
		params: [EXPECTED_PARAM],
	},
	{
		name: "nonce",
		summary: "`<run_id>-<attempt>`: the value a spec composes into generated identity.",
		kind: "observable",
		params: [EXPECTED_PARAM],
	},
];

/**
 * Create the built-in `spec` plugin (namespace `"spec"`): three observables
 * over the run's identity. Each reads its value when called bare and asserts
 * it when handed an expected one, the way every reading observable does.
 */
export function createSpecPlugin(): Plugin {
	return {
		namespace: "spec",
		describe() {
			return DESCRIPTORS;
		},
		async call(tool, args, context) {
			if (!isSpecTool(tool)) {
				return failure(
					new ToolError(`spec has no tool "${tool}"; available tools: ${SPEC_TOOLS.join(", ")}`),
				);
			}
			return read(tool, args, context);
		},
	};
}

function isSpecTool(tool: string): tool is SpecTool {
	return (SPEC_TOOLS as readonly string[]).includes(tool);
}

/**
 * Read one identity value, or assert it equals the expected one. Comparison is
 * the structural equality `expect` itself uses, so a number stays a number.
 */
function read(tool: SpecTool, args: ToolArg[], context: ToolContext): Result<Value, SpecError> {
	if (args.length > 1) {
		return failure(
			new ToolError(
				`spec.${tool} takes at most one argument, the expected value; it was given ${args.length}`,
			),
		);
	}
	let observed = identity(tool, context);
	let [expected] = args;
	if (expected === undefined) return success(observed);
	if (expected.kind !== "value") {
		return failure(
			new ToolError(
				`spec.${tool} expects a value to compare against, not the word "${expected.word}"`,
			),
		);
	}
	if (valueEquals(observed, expected.value)) return success(true);
	return failure(
		new ExpectationError(
			`spec.${tool} is not ${formatValue(expected.value)}`,
			expected.value,
			observed,
		),
	);
}

/** The value this run's identity holds under that name. */
function identity(tool: SpecTool, context: ToolContext): Value {
	if (tool === "run_id") return context.run.id;
	if (tool === "attempt") return context.run.attempt;
	return context.run.nonce;
}
