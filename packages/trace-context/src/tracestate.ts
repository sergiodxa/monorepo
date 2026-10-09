/**
 * The `tracestate` header of W3C Trace Context: up to 32 vendor-owned `key=value` entries,
 * ordered so the most recently updated vendor sits on the left. Parsing validates the key and
 * value grammar; `stringify` applies the specification's truncation order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** The most list-members one `tracestate` may carry. */
const MAX_ENTRIES = 32;

/** Where a propagator may truncate the header, per the specification's recommendation. */
const DEFAULT_MAX_LENGTH = 512;

/** Entries longer than this are the first dropped when the header must be truncated. */
const OVERSIZED_ENTRY = 128;

/**
 * `simple-key` (an `lcalpha` then up to 255 of `a-z0-9_-*\/`), or `tenant@system` with a
 * tenant of up to 241 characters and a system of up to 14.
 */
const KEY_PATTERN =
	/^(?:[a-z][a-z0-9_\-*/]{0,255}|[a-z0-9][a-z0-9_\-*/]{0,240}@[a-z][a-z0-9_\-*/]{0,13})$/;

/** One to 256 printable ASCII characters other than `,` and `=`, ending in a non-space. */
const VALUE_PATTERN = /^[\x20-\x2b\x2d-\x3c\x3e-\x7e]{0,255}[\x21-\x2b\x2d-\x3c\x3e-\x7e]$/;

/** Keys the constructor for already validated entries to this module, keeping the class sound. */
const FROM_VALIDATED = Symbol("TraceState.fromValidated");

export namespace TraceState {
	/** Which rule a header or an entry broke. */
	export type ErrorCode =
		| "malformed"
		| "invalid-key"
		| "invalid-value"
		| "duplicate-key"
		| "too-many";

	export interface StringifyOptions {
		/**
		 * The longest header to write; entries are dropped to fit, never cut.
		 * @default 512
		 */
		maxLength?: number;
	}
}

/** A `tracestate` value or entry that breaks the grammar; a receiver discards the whole header. */
export class TraceStateParseError extends Error {
	override name = "TraceStateParseError";

	/** Which rule was broken. */
	readonly code: TraceState.ErrorCode;

	/**
	 * @param code Which rule was broken.
	 * @param message What was wrong, for a log.
	 */
	constructor(code: TraceState.ErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

/** Checks one entry against the key and value grammar, naming the first rule it breaks. */
function validate(key: string, value: string): TraceStateParseError | undefined {
	if (!KEY_PATTERN.test(key)) {
		return new TraceStateParseError(
			"invalid-key",
			`tracestate key ${JSON.stringify(key)} is invalid`,
		);
	}
	if (!VALUE_PATTERN.test(value)) {
		return new TraceStateParseError("invalid-value", `tracestate value for ${key} is invalid`);
	}
	return undefined;
}

/**
 * An ordered, immutable list of vendor entries; the leftmost is the most recently updated.
 * Every change returns a new state, so a state bound to a trace is safe to share.
 *
 * @example let state = unwrap(TraceState.EMPTY.set("rojo", "00f067aa0ba902b7"));
 */
export class TraceState {
	/** The state of a trace nobody upstream wrote vendor entries for. */
	static readonly EMPTY: TraceState = new TraceState([]);

	readonly #entries: ReadonlyArray<readonly [string, string]>;

	/** @param entries Already validated, unique, leftmost first. */
	private constructor(entries: ReadonlyArray<readonly [string, string]>) {
		this.#entries = entries;
	}

	/**
	 * Builds a state from entries already known to be valid and unique.
	 * @param entries Leftmost first.
	 */
	static [FROM_VALIDATED](entries: ReadonlyArray<readonly [string, string]>): TraceState {
		return entries.length === 0 ? TraceState.EMPTY : new TraceState(entries);
	}

	/** How many vendor entries the state holds, at most 32. */
	get size(): number {
		return this.#entries.length;
	}

	/** @param key The vendor key to read. */
	get(key: string): string | undefined {
		return this.#entries.find(([candidate]) => candidate === key)?.[1];
	}

	/**
	 * A new state with `key` first, as a vendor updating its own entry must do. Refused when
	 * the key or value breaks the grammar, or when adding a new key would pass 32 entries.
	 *
	 * @param key The vendor key.
	 * @param value The vendor's value.
	 */
	set(key: string, value: string): Result<TraceState, TraceStateParseError> {
		let invalid = validate(key, value);
		if (invalid !== undefined) return failure(invalid);

		let rest = this.#entries.filter(([candidate]) => candidate !== key);
		if (rest.length >= MAX_ENTRIES) {
			return failure(new TraceStateParseError("too-many", "tracestate holds 32 entries already"));
		}

		return success(new TraceState([[key, value], ...rest]));
	}

	/**
	 * A new state without `key`; this same state when it had none.
	 * @param key The vendor key to drop.
	 */
	delete(key: string): TraceState {
		if (this.get(key) === undefined) return this;
		return TraceState[FROM_VALIDATED](this.#entries.filter(([candidate]) => candidate !== key));
	}

	/**
	 * The entries leftmost first, which is the order they are written in.
	 * @yields Each `[key, value]` pair.
	 */
	*entries(): IterableIterator<[key: string, value: string]> {
		for (let [key, value] of this.#entries) yield [key, value];
	}
}

/**
 * Strips the optional whitespace (spaces and tabs) allowed around each list-member, scanning
 * once from each end so the cost stays linear however much whitespace a member carries.
 */
function trimOws(text: string): string {
	let start = 0;
	let end = text.length;
	while (start < end && (text[start] === " " || text[start] === "\t")) start++;
	while (end > start && (text[end - 1] === " " || text[end - 1] === "\t")) end--;
	return text.slice(start, end);
}

/**
 * Parses one `tracestate` value. Multiple header fields arrive joined by commas from
 * `Headers.get()`, which is the form read here; empty and whitespace-only members are skipped.
 *
 * @param value The header value.
 * @returns The state, or the first rule the value broke.
 * @example parse("rojo=00f067aa0ba902b7,congo=t61rcWkgMzE");
 */
export function parse(value: string): Result<TraceState, TraceStateParseError> {
	let entries: Array<readonly [string, string]> = [];
	let seen = new Set<string>();

	for (let raw of value.split(",")) {
		let member = trimOws(raw);
		if (member === "") continue;

		let parts = member.split("=");
		if (parts.length !== 2) {
			return failure(new TraceStateParseError("malformed", "tracestate member is not key=value"));
		}

		let [key = "", entry = ""] = parts;
		let invalid = validate(key, entry);
		if (invalid !== undefined) return failure(invalid);

		if (seen.has(key)) {
			return failure(new TraceStateParseError("duplicate-key", `tracestate repeats ${key}`));
		}
		seen.add(key);

		entries.push([key, entry]);
		if (entries.length > MAX_ENTRIES) {
			return failure(new TraceStateParseError("too-many", "tracestate has more than 32 entries"));
		}
	}

	return success(TraceState[FROM_VALIDATED](entries));
}

/** The header length a list of written members joins to. */
function joinedLength(members: string[]): number {
	return (
		members.reduce((total, member) => total + member.length, 0) + Math.max(0, members.length - 1)
	);
}

/**
 * Writes the list, truncating to `maxLength` by dropping entries over 128 characters first,
 * rightmost first, and then the rightmost entries until it fits. The empty state writes `""`,
 * which a caller skips rather than sending an empty header.
 *
 * @param state The state to write.
 * @param options The length to truncate to.
 * @example headers.set("tracestate", stringify(trace.state));
 */
export function stringify(state: TraceState, options: TraceState.StringifyOptions = {}): string {
	let maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
	let members = [...state.entries()].map(([key, value]) => `${key}=${value}`);

	for (let index = members.length - 1; index >= 0 && joinedLength(members) > maxLength; index--) {
		if ((members[index]?.length ?? 0) > OVERSIZED_ENTRY) members.splice(index, 1);
	}

	while (members.length > 0 && joinedLength(members) > maxLength) members.pop();

	return members.join(",");
}
