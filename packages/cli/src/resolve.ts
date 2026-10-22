/**
 * Turns what the command line gave into the values a handler reads: each flag and argument
 * converted, checked by its schema, asked for when missing on a terminal, or defaulted. Every
 * value typed wrong is reported in one usage error before any question is asked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { iife } from "@sdxc/iife";
import { failure, isFailure, success } from "@sdxc/result";

import type { ArgumentSpec } from "./argument.js";
import type { FlagSpec } from "./flag.js";
import type { Occurrence, Parsed } from "./parse.js";
import type { Prompter, PromptKind, PromptKinds } from "./prompt.js";
import type { PromptRequest, Session } from "./session.js";
import type { Entry } from "./tree.js";

import { isGroup } from "./command.js";
import { CancelledError, UsageError } from "./errors.js";
import { validate } from "./schema.js";
import { closest } from "./suggest.js";

/** The values a handler reads. */
export interface Inputs {
	arguments: Record<string, unknown>;
	flags: Record<string, unknown>;
}

/** An input the command line left out, to ask for or default once every given value checks. */
interface Missing {
	label: string;
	names: readonly string[];
	spec: FlagSpec | ArgumentSpec;
	assign: (value: unknown) => void;
	/** Converts and checks an answer the way a typed value is. */
	check: (answer: unknown) => Promise<Result<unknown, Error>>;
	/** What applies without asking. */
	fallback: { value: unknown } | undefined;
}

/** A value that failed, as one line of the usage error. */
class Issues {
	lines: string[] = [];

	add(label: string, messages: readonly string[]): void {
		for (let message of messages) this.lines.push(`${label}: ${message}`);
	}
}

/**
 * The issue for a word a group's first argument rejects: the word was tried as a member's name
 * first, so it reads as a mistyped command, with the closest member suggested.
 */
function unknownMember(entry: Entry, word: string): string {
	let suggestion = closest(word, entry.children.keys());
	let hint = suggestion === undefined ? "" : `; did you mean "${suggestion}"?`;
	return `Unknown command "${word}" for ${entry.title}${hint}`;
}

/** Text read as a number, or `undefined` when it is not one. */
function toNumber(text: string): number | undefined {
	if (text.trim() === "") return undefined;
	let value = Number(text);
	return Number.isNaN(value) ? undefined : value;
}

/**
 * Converts and checks each item of one input: numbers read from text for a number flag, then
 * the schema. Answers the outputs, or the messages of every item that failed.
 */
async function checkItems(
	items: readonly unknown[],
	kind: "string" | "number",
	schema: StandardSchemaV1 | undefined,
): Promise<Result<unknown[], Error & { messages: string[] }>> {
	let outputs: unknown[] = [];
	let messages: string[] = [];
	for (let item of items) {
		let value = item;
		if (kind === "number" && typeof item === "string") {
			let number = toNumber(item);
			if (number === undefined) {
				messages.push(`expects a number, got ${JSON.stringify(item)}`);
				continue;
			}
			value = number;
		}
		let checked = await validate(schema, value);
		if (isFailure(checked)) messages.push(...checked.error.messages);
		else outputs.push(checked.data);
	}
	if (messages.length > 0) {
		return failure(Object.assign(new Error(messages.join("; ")), { messages }));
	}
	return success(outputs);
}

/** Splits a comma list, dropping blanks. */
function splitList(text: string): string[] {
	return text
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part !== "");
}

/** An answer as items: a list as it is, text split when the flag is a comma list. */
function answerItems(answer: unknown, list: boolean): unknown[] {
	if (Array.isArray(answer)) return answer;
	if (list && typeof answer === "string") return splitList(answer);
	return [answer];
}

/**
 * Resolves `parsed`'s command into the values its handler reads. The parser's own issues lead
 * the usage error, followed by every value that failed its conversion or schema.
 *
 * @returns The inputs, a usage failure listing every problem, a cancelled failure, or the
 * failure of a scripted answer that was missing or rejected
 */
export async function resolveInputs(
	parsed: Parsed,
	session: Pick<Session, "interactive" | "ask">,
): Promise<Result<Inputs, Error>> {
	let entry = parsed.entry;
	let inputs: Inputs = { arguments: {}, flags: {} };
	let issues = new Issues();
	issues.lines.push(...parsed.issues);
	let missing: Missing[] = [];

	let positionals = [...parsed.positionals];
	for (let { key, spec } of entry.arguments) {
		let label = `<${spec.valueName ?? key}>`;
		let given = spec.variadic ? positionals.splice(0) : positionals.splice(0, 1);
		let check = async (answer: unknown): Promise<Result<unknown, Error>> => {
			let items = answerItems(answer, false);
			if (spec.variadic && items.length < spec.min) {
				return failure(new Error(`needs at least ${spec.min} value${spec.min === 1 ? "" : "s"}`));
			}
			if (spec.variadic && items.length > spec.max) {
				return failure(new Error(`takes at most ${spec.max} value${spec.max === 1 ? "" : "s"}`));
			}
			let checked = await checkItems(items, "string", spec.schema);
			if (isFailure(checked)) return checked;
			return success(spec.variadic ? checked.data : checked.data[0]);
		};
		if (given.length === 0) {
			let fallback = iife((): { value: unknown } | undefined => {
				if (spec.hasDefault) return { value: spec.default };
				if (spec.optional) return { value: undefined };
				if (spec.variadic && spec.min === 0) return { value: [] };
			});
			missing.push({
				label,
				names: [key],
				spec,
				assign: (value) => {
					inputs.arguments[key] = value;
				},
				check,
				fallback,
			});
			continue;
		}
		let checked = await check(spec.variadic ? given : given[0]);
		if (isFailure(checked) && isGroup(entry.node) && key === entry.arguments[0]?.key) {
			issues.lines.push(unknownMember(entry, given[0] as string));
		} else if (isFailure(checked)) issues.add(label, [checked.error.message]);
		else inputs.arguments[key] = checked.data;
	}
	for (let extra of positionals) issues.lines.push(`Unexpected argument ${JSON.stringify(extra)}`);

	for (let { key, spec } of entry.flags) {
		let label = `--${spec.name}`;
		let occurrences: readonly Occurrence[] = parsed.occurrences.get(key) ?? [];
		let many = spec.multiple || spec.list;
		let check = async (answer: unknown): Promise<Result<unknown, Error>> => {
			if (spec.kind === "boolean") return success(answer === true);
			if (spec.optionalValue && answer === true) return success(true);
			let checked = await checkItems(answerItems(answer, spec.list), spec.kind, spec.schema);
			if (isFailure(checked)) return checked;
			return success(many ? checked.data : checked.data[0]);
		};
		if (occurrences.length === 0) {
			let fallback = iife((): { value: unknown } | undefined => {
				if (spec.hasDefault) return { value: spec.default };
				if (spec.kind === "boolean") return { value: false };
				if (!spec.required) return { value: many ? [] : undefined };
			});
			missing.push({
				label,
				names: [key, spec.name],
				spec,
				assign: (value) => {
					inputs.flags[key] = value;
				},
				check,
				fallback,
			});
			continue;
		}
		if (spec.kind === "boolean") {
			let plain = occurrences.find((occurrence) => !occurrence.negated);
			let negated = occurrences.find((occurrence) => occurrence.negated);
			if (plain !== undefined && negated !== undefined) {
				issues.lines.push(`${plain.spelled} and ${negated.spelled} cannot be passed together`);
				continue;
			}
			inputs.flags[key] = !(occurrences.at(-1) as Occurrence).negated;
			continue;
		}
		let values: Occurrence[] = [];
		let bare = false;
		let broken = false;
		for (let occurrence of occurrences) {
			if (occurrence.value === true) {
				bare = true;
				continue;
			}
			if (!spec.list) {
				values.push(occurrence);
				continue;
			}
			let parts = splitList(occurrence.value);
			if (parts.length === 0) {
				issues.lines.push(`${occurrence.spelled} needs a value`);
				broken = true;
			}
			for (let part of parts) values.push({ ...occurrence, value: part });
		}
		if (broken) continue;
		if (bare) {
			inputs.flags[key] = true;
			continue;
		}
		if (!many) values = values.slice(-1);
		let outputs: unknown[] = [];
		for (let value of values) {
			let checked = await checkItems([value.value], spec.kind, spec.schema);
			if (isFailure(checked)) issues.add(value.spelled, checked.error.messages);
			else outputs.push(checked.data[0]);
		}
		if (outputs.length === values.length) inputs.flags[key] = many ? outputs : outputs[0];
	}

	if (issues.lines.length > 0) return failure(new UsageError(issues.lines.join("\n")));

	for (let input of missing) {
		let declared = input.spec.prompt;
		let asks =
			declared !== undefined &&
			session.interactive &&
			(!input.spec.hasDefault ||
				input.spec.default === undefined ||
				declared.options.ask === "always");
		if (!asks || declared === undefined) {
			if (input.fallback !== undefined) input.assign(input.fallback.value);
			else if (declared !== undefined) {
				issues.lines.push(`${input.label} is required when stdin is not a terminal`);
			} else if (input.label.startsWith("<")) issues.lines.push(`Missing argument ${input.label}`);
			else issues.lines.push(`${input.label} is required`);
			continue;
		}
		if (issues.lines.length > 0) continue;
		let answered = await session.ask({
			kind: declared.kind,
			options: declared.options,
			names: input.names,
			label: input.label,
			initial: input.spec.hasDefault ? input.spec.default : undefined,
			check: input.check,
		});
		if (isFailure(answered)) return answered;
		input.assign(answered.data);
	}
	if (issues.lines.length > 0) return failure(new UsageError(issues.lines.join("\n")));
	return success(inputs);
}

/** The `ctx.prompt` of one run: asks on a terminal or from a script, else answers the default. */
export function createPrompter(session: Session): Prompter {
	/** Asks one handler-called prompt. */
	let ask = async <Kind extends PromptKind>(
		kind: Kind,
		options: PromptKinds[Kind] & {
			default: unknown;
			initial?: unknown;
			name?: string;
			schema?: StandardSchemaV1;
		},
	): Promise<Result<never, Error>> => {
		if (!session.interactive) return success(options.default as never);
		if (session.signal.aborted) return failure(new CancelledError());
		let request: PromptRequest = {
			kind,
			options,
			names: options.name === undefined ? [] : [options.name],
			label: options.name ?? JSON.stringify(options.message),
			initial: "initial" in options ? options.initial : options.default,
			async check(answer) {
				let checked = await validate(options.schema, answer);
				return isFailure(checked) ? failure(new Error(checked.error.message)) : success(answer);
			},
		};
		return (await session.ask(request)) as Result<never, Error>;
	};
	return {
		text: (options) => ask("text", options),
		password: (options) => ask("password", options),
		number: (options) => ask("number", options),
		confirm: (options) => ask("confirm", options),
		select: (options) => ask("select", options),
		multiselect: (options) => ask("multiselect", options),
		search: ((options: PromptKinds["search"] & { default: unknown }) =>
			ask("search", options)) as Prompter["search"],
	};
}
