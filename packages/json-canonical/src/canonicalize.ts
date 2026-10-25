/**
 * The RFC 8785 JSON Canonicalization Scheme: one serialization per JSON value, so two
 * parties that hash or sign the same data agree on the bytes regardless of member order,
 * whitespace or number spelling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { stringify } from "@sdxc/json-pointer";
import { failure, isFailure, success } from "@sdxc/result";

/** A UTF-16 surrogate without its pair; in `u` mode a valid pair reads as one code point. */
const LONE_SURROGATE = /\p{Cs}/u;

/** A value JCS cannot serialize; `pointer` is the RFC 6901 JSON Pointer to it. */
export class CanonicalJsonError extends Error {
	override name = "CanonicalJsonError";

	/** Where the offending value sits in the input, `""` for the input itself. */
	readonly pointer: string;

	/**
	 * @param pointer - The offending value's location.
	 * @param message - What is wrong with it.
	 */
	constructor(pointer: string, message: string) {
		super(pointer === "" ? message : `${pointer}: ${message}`);
		this.pointer = pointer;
	}
}

/** The location of the value being written, outermost segment first. */
type Path = (string | number)[];

/**
 * Serializes `value` per RFC 8785: no whitespace, members sorted by the UTF-16 code units of
 * their names at every depth, numbers and strings as `JSON.stringify` writes them. Input must
 * be I-JSON (RFC 7493); encode the result as UTF-8 before hashing or signing it.
 *
 * @param value - Parsed JSON or a value built in code.
 * @returns The canonical text, or the first value that has none: `NaN`, `Infinity`, a lone
 * surrogate, `undefined`, a cycle, or anything but plain objects, arrays and JSON scalars.
 * @example canonicalize({ b: [1.50, "€"], a: null }); // success('{"a":null,"b":[1.5,"€"]}')
 */
export function canonicalize(value: unknown): Result<string, CanonicalJsonError> {
	return write(value, [], new Set());
}

/** The canonical text of one value at `path`; `ancestors` holds the containers above it. */
function write(
	value: unknown,
	path: Path,
	ancestors: Set<object>,
): Result<string, CanonicalJsonError> {
	if (value === null) return success("null");
	switch (typeof value) {
		case "boolean":
			return success(value ? "true" : "false");
		case "number":
			if (!Number.isFinite(value)) return refuse(path, `${value} is not a JSON number.`);
			return success(JSON.stringify(value));
		case "string":
			return writeString(value, path);
		case "object":
			if (ancestors.has(value)) return refuse(path, "The value contains itself.");
			ancestors.add(value);
			let text = Array.isArray(value)
				? writeArray(value, path, ancestors)
				: writeObject(value, path, ancestors);
			ancestors.delete(value);
			return text;
		default:
			return refuse(path, `A ${typeof value} is not a JSON value.`);
	}
}

/** Section 3.2.2.2: `JSON.stringify`'s escaping, once the string is known to be well-formed. */
function writeString(value: string, path: Path): Result<string, CanonicalJsonError> {
	if (LONE_SURROGATE.test(value)) return refuse(path, "The string holds a lone surrogate.");
	return success(JSON.stringify(value));
}

/** Section 3.2.3: elements keep their order; a hole in a sparse array is `undefined`. */
function writeArray(
	value: unknown[],
	path: Path,
	ancestors: Set<object>,
): Result<string, CanonicalJsonError> {
	let items: string[] = [];
	for (let index = 0; index < value.length; index++) {
		let item = write(value[index], [...path, index], ancestors);
		if (isFailure(item)) return item;
		items.push(item.data);
	}
	return success(`[${items.join(",")}]`);
}

/**
 * Section 3.2.3: members sorted by name, where the default sort already compares UTF-16
 * code units as unsigned integers, independent of locale.
 */
function writeObject(
	value: object,
	path: Path,
	ancestors: Set<object>,
): Result<string, CanonicalJsonError> {
	let prototype: unknown = Object.getPrototypeOf(value);
	if (prototype !== Object.prototype && prototype !== null) {
		return refuse(path, "Only plain objects and arrays are JSON containers.");
	}
	let record = value as Record<string, unknown>;
	let members: string[] = [];
	for (let key of Object.keys(record).sort()) {
		let name = writeString(key, [...path, key]);
		if (isFailure(name)) return name;
		let member = write(record[key], [...path, key], ancestors);
		if (isFailure(member)) return member;
		members.push(`${name.data}:${member.data}`);
	}
	return success(`{${members.join(",")}}`);
}

/** The failure for the value at `path`. */
function refuse(path: Path, message: string): Result<never, CanonicalJsonError> {
	return failure(new CanonicalJsonError(stringify(path), message));
}
