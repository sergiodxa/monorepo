/**
 * The RFC 9651 section 4.2 parsing algorithms, step by step: the three top-level types,
 * inner lists, parameters, keys and the eight bare item types. Any failure fails the whole
 * field, so each step either returns its value or the `FAILED` marker with the reason set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { SF } from "./types.js";

import { decodeBase64 } from "./base64.js";
import { StructuredFieldParseError } from "./errors.js";
import { Decimal, DisplayString, Token } from "./values.js";

/** Returned by a step that failed; the reason sits on the cursor. */
const FAILED: unique symbol = Symbol("failed");

/** A step's outcome. */
type Step<T> = T | typeof FAILED;

/** Characters a Token may continue with: `tchar`, `:` and `/`. */
const TOKEN_CHAR = /^[!#$%&'*+\-.^_`|~0-9A-Za-z:/]$/;

/** Characters a key may continue with. */
const KEY_CHAR = /^[a-z0-9_\-.*]$/;

/** Characters a Byte Sequence's base64 content may use. */
const BASE64_CONTENT = /^[A-Za-z0-9+/=]*$/;

/** Anything outside visible ASCII and space, which a field value may not carry. */
const NON_ASCII = /[^\x20-\x7e\t]/;

/** Lowercase hex digits, the only form a Display String's percent-escapes may take. */
const LOWER_HEX = /^[0-9a-f]{2}$/;

/** Decodes a Display String's octets, refusing invalid UTF-8 and keeping a leading BOM. */
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * The parser's position in the field value, and the first failure it met.
 */
class Cursor {
	readonly text: string;
	position = 0;
	error: StructuredFieldParseError | null = null;

	/**
	 * @param text - The field value, several lines already joined with `,`
	 */
	constructor(text: string) {
		this.text = text;
	}

	/** @returns The next character without consuming it, `""` at the end */
	peek(): string {
		return this.text.charAt(this.position);
	}

	/** @returns The next character, consumed, `""` at the end */
	next(): string {
		let char = this.text.charAt(this.position);
		this.position++;
		return char;
	}

	/** @returns Whether every character has been consumed */
	get done(): boolean {
		return this.position >= this.text.length;
	}

	/** Skips spaces, the only whitespace allowed between most tokens. */
	skipSpaces(): void {
		while (this.peek() === " ") this.position++;
	}

	/** Skips optional whitespace (spaces and tabs), allowed around List and Dictionary commas. */
	skipOWS(): void {
		while (this.peek() === " " || this.peek() === "\t") this.position++;
	}

	/**
	 * Records the failure and returns the marker, so a step writes `return cursor.fail(…)`.
	 *
	 * @param message - Why parsing stopped
	 * @returns The failure marker
	 */
	fail(message: string): typeof FAILED {
		this.error ??= new StructuredFieldParseError(message, this.position);
		return FAILED;
	}
}

/**
 * Parses a field value as its definition's top-level type (RFC 9651 section 4.2).
 *
 * @param text - The field value, several field lines joined with `,`
 * @param type - The top-level type the field's definition fixes
 * @returns The model, or where the text stops being valid
 */
export function parseField<Type extends SF.FieldType>(
	text: string,
	type: Type,
): Result<SF.ValueOf[Type], StructuredFieldParseError> {
	let cursor = new Cursor(text);
	let invalid = NON_ASCII.exec(text);
	if (invalid) {
		cursor.position = invalid.index;
		cursor.fail("Field value contains a character outside visible ASCII");
		return failure(cursor.error ?? new StructuredFieldParseError("Invalid field", 0));
	}

	cursor.skipSpaces();
	let value: Step<SF.ValueOf[SF.FieldType]>;
	if (type === "list") value = parseList(cursor);
	else if (type === "dictionary") value = parseDictionary(cursor);
	else value = parseItem(cursor);

	if (value !== FAILED) {
		cursor.skipSpaces();
		if (!cursor.done) value = cursor.fail("Unexpected character after the field value");
	}

	if (value === FAILED) {
		return failure(cursor.error ?? new StructuredFieldParseError("Invalid field", cursor.position));
	}
	return success(value as SF.ValueOf[Type]);
}

/**
 * Parses a List (section 4.2.1); a trailing comma fails, an empty value is an empty List.
 *
 * @param cursor - The parser state
 * @returns The members in field order
 */
function parseList(cursor: Cursor): Step<SF.List> {
	let members: SF.List = [];
	while (!cursor.done) {
		let member = parseMember(cursor);
		if (member === FAILED) return FAILED;
		members.push(member);

		cursor.skipOWS();
		if (cursor.done) return members;
		if (cursor.next() !== ",") return cursor.fail("Expected `,` between List members");
		cursor.skipOWS();
		if (cursor.done) return cursor.fail("Trailing `,` after the last List member");
	}
	return members;
}

/**
 * Parses a Dictionary (section 4.2.2). A key without `=` is the Boolean `true`, and a
 * repeated key overwrites the earlier value in the earlier position, which assignment onto
 * a null-prototype object does by itself.
 *
 * @param cursor - The parser state
 * @returns The members keyed in field order
 */
function parseDictionary(cursor: Cursor): Step<SF.Dictionary> {
	let dictionary: SF.Dictionary = Object.create(null);
	while (!cursor.done) {
		let key = parseKey(cursor);
		if (key === FAILED) return FAILED;

		let member: Step<SF.Member>;
		if (cursor.peek() === "=") {
			cursor.next();
			member = parseMember(cursor);
		} else {
			let params = parseParameters(cursor);
			member = params === FAILED ? FAILED : { value: true, params };
		}
		if (member === FAILED) return FAILED;
		dictionary[key] = member;

		cursor.skipOWS();
		if (cursor.done) return dictionary;
		if (cursor.next() !== ",") return cursor.fail("Expected `,` between Dictionary members");
		cursor.skipOWS();
		if (cursor.done) return cursor.fail("Trailing `,` after the last Dictionary member");
	}
	return dictionary;
}

/**
 * Parses an Item or an Inner List, whichever the next character starts.
 *
 * @param cursor - The parser state
 * @returns The member
 */
function parseMember(cursor: Cursor): Step<SF.Member> {
	return cursor.peek() === "(" ? parseInnerList(cursor) : parseItem(cursor);
}

/**
 * Parses an Inner List (section 4.2.1.2): items separated by spaces inside parentheses,
 * then the list's own parameters.
 *
 * @param cursor - The parser state
 * @returns The Inner List
 */
function parseInnerList(cursor: Cursor): Step<SF.InnerList> {
	cursor.next();
	let items: SF.Item[] = [];
	while (!cursor.done) {
		cursor.skipSpaces();
		if (cursor.peek() === ")") {
			cursor.next();
			let params = parseParameters(cursor);
			if (params === FAILED) return FAILED;
			return { items, params };
		}

		let item = parseItem(cursor);
		if (item === FAILED) return FAILED;
		items.push(item);

		let after = cursor.peek();
		if (after !== " " && after !== ")") return cursor.fail("Expected a space or `)` in Inner List");
	}
	return cursor.fail("Inner List is missing its closing `)`");
}

/**
 * Parses an Item (section 4.2.3): a bare item, then its parameters.
 *
 * @param cursor - The parser state
 * @returns The Item
 */
function parseItem(cursor: Cursor): Step<SF.Item> {
	let value = parseBareItem(cursor);
	if (value === FAILED) return FAILED;
	let params = parseParameters(cursor);
	if (params === FAILED) return FAILED;
	return { value, params };
}

/**
 * Parses Parameters (section 4.2.3.2); a key without `=` is the Boolean `true`, and a
 * repeated key overwrites the earlier value in the earlier position.
 *
 * @param cursor - The parser state
 * @returns The parameters in field order, on a null-prototype object
 */
function parseParameters(cursor: Cursor): Step<SF.Parameters> {
	let params: SF.Parameters = Object.create(null);
	while (cursor.peek() === ";") {
		cursor.next();
		cursor.skipSpaces();
		let key = parseKey(cursor);
		if (key === FAILED) return FAILED;

		let value: Step<SF.BareItem> = true;
		if (cursor.peek() === "=") {
			cursor.next();
			value = parseBareItem(cursor);
			if (value === FAILED) return FAILED;
		}
		params[key] = value;
	}
	return params;
}

/**
 * Parses a key (section 4.2.3.3): a lowercase letter or `*`, then lowercase letters,
 * digits, `_`, `-`, `.` and `*`.
 *
 * @param cursor - The parser state
 * @returns The key
 */
function parseKey(cursor: Cursor): Step<string> {
	let first = cursor.peek();
	if (!/^[a-z*]$/.test(first)) return cursor.fail("Key must start with a lowercase letter or `*`");
	let start = cursor.position;
	while (KEY_CHAR.test(cursor.peek())) cursor.position++;
	return cursor.text.slice(start, cursor.position);
}

/**
 * Parses a bare item (section 4.2.3.1), choosing the type from its first character.
 *
 * @param cursor - The parser state
 * @returns The bare item
 */
function parseBareItem(cursor: Cursor): Step<SF.BareItem> {
	let char = cursor.peek();
	if (char === "-" || /^[0-9]$/.test(char)) return parseNumber(cursor);
	if (char === '"') return parseString(cursor);
	if (char === "*" || /^[A-Za-z]$/.test(char)) return parseToken(cursor);
	if (char === ":") return parseByteSequence(cursor);
	if (char === "?") return parseBoolean(cursor);
	if (char === "@") return parseDate(cursor);
	if (char === "%") return parseDisplayString(cursor);
	return cursor.fail("Expected a bare item");
}

/**
 * Parses an Integer or Decimal (section 4.2.4): at most 15 digits for an Integer, at most
 * 12 integer and 3 fractional digits for a Decimal. Negative zero reads as zero.
 *
 * @param cursor - The parser state
 * @returns A `number` for an Integer, a `Decimal` for a Decimal
 */
function parseNumber(cursor: Cursor): Step<number | Decimal> {
	let sign = 1;
	if (cursor.peek() === "-") {
		cursor.next();
		sign = -1;
	}
	if (!/^[0-9]$/.test(cursor.peek())) return cursor.fail("Expected a digit");

	let digits = "";
	let isDecimal = false;
	while (!cursor.done) {
		let char = cursor.peek();
		if (/^[0-9]$/.test(char)) {
			digits += char;
		} else if (!isDecimal && char === ".") {
			if (digits.length > 12) return cursor.fail("Decimal has more than 12 integer digits");
			digits += char;
			isDecimal = true;
		} else {
			break;
		}
		cursor.next();
		if (!isDecimal && digits.length > 15) return cursor.fail("Integer has more than 15 digits");
		if (isDecimal && digits.length > 16) return cursor.fail("Decimal has too many digits");
	}

	if (!isDecimal) return sign * Number(digits) + 0;
	if (digits.endsWith(".")) return cursor.fail("Decimal ends with `.`");
	if (digits.length - digits.indexOf(".") - 1 > 3) {
		return cursor.fail("Decimal has more than 3 fractional digits");
	}
	return new Decimal(sign * Number(digits) + 0);
}

/**
 * Parses a String (section 4.2.5): visible ASCII and space between double quotes, with
 * only `"` and `\` escaped.
 *
 * @param cursor - The parser state
 * @returns The unescaped string
 */
function parseString(cursor: Cursor): Step<string> {
	cursor.next();
	let output = "";
	while (!cursor.done) {
		let char = cursor.next();
		if (char === "\\") {
			if (cursor.done) return cursor.fail("String ends inside an escape");
			let escaped = cursor.next();
			if (escaped !== '"' && escaped !== "\\") return cursor.fail("Invalid escape in String");
			output += escaped;
		} else if (char === '"') {
			return output;
		} else if (char < " " || char > "~") {
			return cursor.fail("String contains a character outside visible ASCII");
		} else {
			output += char;
		}
	}
	return cursor.fail('String is missing its closing `"`');
}

/**
 * Parses a Token (section 4.2.6).
 *
 * @param cursor - The parser state
 * @returns The Token
 */
function parseToken(cursor: Cursor): Step<Token> {
	let start = cursor.position;
	cursor.next();
	while (TOKEN_CHAR.test(cursor.peek())) cursor.position++;
	return new Token(cursor.text.slice(start, cursor.position));
}

/**
 * Parses a Byte Sequence (section 4.2.7): base64 between colons.
 *
 * @param cursor - The parser state
 * @returns The bytes
 */
function parseByteSequence(cursor: Cursor): Step<Uint8Array> {
	cursor.next();
	let end = cursor.text.indexOf(":", cursor.position);
	if (end === -1) return cursor.fail("Byte Sequence is missing its closing `:`");
	let content = cursor.text.slice(cursor.position, end);
	if (!BASE64_CONTENT.test(content)) return cursor.fail("Byte Sequence is not base64");
	let bytes = decodeBase64(content);
	if (bytes === null) return cursor.fail("Byte Sequence is not valid base64");
	cursor.position = end + 1;
	return bytes;
}

/**
 * Parses a Boolean (section 4.2.8): `?1` or `?0`.
 *
 * @param cursor - The parser state
 * @returns The Boolean
 */
function parseBoolean(cursor: Cursor): Step<boolean> {
	cursor.next();
	let char = cursor.next();
	if (char === "1") return true;
	if (char === "0") return false;
	cursor.position--;
	return cursor.fail("Boolean must be `?1` or `?0`");
}

/**
 * Parses a Date (section 4.2.9): `@` and an Integer of seconds since the epoch. A value
 * outside the range a JavaScript `Date` holds fails, which the RFC permits.
 *
 * @param cursor - The parser state
 * @returns The Date
 */
function parseDate(cursor: Cursor): Step<Date> {
	cursor.next();
	let seconds = parseNumber(cursor);
	if (seconds === FAILED) return FAILED;
	if (typeof seconds !== "number") return cursor.fail("Date must be an Integer");
	let date = new Date(seconds * 1000);
	if (Number.isNaN(date.getTime())) return cursor.fail("Date is outside the supported range");
	return date;
}

/**
 * Parses a Display String (section 4.2.10): `%"`, visible ASCII with UTF-8 octets
 * percent-encoded in lowercase hex, and `"`. Invalid UTF-8 fails.
 *
 * @param cursor - The parser state
 * @returns The Display String
 */
function parseDisplayString(cursor: Cursor): Step<DisplayString> {
	cursor.next();
	if (cursor.next() !== '"') return cursor.fail('Display String must start with `%"`');
	let octets: number[] = [];
	while (!cursor.done) {
		let char = cursor.next();
		if (char < " " || char > "~") {
			return cursor.fail("Display String contains a character outside visible ASCII");
		}
		if (char === "%") {
			let hex = cursor.text.slice(cursor.position, cursor.position + 2);
			if (!LOWER_HEX.test(hex)) return cursor.fail("Display String escape must be lowercase hex");
			octets.push(Number.parseInt(hex, 16));
			cursor.position += 2;
		} else if (char === '"') {
			let text = decodeUtf8(new Uint8Array(octets));
			if (text === null) return cursor.fail("Display String is not valid UTF-8");
			return new DisplayString(text);
		} else {
			octets.push(char.charCodeAt(0));
		}
	}
	return cursor.fail('Display String is missing its closing `"`');
}

/**
 * Decodes UTF-8 octets strictly.
 *
 * @param octets - The decoded percent-escapes and literal characters
 * @returns The text, or `null` for an invalid sequence
 */
function decodeUtf8(octets: Uint8Array): string | null {
	try {
		return UTF8.decode(octets);
	} catch {
		return null;
	}
}
