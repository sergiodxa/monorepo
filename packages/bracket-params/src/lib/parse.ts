/**
 * Reads a query string or form submission into nested values with bracket syntax (`a[b][]=1`)
 * and validates the result against a Standard Schema, so the fields arrive typed by its output.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Location } from "@sdxc/location";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, isFailure, success } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";

/**
 * What `parse` reads: a string is a query, with or without its leading `?`, and a `URL` or an
 * `@sdxc/location` `Location` is read through its `searchParams`. Only `FormData` carries files.
 */
export type BracketParamsSource = string | URLSearchParams | URL | Location | FormData;

/** Bounds on the work one source can cause; exceeding either fails the parse. */
export interface ParseOptions {
	/**
	 * Bracket segments one key may nest.
	 *
	 * @default 5
	 */
	depth?: number;
	/**
	 * Parameters (or form fields) one source may carry.
	 *
	 * @default 1000
	 */
	parameterLimit?: number;
}

/**
 * A group of entries under one key while the query is read. It becomes an array when every key
 * is an index, which is only known once every parameter is in.
 */
interface Group {
	entries: Map<string, Slot>;
	nextIndex: number;
	indexed: boolean;
}

/** A key's values (repeated keys collect several) or the group nested under it. */
type Slot = FormDataEntryValue[] | Group;

/** A bracketed key: a non-empty root followed by any number of `[segment]`s. */
const BRACKETED_KEY = /^([^[\]]+)((?:\[[^[\]]*\])*)$/;

/** One `[segment]` of a bracketed key. */
const SEGMENT = /\[([^[\]]*)\]/g;

/** An array index in canonical form, so `01` stays an object key and round-trips as written. */
const INDEX = /^(?:0|[1-9]\d{0,14})$/;

/**
 * Reads a query or form into nested values and validates them against a synchronous schema.
 *
 * @param source - The query string, `URLSearchParams`, `URL`, `Location` or `FormData` to read
 * @param schema - Any synchronous Standard Schema; its output types the result
 * @param options - Limits on depth and parameter count
 * @returns The schema's output, or a `ValidationError` carrying the reader's or the schema's issues
 * @example parse(new URL(request.url), s.object({ filter: s.object({ status: s.string() }) }))
 * @example parse("?tags[]=a&tags[]=b", s.object({ tags: s.array(s.string()) }))
 * @example parse(await request.formData(), s.object({ photos: s.array(s.instanceof_(File)) }))
 */
export function parse<Schema extends StandardSchemaV1>(
	source: BracketParamsSource,
	schema: Schema,
	options: ParseOptions = {},
): Result<StandardSchemaV1.InferOutput<Schema>, ValidationError> {
	let value = read(toEntries(source), options);
	if (isFailure(value)) return value;

	let result = schema["~standard"].validate(value.data);
	if (result instanceof Promise) {
		result.catch(() => undefined);
		return failure(new ValidationError([{ message: "Expected a synchronous schema" }]));
	}

	if (result.issues) return failure(new ValidationError(result.issues));
	return success(result.value);
}

/** Every source but a string already holds its entries; a `URL` or `Location` holds its query's. */
function toEntries(source: BracketParamsSource): Iterable<[string, FormDataEntryValue]> {
	if (typeof source === "string") return new URLSearchParams(source);
	if (source instanceof FormData || source instanceof URLSearchParams) return source;
	return source.searchParams;
}

/**
 * Builds the nested value from every entry, failing on the first limit exceeded or key used
 * both as a value and as a group. A parameter with a `__proto__` segment is dropped, so the value
 * can never carry a key that rewrites an object's prototype when copied.
 */
function read(
	params: Iterable<[string, FormDataEntryValue]>,
	{ depth = 5, parameterLimit = 1000 }: ParseOptions,
): Result<Record<string, unknown>, ValidationError> {
	let root: Group = createGroup();
	let count = 0;

	for (let [key, value] of params) {
		count += 1;
		if (count > parameterLimit) {
			return failure(
				new ValidationError([{ message: `Expected at most ${parameterLimit} parameters` }]),
			);
		}

		let segments = splitKey(key);
		if (segments.includes("__proto__")) continue;

		if (segments.length - 1 > depth) {
			return failure(
				new ValidationError([
					{ message: `Expected at most ${depth} nested segments`, path: [key] },
				]),
			);
		}

		let conflict = assign(root, segments, value);
		if (conflict) {
			return failure(
				new ValidationError([
					{ message: `Expected a value or a group, "${key}" makes it both`, path: conflict },
				]),
			);
		}
	}

	return success(toObject(root));
}

/**
 * Splits a key into its root and bracket segments; a key that does not follow the syntax exactly
 * (`a[b`, `[a]`, `a]`) is one literal segment, so no parameter is lost.
 */
function splitKey(key: string): string[] {
	let match = BRACKETED_KEY.exec(key);
	if (!match?.[1]) return [key];
	let segments = [match[1]];
	for (let segment of (match[2] ?? "").matchAll(SEGMENT)) segments.push(segment[1] ?? "");
	return segments;
}

/**
 * Stores one value at the path its segments name, where an empty segment past the root pushes
 * onto its group.
 *
 * @returns The path of the key already holding the other kind of slot, or `null` when stored
 */
function assign(root: Group, segments: string[], value: FormDataEntryValue): string[] | null {
	let group = root;
	let path: string[] = [];

	for (let [position, segment] of segments.entries()) {
		let key = position > 0 && segment === "" ? String(group.nextIndex) : segment;
		track(group, key);
		path.push(key);

		let slot = group.entries.get(key);
		if (position === segments.length - 1) {
			if (slot === undefined) group.entries.set(key, [value]);
			else if (Array.isArray(slot)) slot.push(value);
			else return path;
			return null;
		}

		if (slot === undefined) {
			slot = createGroup();
			group.entries.set(key, slot);
		} else if (Array.isArray(slot)) {
			return path;
		}
		group = slot;
	}

	return null;
}

/** Records whether a group can still become an array, and where its next `[]` push lands. */
function track(group: Group, key: string): void {
	if (INDEX.test(key)) group.nextIndex = Math.max(group.nextIndex, Number(key) + 1);
	else group.indexed = false;
}

/** A group starts as an array candidate and stays one until a non-index key arrives. */
function createGroup(): Group {
	return { entries: new Map(), nextIndex: 0, indexed: true };
}

/** The top level is always an object, since a query's own keys are names. */
function toObject(group: Group): Record<string, unknown> {
	return Object.fromEntries([...group.entries].map(([key, slot]) => [key, settle(slot)]));
}

/**
 * Turns a slot into its final value: one value stays a string, repeated values become an array,
 * and an all-index group becomes an array ordered by index with the gaps closed.
 */
function settle(slot: Slot): unknown {
	if (Array.isArray(slot)) return slot.length === 1 ? slot[0] : [...slot];
	if (!slot.indexed) return toObject(slot);
	return [...slot.entries]
		.sort(([left], [right]) => Number(left) - Number(right))
		.map(([, entry]) => settle(entry));
}
