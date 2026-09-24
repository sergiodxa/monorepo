/**
 * The RFC 9651 section 4.1 serialization algorithms: canonical text for the three
 * top-level types, with every range and character-set rule enforced, so a value either
 * serializes to a field any conforming recipient reads or fails with where it went wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SF } from "./types.js";

import { encodeBase64 } from "./base64.js";
import { StructuredFieldStringifyError } from "./errors.js";
import { Decimal, DisplayString, Token } from "./values.js";

/** Where in the input a value sits. */
type Path = Array<string | number>;

/** The largest magnitude an Integer may carry: fifteen nines. */
const MAX_INTEGER = 999_999_999_999_999;

/** A Decimal's integer part may carry at most twelve digits. */
const MAX_DECIMAL_INTEGER_DIGITS = 12;

/** The key grammar (section 3.1.2). */
const KEY = /^[a-z*][a-z0-9_\-.*]*$/;

/** The token grammar (section 3.3.4). */
const TOKEN = /^[A-Za-z*][!#$%&'*+\-.^_`|~0-9A-Za-z:/]*$/;

/** The characters an sf-string may carry: visible ASCII and space. */
const STRING_CHARS = /^[\x20-\x7e]*$/;

/** A UTF-16 surrogate without its pair, which has no UTF-8 encoding. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Encodes a Display String's text into the octets it percent-encodes. */
const UTF8 = new TextEncoder();

/**
 * Carries the first failure out of nested serialization without throwing; `null` means
 * every step so far succeeded.
 */
interface Failed {
	error: StructuredFieldStringifyError | null;
}

/**
 * Serializes a value as its definition's top-level type (RFC 9651 section 4.1). An empty
 * List or Dictionary serializes as `""`, which RFC 9651 reads as "do not send the field".
 *
 * @param value - The model, or members written in their shorthand forms
 * @param type - The top-level type the field's definition fixes
 * @returns The canonical text, or the path to the value with no representation
 */
export function stringifyField<Type extends SF.FieldType>(
	value: SF.InputOf[Type],
	type: Type,
): Result<string, StructuredFieldStringifyError> {
	let state: Failed = { error: null };
	let text: string;
	if (type === "list") text = serializeList(value as SF.InputOf["list"], state);
	else if (type === "dictionary")
		text = serializeDictionary(value as SF.InputOf["dictionary"], state);
	else text = serializeItem(value as SF.InputOf["item"], [], state);
	return state.error ? failure(state.error) : success(text);
}

/**
 * Records a failure unless an earlier one is already recorded.
 *
 * @param state - The shared failure slot
 * @param message - Why the value has no representation
 * @param path - Where the value sits
 * @returns `""`, so a serializer writes `return reject(…)`
 */
function reject(state: Failed, message: string, path: Path): string {
	state.error ??= new StructuredFieldStringifyError(message, path);
	return "";
}

/**
 * @param value - Anything
 * @returns Whether it is a plain object usable as Parameters or a Dictionary
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param value - Anything
 * @returns Whether it is one of the bare item types
 */
function isBareItem(value: unknown): value is SF.BareItem {
	return (
		typeof value === "number" ||
		typeof value === "string" ||
		typeof value === "boolean" ||
		value instanceof Token ||
		value instanceof Decimal ||
		value instanceof DisplayString ||
		value instanceof Uint8Array ||
		value instanceof Date
	);
}

/**
 * @param value - A member in any accepted form
 * @returns Whether it is an Inner List, the one form carrying `items`
 */
function isInnerList(value: unknown): value is SF.InnerListInput {
	return isRecord(value) && !isBareItem(value) && "items" in value;
}

/**
 * Serializes a List (section 4.1.1), members joined by `, `.
 *
 * @param list - The members
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeList(list: SF.MemberInput[], state: Failed): string {
	if (!Array.isArray(list)) return reject(state, "List must be an array", []);
	return list.map((member, index) => serializeMember(member, [index], state)).join(", ");
}

/**
 * Serializes a Dictionary (section 4.1.2). A member whose value is `true` writes the
 * bare key followed by its parameters.
 *
 * @param dictionary - The members, keyed
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeDictionary(dictionary: Record<string, SF.MemberInput>, state: Failed): string {
	if (!isRecord(dictionary)) return reject(state, "Dictionary must be an object", []);
	let parts: string[] = [];
	for (let [key, member] of Object.entries(dictionary)) {
		let text = serializeKey(key, [key], state);
		if (member === true) {
			parts.push(text);
		} else if (!isBareItem(member) && !isInnerList(member) && member.value === true) {
			parts.push(text + serializeParameters(member.params, [key, "params"], state));
		} else {
			parts.push(`${text}=${serializeMember(member, [key], state)}`);
		}
	}
	return parts.join(", ");
}

/**
 * Serializes a List or Dictionary member in any of its accepted forms.
 *
 * @param member - A bare item, an Item or an Inner List
 * @param path - Where the member sits
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeMember(member: SF.MemberInput, path: Path, state: Failed): string {
	if (isInnerList(member)) return serializeInnerList(member, path, state);
	return serializeItem(member, path, state);
}

/**
 * Serializes an Inner List (section 4.1.1.1): items separated by spaces inside
 * parentheses, then the list's parameters.
 *
 * @param list - The items and parameters
 * @param path - Where the Inner List sits
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeInnerList(list: SF.InnerListInput, path: Path, state: Failed): string {
	if (!Array.isArray(list.items)) return reject(state, "Inner List items must be an array", path);
	let items = list.items.map((item, index) =>
		serializeItem(item, [...path, "items", index], state),
	);
	return `(${items.join(" ")})${serializeParameters(list.params, [...path, "params"], state)}`;
}

/**
 * Serializes an Item (section 4.1.3), written bare or with parameters.
 *
 * @param item - A bare item, or its value with parameters
 * @param path - Where the Item sits
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeItem(item: SF.BareItem | SF.ItemInput, path: Path, state: Failed): string {
	if (isBareItem(item)) return serializeBareItem(item, path, state);
	if (!isRecord(item) || !("value" in item)) {
		return reject(state, "Expected a bare item, an Item or an Inner List", path);
	}
	let value = serializeBareItem(item.value, [...path, "value"], state);
	return value + serializeParameters(item.params, [...path, "params"], state);
}

/**
 * Serializes Parameters (section 4.1.1.2); a `true` value writes the bare key.
 *
 * @param params - The parameters, absent for none
 * @param path - Where the parameters sit
 * @param state - The shared failure slot
 * @returns The text, each parameter prefixed with `;`
 */
function serializeParameters(params: SF.Parameters | undefined, path: Path, state: Failed): string {
	if (params === undefined) return "";
	if (!isRecord(params)) return reject(state, "Parameters must be an object", path);
	let output = "";
	for (let key of Object.keys(params)) {
		let value = params[key];
		output += `;${serializeKey(key, [...path, key], state)}`;
		if (value !== true) output += `=${serializeBareItem(value, [...path, key], state)}`;
	}
	return output;
}

/**
 * Serializes a key (section 4.1.1.3).
 *
 * @param key - The key
 * @param path - Where the keyed value sits
 * @param state - The shared failure slot
 * @returns The key
 */
function serializeKey(key: string, path: Path, state: Failed): string {
	if (!KEY.test(key)) {
		return reject(
			state,
			"Key must be lowercase letters, digits, `_-.*`, first a letter or `*`",
			path,
		);
	}
	return key;
}

/**
 * Serializes a bare item (section 4.1.3.1), choosing the type from the JavaScript value.
 * A `number` that is an integer is an Integer, and any other `number` a Decimal.
 *
 * @param value - The bare item
 * @param path - Where it sits
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeBareItem(value: unknown, path: Path, state: Failed): string {
	if (typeof value === "number") {
		return Number.isInteger(value)
			? serializeInteger(value, path, state)
			: serializeDecimal(value, path, state);
	}
	if (value instanceof Decimal) return serializeDecimal(value.value, path, state);
	if (typeof value === "string") return serializeString(value, path, state);
	if (value instanceof Token) return serializeToken(value.value, path, state);
	if (value instanceof Uint8Array) return `:${encodeBase64(value)}:`;
	if (typeof value === "boolean") return value ? "?1" : "?0";
	if (value instanceof Date) return serializeDate(value, path, state);
	if (value instanceof DisplayString) return serializeDisplayString(value.value, path, state);
	return reject(state, "Value is not a Structured Field bare item", path);
}

/**
 * Serializes an Integer (section 4.1.4), at most fifteen digits.
 *
 * @param value - An integral number
 * @param path - Where it sits
 * @param state - The shared failure slot
 * @returns The digits, `-` first when negative
 */
function serializeInteger(value: number, path: Path, state: Failed): string {
	if (Math.abs(value) > MAX_INTEGER)
		return reject(state, "Integer is outside ±999,999,999,999,999", path);
	return String(value + 0);
}

/**
 * Serializes a Decimal (section 4.1.5): rounded half-to-even to three fractional digits,
 * at most twelve integer digits, trailing fractional zeros dropped but one digit kept.
 * Rounding works on the number's shortest decimal representation, so `0.0025` rounds as
 * the decimal text it was written as, to `0.002`.
 *
 * @param value - The number
 * @param path - Where it sits
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeDecimal(value: number, path: Path, state: Failed): string {
	if (!Number.isFinite(value)) return reject(state, "Decimal must be a finite number", path);
	let magnitude = Math.abs(value);
	if (magnitude >= 1e12) return reject(state, "Decimal has more than 12 integer digits", path);

	let thousandths = roundToThousandths(magnitude);
	let integer = thousandths / 1000n;
	if (integer.toString().length > MAX_DECIMAL_INTEGER_DIGITS) {
		return reject(state, "Decimal has more than 12 integer digits", path);
	}
	let fraction = (thousandths % 1000n).toString().padStart(3, "0").replace(/0+$/, "") || "0";
	return `${value < 0 ? "-" : ""}${integer}.${fraction}`;
}

/**
 * Rounds a non-negative number below 1e12 to a whole count of thousandths, half-to-even,
 * reading its digits from `toString` so the rounding sees the decimal the caller wrote.
 *
 * @param magnitude - The absolute value
 * @returns Thousandths, as a bigint to keep every digit exact
 */
function roundToThousandths(magnitude: number): bigint {
	if (magnitude < 1e-6) return 0n;
	let [whole = "0", fraction = ""] = magnitude.toString().split(".");
	let kept = BigInt(whole + fraction.slice(0, 3).padEnd(3, "0"));
	let rest = fraction.slice(3);
	if (rest === "") return kept;

	let first = rest.charCodeAt(0) - 48;
	let beyondHalf = /[1-9]/.test(rest.slice(1));
	if (first > 5 || (first === 5 && (beyondHalf || kept % 2n === 1n))) return kept + 1n;
	return kept;
}

/**
 * Serializes a String (section 4.1.6): visible ASCII and space, escaping `"` and `\`.
 *
 * @param value - The string
 * @param path - Where it sits
 * @param state - The shared failure slot
 * @returns The quoted text
 */
function serializeString(value: string, path: Path, state: Failed): string {
	if (!STRING_CHARS.test(value)) {
		return reject(state, "String may only carry visible ASCII and space; use DisplayString", path);
	}
	return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

/**
 * Serializes a Token (section 4.1.7).
 *
 * @param value - The token text
 * @param path - Where it sits
 * @param state - The shared failure slot
 * @returns The token
 */
function serializeToken(value: string, path: Path, state: Failed): string {
	if (!TOKEN.test(value)) return reject(state, "Token breaks the token grammar", path);
	return value;
}

/**
 * Serializes a Date (section 4.1.10): `@` and whole seconds since the epoch.
 *
 * @param value - The Date
 * @param path - Where it sits
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeDate(value: Date, path: Path, state: Failed): string {
	let time = value.getTime();
	if (Number.isNaN(time)) return reject(state, "Date is invalid", path);
	if (time % 1000 !== 0) return reject(state, "Date must be whole seconds", path);
	return `@${serializeInteger(time / 1000, path, state)}`;
}

/**
 * Serializes a Display String (section 4.1.11): `%"`, then each UTF-8 octet as itself
 * when it is visible ASCII other than `%` and `"`, and as lowercase `%xx` otherwise.
 *
 * @param value - The Unicode text
 * @param path - Where it sits
 * @param state - The shared failure slot
 * @returns The text
 */
function serializeDisplayString(value: string, path: Path, state: Failed): string {
	if (LONE_SURROGATE.test(value))
		return reject(state, "Display String has an unpaired surrogate", path);
	let output = '%"';
	for (let octet of UTF8.encode(value)) {
		if (octet === 0x25 || octet === 0x22 || octet < 0x20 || octet > 0x7e) {
			output += `%${octet.toString(16).padStart(2, "0")}`;
		} else {
			output += String.fromCharCode(octet);
		}
	}
	return `${output}"`;
}
