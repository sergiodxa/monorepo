/**
 * Flag declarations: booleans with a generated `--no-<name>`, and string and number flags that
 * become repeated (`.multiple()`), comma lists (`.list()`) or take an optional value
 * (`.optionalValue()`). Each declaration carries the type its handler reads off `ctx.flags`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { PromptDeclaration } from "./prompt.js";

/** Brands a flag declaration so a command can tell it from an argument. */
const FLAG = Symbol.for("@sdxc/cli.flag");

/** Type-only slot carrying the value a declaration hands its handler. */
declare const VALUE: unique symbol;

/** Wraps a value type so an `undefined` inside it survives inference. */
export interface Carried<T> {
	value: T;
}

/** What a flag reads from the command line. */
export type FlagKind = "boolean" | "string" | "number";

/** Everything one flag declares, as the parser and the help read it. */
export interface FlagSpec {
	kind: FlagKind;
	/** The long name, written `--<name>`. */
	name: string;
	/** A one-character alias, written `-<short>`. */
	short: string | undefined;
	/** Other long names the flag answers to, such as `jobs` for `concurrency`. */
	aliases: readonly string[];
	description: string | undefined;
	/** What the help shows in `<…>` after the flag. */
	valueName: string | undefined;
	/**
	 * Whether `default` was declared; a declared `undefined` still counts. A boolean without one
	 * still reads `false` when missing, but a prompt bound to it asks.
	 */
	hasDefault: boolean;
	default: unknown;
	/** A missing value is a usage error. Implied by a prompt without a default. */
	required: boolean;
	/** Checks each value: every element of a repeated or list flag. */
	schema: StandardSchemaV1 | undefined;
	prompt: PromptDeclaration | undefined;
	/** Repeating the flag collects every value instead of keeping the last. */
	multiple: boolean;
	/** One value holds several, separated by commas. */
	list: boolean;
	/** The flag may appear bare, which reads as `true`, or with `=value`. */
	optionalValue: boolean;
	/** Left out of the help. */
	hidden: boolean;
}

/** A declared flag, typed with the value its handler reads. */
export interface Flag<Value = unknown> {
	readonly [FLAG]: FlagSpec;
	readonly [VALUE]?: Carried<Value>;
}

/** The value a flag declaration hands its handler. */
export type FlagValue<F> = F extends { readonly [VALUE]?: Carried<infer V> | undefined }
	? V
	: never;

/** Whether `value` is a flag declaration. */
export function isFlag(value: unknown): value is Flag {
	return typeof value === "object" && value !== null && FLAG in value;
}

/** The spec behind a flag declaration. */
export function flagSpec(flag: Flag): FlagSpec {
	return flag[FLAG];
}

/** The value of a string or number flag, from the shape its modifiers gave it. */
type ValueOutput<Item, Required extends boolean, Many extends boolean, Bare extends boolean> =
	| (Many extends true ? Item[] : Required extends true ? Item : Item | undefined)
	| (Bare extends true ? true : never);

/** A string or number flag, with the modifiers that reshape its value. */
export interface ValueFlag<
	Item,
	Required extends boolean = false,
	Many extends boolean = false,
	Bare extends boolean = false,
> extends Flag<ValueOutput<Item, Required, Many, Bare>> {
	/**
	 * Every occurrence is kept, in order: `--tag a --tag b` reads `["a", "b"]`, and a missing
	 * flag reads `[]`.
	 */
	multiple(): ValueFlag<Item, Required, true, Bare>;
	/**
	 * Each value is split at commas, with blanks dropped: `--allow-env=HOME,PATH` reads
	 * `["HOME", "PATH"]`. Repeating the flag adds to the list, and a missing flag reads `[]`.
	 */
	list(): ValueFlag<Item, Required, true, Bare>;
	/**
	 * The flag may appear bare, which reads `true`, or with a value after `=`, which reads that
	 * value: `--allow-net` grants everything, `--allow-net=api.example.com` one host. A bare
	 * occurrence anywhere wins over values in other occurrences.
	 */
	optionalValue(): ValueFlag<Item, Required, Many, true>;
}

/** Options every flag takes. */
export interface FlagOptions {
	description?: string;
	/** A one-character alias, such as `"f"` for `-f`. */
	short?: string;
	/** Other long names the flag answers to. */
	aliases?: readonly string[];
	/** Asked when the flag is missing and stdin and stderr are terminals. */
	prompt?: PromptDeclaration;
	/** Left out of the help. */
	hidden?: boolean;
}

/** Options a boolean flag takes. */
export interface BooleanFlagOptions extends FlagOptions {
	/** The value when neither `--<name>` nor `--no-<name>` is passed. @default false */
	default?: boolean;
}

/** Options a string or number flag takes. */
export interface ValueFlagOptions extends FlagOptions {
	/** What the help shows in `<…>`. @default "value", or "number" for a number flag */
	valueName?: string;
	/** Checks each value; its output is what the handler reads. */
	schema?: StandardSchemaV1;
	/** The value when the flag is missing, taken as the handler reads it. */
	default?: unknown;
	/** A missing flag is a usage error. */
	required?: boolean;
}

/** The handler's value type for a flag declared with `options`, before any modifier. */
type ItemOf<Options, Fallback> = Options extends {
	schema: StandardSchemaV1<infer _Input, infer Output>;
}
	? Output
	: Fallback;

/** Whether a flag declared with `options` always has a value once the command runs. */
type IsRequired<Options> = Options extends { default: unknown }
	? true
	: Options extends { required: true }
		? true
		: Options extends { prompt: PromptDeclaration }
			? true
			: false;

/** Builds the spec shared by every flag kind. */
function baseSpec(kind: FlagKind, name: string, options: ValueFlagOptions): FlagSpec {
	return {
		kind,
		name,
		short: options.short,
		aliases: options.aliases ?? [],
		description: options.description,
		valueName: options.valueName,
		hasDefault: "default" in options,
		default: options.default,
		required:
			options.required === true || (options.prompt !== undefined && !("default" in options)),
		schema: options.schema,
		prompt: options.prompt,
		multiple: false,
		list: false,
		optionalValue: false,
		hidden: options.hidden === true,
	};
}

/** A value flag around `spec`, whose modifiers each answer a new declaration. */
function valueFlag(spec: FlagSpec): ValueFlag<unknown, boolean, boolean, boolean> {
	return {
		[FLAG]: spec,
		multiple: () => valueFlag({ ...spec, multiple: true }),
		list: () => valueFlag({ ...spec, list: true }),
		optionalValue: () => valueFlag({ ...spec, optionalValue: true }),
	} as ValueFlag<unknown, boolean, boolean, boolean>;
}

/**
 * Flag declarations. A flag belongs to the command that declares it, and its key in that
 * command's `flags` is the property the handler reads.
 *
 * @example flags: { dryRun: flag.boolean("dry-run", { description: "Print it and write nothing" }) }
 * @example flags: { allowNet: flag.string("allow-net").optionalValue().list() }
 * @example flags: { retries: flag.number("retries", { default: 0 }) }
 */
export const flag = {
	/**
	 * `--<name>` reads `true` and `--no-<name>` reads `false`; passing both is a usage error.
	 *
	 * @param name - The long name, in kebab case
	 */
	boolean(name: string, options: BooleanFlagOptions = {}): Flag<boolean> {
		let spec = baseSpec("boolean", name, options);
		if (!spec.hasDefault) spec.default = false;
		spec.required = false;
		return { [FLAG]: spec };
	},
	/**
	 * `--<name> value` or `--<name>=value`, checked by `schema` when one is given.
	 *
	 * @param name - The long name, in kebab case
	 */
	string<const Options extends ValueFlagOptions = Record<never, never>>(
		name: string,
		options?: Options,
	): ValueFlag<ItemOf<Options, string>, IsRequired<Options>> {
		return valueFlag(baseSpec("string", name, options ?? {})) as ValueFlag<
			ItemOf<Options, string>,
			IsRequired<Options>
		>;
	},
	/**
	 * A string flag read as a number before `schema` checks it; text that is not a number is a
	 * usage error.
	 *
	 * @param name - The long name, in kebab case
	 */
	number<const Options extends ValueFlagOptions = Record<never, never>>(
		name: string,
		options?: Options,
	): ValueFlag<ItemOf<Options, number>, IsRequired<Options>> {
		return valueFlag(baseSpec("number", name, options ?? {})) as ValueFlag<
			ItemOf<Options, number>,
			IsRequired<Options>
		>;
	},
};
