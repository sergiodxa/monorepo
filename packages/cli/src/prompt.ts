/**
 * The seven prompt kinds as declarations: what a flag or argument asks when the command line
 * leaves it out, and the option shapes `ctx.prompt` takes when a handler asks on its own. A
 * declaration runs nothing; the run decides whether to ask, answer from a default or fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { CancelledError } from "./errors.js";

/** Brands a prompt declaration so a flag can tell it from a plain options object. */
const PROMPT = Symbol.for("@sdxc/cli.prompt");

/**
 * When a bound prompt asks: `"missing"` only when the command line left its input out and no
 * default applies, `"always"` also when a default exists, preselecting it, for a choice the user
 * should see. A value on the command line skips the prompt either way.
 */
export type Ask = "missing" | "always";

/** One option of a list prompt. */
export interface Choice<T> {
	value: T;
	/** What the list shows. @default String(value) */
	label?: string;
	/** Dimmed text after the label. */
	hint?: string;
	/** Shown dimmed and skipped by the cursor. */
	disabled?: boolean;
}

/** A list prompt's options: plain values, shown as written, or choices. */
export type Choices<T> = readonly (Choice<T> | (T & (string | number)))[];

/** Options every prompt kind takes. */
export interface PromptBase {
	/** The question, also printed in the summary line once answered. */
	message: string;
	/** @default "missing" */
	ask?: Ask;
}

/** A line of text. */
export interface TextOptions extends PromptBase {
	/** Dimmed text shown while the answer is empty. */
	placeholder?: string;
}

/** A secret line of text. */
export interface PasswordOptions extends PromptBase {
	/** `false` echoes nothing as the user types. @default true, one `•` per character */
	mask?: boolean;
}

/** A number, typed or stepped with the arrow keys. */
export interface NumberOptions extends PromptBase {
	min?: number;
	max?: number;
	/** How far one arrow press moves. @default 1 */
	step?: number;
}

/** A yes-or-no question. */
export interface ConfirmOptions extends PromptBase {
	/** What the toggle and the summary line call a yes. @default "Yes" */
	active?: string;
	/** What the toggle and the summary line call a no. @default "No" */
	inactive?: string;
}

/** One value from a list. */
export interface SelectOptions<T = unknown> extends PromptBase {
	options: Choices<T>;
}

/** Any number of values from a list. */
export interface MultiselectOptions<T = unknown> extends PromptBase {
	options: Choices<T>;
	/** Fewest values Enter accepts. */
	min?: number;
	/** Most values Enter accepts. */
	max?: number;
}

/** One value, or several with `multiple`, from a list filtered by what the user types. */
export interface SearchOptions<T = unknown> extends PromptBase {
	options: Choices<T>;
	placeholder?: string;
	/** Space toggles options and Enter answers every toggled one. */
	multiple?: boolean;
	min?: number;
	max?: number;
}

/** Every prompt kind with the options it takes. */
export interface PromptKinds {
	text: TextOptions;
	password: PasswordOptions;
	number: NumberOptions;
	confirm: ConfirmOptions;
	select: SelectOptions;
	multiselect: MultiselectOptions;
	search: SearchOptions;
}

/** A prompt kind's name. */
export type PromptKind = keyof PromptKinds;

/** A prompt bound to the flag or argument it fills. */
export interface PromptDeclaration<Kind extends PromptKind = PromptKind> {
	readonly [PROMPT]: true;
	readonly kind: Kind;
	readonly options: PromptKinds[Kind];
}

/** Whether `value` is a prompt declaration. */
export function isPromptDeclaration(value: unknown): value is PromptDeclaration {
	return typeof value === "object" && value !== null && PROMPT in value;
}

/** Builds one prompt declaration. */
function declare<Kind extends PromptKind>(kind: Kind) {
	return (options: PromptKinds[Kind]): PromptDeclaration<Kind> => ({
		[PROMPT]: true,
		kind,
		options,
	});
}

/**
 * Prompt declarations for flags and arguments. The answer goes through the same schema as a
 * value typed on the command line, and a failed check keeps the prompt open with the issue
 * under it.
 *
 * @example flag.string("template", { default: "app", prompt: prompt.select({ message: "Which template?", options: TEMPLATES }) })
 * @example argument(s.string(), { prompt: prompt.text({ message: "Where should the project go?" }) })
 */
export const prompt = {
	text: declare("text"),
	password: declare("password"),
	number: declare("number"),
	confirm: declare("confirm"),
	select: declare("select"),
	multiselect: declare("multiselect"),
	search: declare("search"),
};

/** What a handler-called prompt adds to a declaration's options. */
export interface AskOptions<T> {
	/** The answer without a terminal, so the command still runs in CI or under an agent. */
	default: T;
	/**
	 * What a terminal starts from, preselected or filled in, when it differs from `default`: a
	 * question can answer no in CI and still take yes on Enter.
	 * @default the `default`
	 */
	initial?: T;
	/** The name a test's scripted `answers` object answers this prompt by. */
	name?: string;
	/** Checks the answer; a failed check keeps the prompt open with the issue under it. */
	schema?: StandardSchemaV1<T, unknown>;
}

/** Why a handler-called prompt has no answer: the user cancelled, or a test left it unscripted. */
export type PromptError = CancelledError | Error;

/** Prompts a handler asks itself, for questions that depend on earlier work. */
export interface Prompter {
	text(options: TextOptions & AskOptions<string>): Promise<Result<string, PromptError>>;
	password(options: PasswordOptions & AskOptions<string>): Promise<Result<string, PromptError>>;
	number(options: NumberOptions & AskOptions<number>): Promise<Result<number, PromptError>>;
	confirm(options: ConfirmOptions & AskOptions<boolean>): Promise<Result<boolean, PromptError>>;
	select<T>(options: SelectOptions<T> & AskOptions<NoInfer<T>>): Promise<Result<T, PromptError>>;
	multiselect<T>(
		options: MultiselectOptions<T> & AskOptions<readonly NoInfer<T>[]>,
	): Promise<Result<T[], PromptError>>;
	search<T>(
		options: SearchOptions<T> & { multiple: true } & AskOptions<readonly NoInfer<T>[]>,
	): Promise<Result<T[], PromptError>>;
	search<T>(options: SearchOptions<T> & AskOptions<NoInfer<T>>): Promise<Result<T, PromptError>>;
}

/** The choices of a list prompt with every label and flag filled in. */
export function normalizeChoices<T>(choices: Choices<T>): Required<Choice<T>>[] {
	return choices.map((choice) => {
		if (typeof choice === "object" && choice !== null && "value" in choice) {
			return {
				value: choice.value,
				label: choice.label ?? String(choice.value),
				hint: choice.hint ?? "",
				disabled: choice.disabled ?? false,
			};
		}
		return { value: choice as T, label: String(choice), hint: "", disabled: false };
	});
}
