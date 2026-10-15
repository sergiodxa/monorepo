/**
 * Positional argument declarations: one value, or every remaining value with
 * `argument.variadic`, each checked by a Standard Schema. A command's `arguments` object fills in
 * the order its keys are written, so the declaration is also the usage line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Carried } from "./flag.js";
import type { PromptDeclaration } from "./prompt.js";
import type { SchemaOutput } from "./schema.js";

/** Brands an argument declaration so a command can tell it from a flag. */
const ARGUMENT = Symbol.for("@sdxc/cli.argument");

/** Type-only slot carrying the value a declaration hands its handler. */
declare const VALUE: unique symbol;

/** Everything one argument declares, as the parser and the help read it. */
export interface ArgumentSpec {
	/** Checks each value, every one of a variadic argument; it receives the text as typed. */
	schema: StandardSchemaV1;
	variadic: boolean;
	/** Fewest values a variadic argument takes. */
	min: number;
	/** Most values a variadic argument takes. */
	max: number;
	/** A missing value reads `undefined` instead of failing. */
	optional: boolean;
	hasDefault: boolean;
	default: unknown;
	description: string | undefined;
	/** What the help shows in `<…>`. @default the argument's key */
	valueName: string | undefined;
	prompt: PromptDeclaration | undefined;
}

/** A declared argument, typed with the value its handler reads. */
export interface Argument<Value = unknown> {
	readonly [ARGUMENT]: ArgumentSpec;
	readonly [VALUE]?: Carried<Value>;
}

/** The value an argument declaration hands its handler. */
export type ArgumentValue<A> =
	A extends Argument<infer _>
		? A extends { readonly [VALUE]?: Carried<infer V> | undefined }
			? V
			: never
		: never;

/** Options every argument takes. */
export interface ArgumentOptions {
	description?: string;
	/** What the help shows in `<…>`. @default the argument's key */
	valueName?: string;
	/** Asked when the argument is missing and stdin and stderr are terminals. */
	prompt?: PromptDeclaration;
}

/** Options a single argument takes. */
export interface SingleArgumentOptions extends ArgumentOptions {
	/** A missing argument reads `undefined` instead of being a usage error. */
	optional?: boolean;
	/** The value when the argument is missing, taken as the handler reads it. */
	default?: unknown;
}

/** Options a variadic argument takes. */
export interface VariadicArgumentOptions extends ArgumentOptions {
	/** @default 0 */
	min?: number;
	max?: number;
	/** The values when none are passed, taken as the handler reads them. */
	default?: readonly unknown[];
}

/** The handler's type for a single argument declared with `options`. */
type SingleValue<Output, Options> = Options extends { default: unknown }
	? Output
	: Options extends { optional: true }
		? Output | undefined
		: Output;

/** The handler's type for a variadic argument: non-empty when `min` is a positive literal. */
type VariadicValue<Output, Options> = Options extends { min: infer Min extends number }
	? Min extends 0
		? Output[]
		: number extends Min
			? Output[]
			: [Output, ...Output[]]
	: Output[];

/** Whether `value` is an argument declaration. */
export function isArgument(value: unknown): value is Argument {
	return typeof value === "object" && value !== null && ARGUMENT in value;
}

/** The spec behind an argument declaration. */
export function argumentSpec(argument: Argument): ArgumentSpec {
	return argument[ARGUMENT];
}

/**
 * One positional value, required unless it is `optional` or has a `default`.
 *
 * @param schema - Checks the text as typed; its output is what the handler reads
 * @example arguments: { directory: argument(s.string(), { prompt: prompt.text({ message: "Where?" }) }) }
 */
function single<
	Schema extends StandardSchemaV1,
	const Options extends SingleArgumentOptions = Record<never, never>,
>(schema: Schema, options?: Options): Argument<SingleValue<SchemaOutput<Schema>, Options>> {
	let given: SingleArgumentOptions = options ?? {};
	return {
		[ARGUMENT]: {
			schema,
			variadic: false,
			min: given.optional === true || "default" in given ? 0 : 1,
			max: 1,
			optional: given.optional === true,
			hasDefault: "default" in given,
			default: given.default,
			description: given.description,
			valueName: given.valueName,
			prompt: given.prompt,
		},
	};
}

/**
 * Every remaining positional value, each checked by `schema`; it must be the last argument.
 *
 * @param schema - Checks each value as typed
 * @example arguments: { components: argument.variadic(s.string(), { min: 1 }) }
 */
function variadic<
	Schema extends StandardSchemaV1,
	const Options extends VariadicArgumentOptions = Record<never, never>,
>(schema: Schema, options?: Options): Argument<VariadicValue<SchemaOutput<Schema>, Options>> {
	let given: VariadicArgumentOptions = options ?? {};
	return {
		[ARGUMENT]: {
			schema,
			variadic: true,
			min: given.min ?? 0,
			max: given.max ?? Infinity,
			optional: false,
			hasDefault: "default" in given,
			default: given.default,
			description: given.description,
			valueName: given.valueName,
			prompt: given.prompt,
		},
	};
}

/**
 * Argument declarations: `argument(schema, options)` for one value and
 * `argument.variadic(schema, options)` for the rest.
 */
export const argument: typeof single & { variadic: typeof variadic } = Object.assign(single, {
	variadic,
});
