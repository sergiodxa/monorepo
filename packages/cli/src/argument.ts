/**
 * Positional argument declarations: one value, every remaining value with `argument.variadic`,
 * each checked by a Standard Schema, or every token after the command's name as typed with
 * `argument.rest`. A command's `arguments` fill in key order, so the declaration is the usage line.
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
	/** Takes every token after the command's name unparsed, flags and `--help` included. */
	rest: boolean;
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

/** Options a rest argument takes; its values arrive as typed, so it has no schema or prompt. */
export interface RestArgumentOptions {
	description?: string;
	/** What the help shows in `[…]`. @default the argument's key */
	valueName?: string;
}

/** Accepts every token as it is, since a rest argument's values belong to another program. */
const AS_TYPED: StandardSchemaV1<string, string> = {
	"~standard": {
		version: 1,
		vendor: "@sdxc/cli",
		validate: (value) => ({ value: value as string }),
	},
};

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
			rest: false,
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
			rest: false,
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
 * Every token after the command's name exactly as typed, flags and `--help` included, for a
 * command that runs another program with them. It is the command's only argument, and the
 * command declares no flags.
 *
 * @example arguments: { args: argument.rest() } // prog run users find --limit 5 → ["users", "find", "--limit", "5"]
 */
function rest(options: RestArgumentOptions = {}): Argument<string[]> {
	return {
		[ARGUMENT]: {
			schema: AS_TYPED,
			variadic: true,
			rest: true,
			min: 0,
			max: Infinity,
			optional: false,
			hasDefault: false,
			default: undefined,
			description: options.description,
			valueName: options.valueName,
			prompt: undefined,
		},
	};
}

/**
 * Argument declarations: `argument(schema, options)` for one value,
 * `argument.variadic(schema, options)` for every remaining one, and `argument.rest()` for the
 * tokens another program receives.
 */
export const argument: typeof single & { variadic: typeof variadic; rest: typeof rest } =
	Object.assign(single, { variadic, rest });
