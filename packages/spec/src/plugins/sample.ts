/**
 * The built-in `sample` capability: generated input for a spec that needs a
 * name, an address, or fifty of something, without a literal typed into the
 * suite. Every tool draws from the test's own stream, so the same test sees
 * the same values on every run whatever else the suite is doing.
 *
 * The tools are actions rather than observations: a draw advances the stream,
 * and polling `eventually` until a random value matches is never what an
 * author meant. None needs a permission — generation is computation, reaching
 * nothing outside the process.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";
import { createSample } from "@pkg/sample";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value } from "../values";

import { ToolError } from "../errors";

const SAMPLE_TOOLS = ["person", "email", "uuid", "int", "words", "pick"] as const;

type SampleTool = (typeof SAMPLE_TOOLS)[number];

const DESCRIPTORS: ToolDescriptor[] = [
	{
		name: "person",
		summary: "A person whose email and username match their name.",
		kind: "action",
		params: [],
	},
	{
		name: "email",
		summary: "An email address on a domain reserved for documentation.",
		kind: "action",
		params: [],
	},
	{
		name: "uuid",
		summary: "A version 4 UUID, drawn from the test's stream.",
		kind: "action",
		params: [],
	},
	{
		name: "int",
		summary: "An integer between two bounds, both included.",
		kind: "action",
		params: [
			{ name: "min", kind: "value", required: true, summary: "Lowest value, included." },
			{ name: "max", kind: "value", required: true, summary: "Highest value, included." },
		],
	},
	{
		name: "words",
		summary: "Placeholder prose of a given number of words.",
		kind: "action",
		params: [
			{ name: "count", kind: "value", required: true, summary: "How many words to return." },
		],
	},
	{
		name: "pick",
		summary: "One element of a list.",
		kind: "action",
		params: [{ name: "list", kind: "value", required: true, summary: "The list to pick from." }],
	},
];

/**
 * Create the built-in `sample` plugin (namespace `"sample"`). Values come from
 * the stream on the call's context, so two runs of one test generate the same
 * data and two tests never draw from each other's stream.
 */
export function createSamplePlugin(): Plugin {
	return {
		namespace: "sample",
		describe() {
			return DESCRIPTORS;
		},
		async call(tool, args, context) {
			if (!isSampleTool(tool)) {
				return failure(
					new ToolError(
						`sample has no tool "${tool}"; available tools: ${SAMPLE_TOOLS.join(", ")}`,
					),
				);
			}
			return generate(tool, args, context);
		},
	};
}

function isSampleTool(tool: string): tool is SampleTool {
	return (SAMPLE_TOOLS as readonly string[]).includes(tool);
}

/**
 * Run one tool against the test's stream. The generator throws a `RangeError`
 * on a bound it cannot honor; every throw becomes a `ToolError` naming the
 * tool, since a plugin reports failure as a result rather than an exception.
 */
function generate(
	tool: SampleTool,
	args: ToolArg[],
	context: ToolContext,
): Result<Value, SpecError> {
	let sample = createSample({ seed: context.random, now: context.now });
	try {
		if (tool === "person") {
			let person = sample.person.record();
			return success({
				first_name: person.firstName,
				last_name: person.lastName,
				full_name: person.fullName,
				email: person.email,
				username: person.username,
			});
		}
		if (tool === "email") return success(sample.internet.email());
		if (tool === "uuid") return success(sample.string.uuid());
		if (tool === "int") {
			let min = readNumber(args, 0);
			if (min === undefined) return numberError(tool, "min");
			let max = readNumber(args, 1);
			if (max === undefined) return numberError(tool, "max");
			return success(sample.number.int({ min, max }));
		}
		if (tool === "words") {
			let count = readNumber(args, 0);
			if (count === undefined) return numberError(tool, "count");
			return success(sample.lorem.words(count));
		}
		let list = args[0];
		if (list === undefined || list.kind !== "value" || !Array.isArray(list.value)) {
			return failure(new ToolError("sample.pick needs a list to pick from."));
		}
		if (list.value.length === 0) {
			return failure(new ToolError("sample.pick needs a list with at least one item."));
		}
		return success(sample.helpers.pick(list.value));
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(new ToolError(`sample.${tool} could not generate a value: ${reason}`));
	}
}

/** Read a positional argument as a number, or `undefined` when it is not one. */
function readNumber(args: ToolArg[], index: number): number | undefined {
	let argument = args[index];
	if (argument === undefined || argument.kind !== "value") return undefined;
	return typeof argument.value === "number" ? argument.value : undefined;
}

function numberError(tool: SampleTool, name: string): Result<Value, SpecError> {
	return failure(new ToolError(`sample.${tool} needs a number for "${name}".`));
}
