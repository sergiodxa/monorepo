/**
 * The `traceparent` header of W3C Trace Context: the trace id a whole request shares, the id
 * of the span that sent the call, and the flags byte. Its grammar is fixed-width lowercase hex,
 * read here by hand so a future version still yields the fields version `00` defines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** Characters version `00` spans: `vv-` + 32 + `-` + 16 + `-` + `ff`. */
const VERSION_00_LENGTH = 55;

/** The version-00 fields, anchored at the start so a future version may carry more after them. */
const VERSION_00_PATTERN = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})/;

/** The version the specification reserves as invalid forever. */
const INVALID_VERSION = 0xff;

/** Flag bit 0: the caller may be recording this trace. */
const SAMPLED = 0x01;

/** Flag bit 1, Level 2: the trace id was generated randomly. */
const RANDOM = 0x02;

export namespace TraceParent {
	/** The parsed header: ids as lowercase hex, flags as the raw byte and as booleans. */
	export interface Value {
		version: number;
		/** 32 hex digits, never all zero. */
		traceId: string;
		/** 16 hex digits, never all zero. */
		parentId: string;
		/** The byte as it arrived, bits this version leaves undefined included. */
		flags: number;
		/** Bit 0: the caller may be recording this trace. */
		sampled: boolean;
		/** Bit 1, Level 2: the trace id was generated randomly. */
		random: boolean;
	}

	/**
	 * `malformed` covers a wrong shape or length and uppercase hex; the others name the one
	 * well-formed field whose value the specification forbids.
	 */
	export type ErrorCode =
		| "malformed"
		| "invalid-version"
		| "invalid-trace-id"
		| "invalid-parent-id";
}

/** A `traceparent` value that a receiver must ignore, starting a trace of its own instead. */
export class TraceParentParseError extends Error {
	override name = "TraceParentParseError";

	/** Which rule the value broke. */
	readonly code: TraceParent.ErrorCode;

	/**
	 * @param code Which rule the value broke.
	 * @param message What was wrong, for a log.
	 */
	constructor(code: TraceParent.ErrorCode, message: string) {
		super(message);
		this.code = code;
	}
}

/** Whether a hex id is made only of zeros, the one value the specification forbids for either id. */
function isAllZero(hex: string): boolean {
	return /^0+$/.test(hex);
}

/**
 * Parses one `traceparent` value. A version above `00` is read by the `00` rules, and may
 * carry more after a `-`; version `00` itself must be exactly 55 characters.
 *
 * @param value The header value, as `Headers.get()` returns it.
 * @returns The fields, or the rule the value broke.
 * @example parse("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
 */
export function parse(value: string): Result<TraceParent.Value, TraceParentParseError> {
	let match = VERSION_00_PATTERN.exec(value);
	if (match === null) {
		return failure(new TraceParentParseError("malformed", "traceparent is not well formed"));
	}

	let [, versionHex = "", traceId = "", parentId = "", flagsHex = ""] = match;
	let version = Number.parseInt(versionHex, 16);

	if (version === INVALID_VERSION) {
		return failure(
			new TraceParentParseError("invalid-version", "traceparent version ff is invalid"),
		);
	}

	let exact = value.length === VERSION_00_LENGTH;
	let extended = value.length > VERSION_00_LENGTH && value[VERSION_00_LENGTH] === "-";
	if (!(exact || (version > 0 && extended))) {
		return failure(new TraceParentParseError("malformed", "traceparent has trailing data"));
	}

	if (isAllZero(traceId)) {
		return failure(
			new TraceParentParseError("invalid-trace-id", "traceparent trace id is all zero"),
		);
	}

	if (isAllZero(parentId)) {
		return failure(
			new TraceParentParseError("invalid-parent-id", "traceparent parent id is all zero"),
		);
	}

	let flags = Number.parseInt(flagsHex, 16);

	return success({
		version,
		traceId,
		parentId,
		flags,
		sampled: (flags & SAMPLED) !== 0,
		random: (flags & RANDOM) !== 0,
	});
}

/**
 * Writes version `00` with only the two flags that version defines, so a value read from a
 * future version or with unknown bits set leaves this hop as a well-formed `00` header.
 *
 * @param value The ids and the two flags; a parsed value is accepted as it is.
 * @example stringify({ traceId, parentId: spanId, sampled: true, random: true });
 */
export function stringify(value: Omit<TraceParent.Value, "version" | "flags">): string {
	let flags = (value.sampled ? SAMPLED : 0) | (value.random ? RANDOM : 0);
	return `00-${value.traceId}-${value.parentId}-${flags.toString(16).padStart(2, "0")}`;
}
