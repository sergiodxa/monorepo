/**
 * The default function registry: `:string`, `:number` and `:integer`, formatting through
 * `Intl.NumberFormat` and selecting through exact numeric keys and `Intl.PluralRules`
 * categories, as the MessageFormat 2 specification defines them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MessageFunctionContext, MessageValue } from "./values.js";

import { localeDirection } from "./direction.js";
import { MessageError } from "./errors.js";
import { isFallback, isMessageValue } from "./values.js";

/**
 * What the formatter passes to a default function: the public context plus the option
 * names set by a literal and a channel for errors that leave the value usable.
 */
export interface FunctionContext extends MessageFunctionContext {
	literalOptionKeys: ReadonlySet<string>;
	onError(error: MessageError): void;
}

/** A default function, called with the formatter's full context. */
export type DefaultFunction = (
	context: FunctionContext,
	options: Record<string, unknown>,
	input?: unknown,
) => MessageValue;

/** The `number-literal` production, which string operands of numeric functions must match. */
const NUMBER_LITERAL = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/;

/** A non-negative integer written without leading zeros. */
const DIGITS = /^(?:0|[1-9]\d*)$/;

/** Options whose value is a digit count. */
const DIGIT_OPTIONS = new Set([
	"minimumIntegerDigits",
	"minimumFractionDigits",
	"maximumFractionDigits",
	"minimumSignificantDigits",
	"maximumSignificantDigits",
]);

/** Options that take one of a fixed set of values, and those values. */
const ENUM_OPTIONS: Record<string, readonly string[]> = {
	select: ["plural", "ordinal", "exact"],
	signDisplay: ["auto", "always", "exceptZero", "negative", "never"],
	useGrouping: ["auto", "always", "never", "min2"],
	trailingZeroDisplay: ["auto", "stripIfInteger"],
	roundingPriority: ["auto", "morePrecision", "lessPrecision"],
	roundingMode: [
		"ceil",
		"floor",
		"expand",
		"trunc",
		"halfCeil",
		"halfFloor",
		"halfExpand",
		"halfTrunc",
		"halfEven",
	],
};

/** The values `roundingIncrement` accepts. */
const ROUNDING_INCREMENTS = new Set([
	1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000,
]);

/** The options `:integer` reads; any other option is ignored. */
const INTEGER_OPTIONS = new Set([
	"select",
	"signDisplay",
	"useGrouping",
	"minimumIntegerDigits",
	"maximumSignificantDigits",
]);

/** Options that change the exact serialization a numeric key is compared against. */
const EXACT_AFFECTING = [
	"minimumFractionDigits",
	"minimumIntegerDigits",
	"minimumSignificantDigits",
	"maximumSignificantDigits",
];

/** The plural categories a numeric key may name. */
const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

/** Upper bound on cached `Intl` instances, reached only by messages with many distinct options. */
const INTL_CACHE_LIMIT = 500;

/** `Intl.NumberFormat` and `Intl.PluralRules` instances by locales and options. */
const INTL_CACHE = new Map<string, Intl.NumberFormat | Intl.PluralRules>();

/** The functions every message can call without registering them. */
export const DEFAULT_FUNCTIONS: Record<string, DefaultFunction> = {
	string: stringFunction,
	number: (context, options, input) => numericFunction(context, options, input, false),
	integer: (context, options, input) => numericFunction(context, options, input, true),
};

/**
 * `:string`: any operand as text, matching a key equal to its NFC form. No operand formats
 * as the empty string; a failed placeholder as operand is a bad operand.
 */
function stringFunction(
	context: FunctionContext,
	_options: Record<string, unknown>,
	input?: unknown,
): MessageValue {
	let source = context.source;
	if (isFallback(input)) throw new MessageError("bad-operand", "Operand failed", { source });
	let raw = isMessageValue(input) && input.valueOf ? input.valueOf() : input;
	let value: string;
	try {
		value = raw === undefined ? "" : String(raw as string);
	} catch (cause) {
		throw new MessageError("bad-operand", "Operand is not a string", { source, cause });
	}
	let locale = context.locales[0] ?? "und";
	let normalized = value.normalize("NFC");
	return {
		type: "string",
		locale,
		dir: "auto",
		source,
		selectKeys: (keys) => (keys.includes(normalized) ? [normalized] : []),
		toParts: () => [{ type: "string", source, locale, value }],
		toString: () => value,
		valueOf: () => value,
	};
}

/** Reads the numeric value and inherited options of a numeric function's operand. */
function readOperand(input: unknown, source: string) {
	let options: Record<string, unknown> = {};
	let raw = input;
	if (isMessageValue(input)) {
		if (input.options && typeof input.options === "object") options = input.options;
		raw = input.valueOf?.();
	} else if (input instanceof Number) raw = input.valueOf();
	if (typeof raw === "number" && Number.isFinite(raw)) return { value: raw, options };
	if (typeof raw === "bigint") return { value: raw, options };
	if (typeof raw === "string" && NUMBER_LITERAL.test(raw)) return { value: Number(raw), options };
	throw new MessageError("bad-operand", "Operand is not a number", { source });
}

/**
 * `:number` and `:integer`. Option errors are reported and the option ignored; a `select`
 * set through a variable, or inherited from the operand, leaves the value unselectable.
 */
function numericFunction(
	context: FunctionContext,
	expressionOptions: Record<string, unknown>,
	input: unknown,
	integer: boolean,
): MessageValue {
	let source = context.source;
	let operand = readOperand(input, source);
	let options: Record<string, unknown> = {};
	let selectable = true;
	let badOption = (name: string) =>
		context.onError(new MessageError("bad-option", `Invalid value for \`${name}\``, { source }));

	for (let [name, value] of Object.entries(operand.options)) {
		if (integer && !INTEGER_OPTIONS.has(name)) continue;
		if (name === "select") {
			badOption(name);
			selectable = false;
		} else options[name] = value;
	}
	for (let [name, raw] of Object.entries(expressionOptions)) {
		if (integer && !INTEGER_OPTIONS.has(name)) continue;
		let value = isMessageValue(raw) && raw.valueOf ? raw.valueOf() : raw;
		if (name === "select" && !context.literalOptionKeys.has(name)) {
			badOption(name);
			selectable = false;
			continue;
		}
		let normalized = normalizeOption(name, value);
		if (normalized === INVALID) badOption(name);
		else if (normalized !== IGNORED) options[name] = normalized;
	}

	let value = operand.value;
	if (integer) {
		if (typeof value === "number") value = Math.trunc(value);
		delete options.minimumFractionDigits;
		options.maximumFractionDigits = 0;
	}

	let { select, ...formatOptions } = options;
	let locales = context.locales;
	let formatter: Intl.NumberFormat;
	try {
		formatter = numberFormat(locales, toIntlOptions(formatOptions));
	} catch (cause) {
		throw new MessageError("bad-option", "Options are out of range", { source, cause });
	}
	let locale = locales[0] ?? "und";
	let dir = localeDirection(locale);
	let result: MessageValue = {
		type: "number",
		locale,
		dir,
		source,
		options,
		toParts: () => [{ type: "number", source, locale, dir, parts: formatter.formatToParts(value) }],
		toString: () => formatter.format(value),
		valueOf: () => value,
	};
	if (selectable) {
		let mode = typeof select === "string" ? select : "plural";
		result.selectKeys = (keys) => selectNumber(value, mode, options, locales, keys);
	}
	return result;
}

/** Marks an option value that is invalid and was reported. */
const INVALID = Symbol("invalid");

/** Marks an option the numeric functions do not read. */
const IGNORED = Symbol("ignored");

/** Validates one numeric option, returning its parsed value or a marker. */
function normalizeOption(name: string, value: unknown): unknown {
	if (DIGIT_OPTIONS.has(name) || name === "roundingIncrement") {
		let digits = parseDigits(value);
		if (digits === undefined) return INVALID;
		if (name === "roundingIncrement" && !ROUNDING_INCREMENTS.has(digits)) return INVALID;
		return digits;
	}
	let allowed = ENUM_OPTIONS[name];
	if (!allowed) return IGNORED;
	return typeof value === "string" && allowed.includes(value) ? value : INVALID;
}

/** A non-negative integer from a number or its decimal string. */
function parseDigits(value: unknown) {
	if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? value : undefined;
	if (typeof value === "string" && DIGITS.test(value)) return Number(value);
	return undefined;
}

/** Maps MessageFormat option values onto `Intl.NumberFormat` ones. */
function toIntlOptions(options: Record<string, unknown>): Intl.NumberFormatOptions {
	let intl: Record<string, unknown> = { ...options };
	if (intl.useGrouping === "never") intl.useGrouping = false;
	return intl as Intl.NumberFormatOptions;
}

/**
 * Keys matching a number, best first: a numeric key equal to the value's exact
 * serialization, then the key naming its plural or ordinal category.
 */
function selectNumber(
	value: number | bigint,
	mode: string,
	options: Record<string, unknown>,
	locales: string[],
	keys: string[],
) {
	let exact =
		Number.isInteger(Number(value)) && EXACT_AFFECTING.every((name) => options[name] === undefined)
			? String(value)
			: numberFormat(["en"], { ...toIntlOptions(options), useGrouping: false }).format(value);
	let category =
		mode === "exact"
			? undefined
			: pluralRules(locales, {
					type: mode === "ordinal" ? "ordinal" : "cardinal",
					minimumIntegerDigits: options.minimumIntegerDigits as number | undefined,
					minimumFractionDigits: options.minimumFractionDigits as number | undefined,
					maximumFractionDigits: options.maximumFractionDigits as number | undefined,
					minimumSignificantDigits: options.minimumSignificantDigits as number | undefined,
					maximumSignificantDigits: options.maximumSignificantDigits as number | undefined,
				}).select(Number(value));
	let exactMatches = keys.filter((key) => NUMBER_LITERAL.test(key) && key === exact);
	let categoryMatches = keys.filter((key) => PLURAL_CATEGORIES.has(key) && key === category);
	return [...exactMatches, ...categoryMatches];
}

/** A cached `Intl.NumberFormat`. */
function numberFormat(locales: string[], options: Intl.NumberFormatOptions) {
	return cached("number", locales, options, () => new Intl.NumberFormat(locales, options));
}

/** A cached `Intl.PluralRules`. */
function pluralRules(locales: string[], options: Intl.PluralRulesOptions) {
	return cached("plural", locales, options, () => new Intl.PluralRules(locales, options));
}

/**
 * Returns the instance cached for these arguments, building it on first use. The cache is
 * emptied when full, since its keys come from message options and stay few in practice.
 */
function cached<T extends Intl.NumberFormat | Intl.PluralRules>(
	kind: string,
	locales: string[],
	options: object,
	create: () => T,
): T {
	let key = JSON.stringify([kind, locales, options]);
	let hit = INTL_CACHE.get(key);
	if (hit) return hit as T;
	let instance = create();
	if (INTL_CACHE.size >= INTL_CACHE_LIMIT) INTL_CACHE.clear();
	INTL_CACHE.set(key, instance);
	return instance;
}
