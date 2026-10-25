/**
 * RFC 9557 Internet Extended Date/Time Format: an RFC 3339 timestamp followed by a
 * `[time zone]` and `[key=value]` suffix tags. Formatting and parsing are inverses, so
 * a zoned instant stored as text in JSON or a TEXT column reads back as an equal value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { TimeZone } from "./types.js";
import type { ZonedParts } from "./zone.js";

import { InvalidZonedDateTimeError } from "./invalid-zoned-date-time-error.js";
import {
	daysInMonth,
	instantFromParts,
	isValidTimeZone,
	offsetMsAt,
	utcFromParts,
} from "./zone.js";

/**
 * An RFC 3339 `date-time` followed by the raw suffix. Seconds are required, `T` and `Z`
 * may be lowercase as RFC 3339 allows, and a fraction of any length is accepted.
 */
const DATE_TIME_PATTERN =
	/^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})[Tt](?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.(?<fraction>\d+))?(?<offset>[Zz]|[+-]\d{2}:\d{2})(?<suffix>.*)$/s;

/** A whole suffix: zero or more bracketed tags, each free of nested brackets. */
const SUFFIX_PATTERN = /^(?:\[[^[\]]*\])*$/;

/** One bracketed tag with its optional critical flag. */
const TAG_PATTERN = /\[(?<critical>!?)(?<content>[^[\]]*)\]/g;

/** RFC 3339 `time-numoffset`, also the name of an offset time zone. */
const NUMERIC_OFFSET_PATTERN = /^(?<sign>[+-])(?<hours>\d{2}):(?<minutes>\d{2})$/;

/** One `/`-separated `time-zone-part`; `.` and `..` are excluded separately. */
const TIME_ZONE_PART_PATTERN = /^[A-Za-z._][A-Za-z0-9._+-]*$/;

/** RFC 9557 `suffix-key`: lowercase only, with `_` opening an experimental key. */
const SUFFIX_KEY_PATTERN = /^[a-z_][a-z0-9_-]*$/;

/** RFC 9557 `suffix-values`: alphanumeric runs joined by single hyphens. */
const SUFFIX_VALUES_PATTERN = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

/** The registered key naming the calendar a timestamp is preferably presented in. */
const CALENDAR_KEY = "u-ca";

/** Milliseconds in one minute, the unit RFC 3339 offsets are written in. */
const MINUTE_MS = 60_000;

/** One `[key=value]` suffix tag, kept as written so it re-emits unchanged. */
export interface SuffixTag {
	/** Lowercase key, e.g. `"u-ca"` or an experimental `"_foo"`. */
	key: string;
	/** One or more alphanumeric items joined by `-`, case preserved. */
	value: string;
	/** Whether a recipient must reject the timestamp unless it processes this tag. */
	critical: boolean;
}

/**
 * A zoned instant as an IXDTF string carries it. `offset` is the local offset the text
 * asserted, or `null` for `Z` (and `-00:00`), which RFC 9557 reads as "UTC known, local
 * offset unknown", so `Z[Europe/Paris]` keeps its `Z` through a round trip.
 */
export interface ZonedDateTime {
	/** The instant, at millisecond precision. */
	date: Date;
	/** Minutes east of UTC, e.g. `-180` for `-03:00`, or `null` for `Z`. */
	offset: number | null;
	/** An IANA zone such as `"America/Montevideo"`, an offset zone such as `"+08:45"`, or `null`. */
	timeZone: TimeZone | null;
	/** The Unicode calendar identifier from a `u-ca` tag, e.g. `"hebrew"`, or `null`. */
	calendar: string | null;
	/** Every other tag, first occurrence of each key, in the order written. */
	tags: readonly SuffixTag[];
}

/**
 * What `formatZonedDateTime` writes. Every `ZonedDateTime` is one; when `offset` is left
 * out it is the zone's offset at the instant, or `Z` without a zone or when that offset
 * has seconds RFC 3339 cannot write.
 */
export interface ZonedDateTimeInit {
	date: Date;
	offset?: number | null;
	timeZone?: TimeZone | null;
	calendar?: string | null;
	tags?: readonly SuffixTag[];
}

/**
 * How `parseZonedDateTime` treats an elective zone whose offset at the instant differs
 * from the written one: fail, keep the instant and adopt the zone's offset, or keep the
 * wall clock and move the instant to where the zone's current rules put it.
 */
export type InconsistentOffsetPolicy = "reject" | "keepInstant" | "keepWallClock";

/** Choices for reading suffix tags the application itself defines. */
export interface ParseZonedDateTimeOptions {
	/**
	 * Keys this application processes: a critical tag with one of them is accepted, and an
	 * experimental `_` key is accepted only when listed, as RFC 9557 requires.
	 */
	keys?: readonly string[];
	/**
	 * Applies to an elective zone only; a critical zone that disagrees always fails.
	 * @default "reject"
	 */
	onInconsistentOffset?: InconsistentOffsetPolicy;
}

/** Choices for writing an IXDTF string. */
export interface FormatZonedDateTimeOptions {
	/**
	 * Marks the zone and calendar tags critical (`[!America/Montevideo]`), so a recipient
	 * that cannot honour them, or finds the zone disagreeing with the offset, rejects it.
	 * @default false
	 */
	critical?: boolean;
}

/** A suffix read into its zone and tags, before any tag is interpreted. */
interface RawSuffix {
	timeZone: { name: string; critical: boolean } | null;
	tags: SuffixTag[];
}

/**
 * Zero-pad a field to a fixed width.
 *
 * @param value - Field value to pad.
 * @param width - Digits the field must occupy.
 * @returns The padded digits.
 */
function pad(value: number, width = 2): string {
	return String(value).padStart(width, "0");
}

/**
 * Minutes east of UTC a `time-numoffset` names, or `undefined` when its hours pass 23
 * or its minutes pass 59.
 *
 * @param text - Text such as `"+08:45"`.
 * @returns Signed minutes, or `undefined` for text that is no offset.
 */
function readNumericOffset(text: string): number | undefined {
	let groups = NUMERIC_OFFSET_PATTERN.exec(text)?.groups;
	if (!groups) return undefined;
	let hours = Number(groups.hours);
	let minutes = Number(groups.minutes);
	if (hours > 23 || minutes > 59) return undefined;
	let total = hours * 60 + minutes;
	return groups.sign === "-" ? -total : total;
}

/**
 * Writes minutes east of UTC as RFC 3339 does. `null` becomes `Z`, an unknown local
 * offset, while a known zero offset stays `+00:00`, the two meanings RFC 9557 separates.
 *
 * @param offset - Minutes east of UTC, or `null` for an unknown local offset.
 * @returns `"Z"` or `"±HH:MM"`.
 */
function writeOffset(offset: number | null): string {
	if (offset === null) return "Z";
	let sign = offset < 0 ? "-" : "+";
	let total = Math.abs(offset);
	return `${sign}${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/**
 * Whether text is an RFC 9557 `time-zone-name`: `/`-separated parts, none of them `.`
 * or `..`. Part length is left to the zone database, as the RFC prescribes.
 *
 * @param name - Bracket content without its critical flag.
 * @returns `true` when the grammar accepts it.
 */
function isTimeZoneName(name: string): boolean {
	return name
		.split("/")
		.every((part) => TIME_ZONE_PART_PATTERN.test(part) && part !== "." && part !== "..");
}

/**
 * Reads the bracketed suffix into a zone and tags. Only the first bracket may be a zone,
 * so a second zone or one after a tag is malformed.
 *
 * @param suffix - Everything after the RFC 3339 offset.
 * @returns The raw suffix, or `undefined` when the grammar rejects it.
 */
function readSuffix(suffix: string): RawSuffix | undefined {
	if (!SUFFIX_PATTERN.test(suffix)) return undefined;
	let result: RawSuffix = { timeZone: null, tags: [] };
	let first = true;

	for (let match of suffix.matchAll(TAG_PATTERN)) {
		let critical = match.groups?.critical === "!";
		let content = match.groups?.content ?? "";
		let separator = content.indexOf("=");

		if (separator === -1) {
			if (!first) return undefined;
			if (!isTimeZoneName(content) && readNumericOffset(content) === undefined) return undefined;
			result.timeZone = { name: content, critical };
		} else {
			let key = content.slice(0, separator);
			let value = content.slice(separator + 1);
			if (!SUFFIX_KEY_PATTERN.test(key) || !SUFFIX_VALUES_PATTERN.test(value)) return undefined;
			result.tags.push({ key, value, critical });
		}

		first = false;
	}

	return result;
}

/**
 * The zone's offset at an instant, in milliseconds. An offset zone answers from its own
 * name, so it works on runtimes whose `Intl` rejects offset zones.
 *
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - IANA or offset zone.
 * @returns Milliseconds to add to UTC.
 */
function zoneOffsetMs(instant: number, timeZone: TimeZone): number {
	let fixed = readNumericOffset(timeZone);
	if (fixed !== undefined) return fixed * MINUTE_MS;
	return offsetMsAt(instant, timeZone);
}

/**
 * An offset in whole minutes, or `null` when it carries seconds, which RFC 3339 cannot
 * write; `Z` then stands in, which RFC 9557 never treats as disagreeing with a zone.
 *
 * @param offsetMs - Offset in milliseconds.
 * @returns Minutes east of UTC, or `null`.
 */
function wholeMinutes(offsetMs: number): number | null {
	return offsetMs % MINUTE_MS === 0 ? offsetMs / MINUTE_MS : null;
}

/**
 * The offset `formatZonedDateTime` writes: the given one, else the zone's offset at the
 * instant, else `null` (`Z`) when there is no zone.
 *
 * @param offset - Offset the caller supplied, if any.
 * @param instant - Milliseconds since the epoch.
 * @param timeZone - Zone to measure when no offset was supplied.
 * @returns Minutes east of UTC, or `null`.
 */
function resolveOffset(
	offset: number | null | undefined,
	instant: number,
	timeZone: TimeZone | null,
): number | null {
	if (offset !== undefined) return offset;
	if (timeZone === null) return null;
	return wholeMinutes(zoneOffsetMs(instant, timeZone));
}

/**
 * Whether the runtime can format dates in a calendar, the test a critical `u-ca` tag
 * must pass before its timestamp is accepted.
 *
 * @param calendar - Unicode calendar identifier.
 * @returns `true` when `Intl` lists the calendar.
 */
function isSupportedCalendar(calendar: string): boolean {
	return Intl.supportedValuesOf("calendar").includes(calendar);
}

/**
 * Keeps the first tag for each key, as RFC 9557 requires of elective duplicates. A
 * duplicate with a different value is an inconsistency when either copy is critical.
 *
 * @param tags - Tags in the order written.
 * @returns The first tag per key, or `undefined` for a critical conflict.
 */
function dedupeTags(tags: readonly SuffixTag[]): SuffixTag[] | undefined {
	let firsts = new Map<string, SuffixTag>();
	for (let tag of tags) {
		let kept = firsts.get(tag.key);
		if (!kept) {
			firsts.set(tag.key, tag);
			continue;
		}
		if ((kept.critical || tag.critical) && kept.value !== tag.value) return undefined;
	}
	return [...firsts.values()];
}

/**
 * Writes a zoned instant as an RFC 9557 string, `YYYY-MM-DDTHH:mm:ss[.sss]±HH:MM[zone]`
 * followed by `[u-ca=…]` and any other tags. The fraction appears only when the instant
 * has milliseconds; `parseZonedDateTime` reads the result back as an equal value.
 *
 * @param value - Instant plus the zone, offset, calendar and tags to write; tags must
 * follow the RFC 9557 grammar, as every parsed tag does.
 * @param options - Whether the zone and calendar tags are critical.
 * @returns The IXDTF string, for a JSON field or a TEXT column.
 *
 * @example
 * formatZonedDateTime({ date: new Date("2026-10-24T13:00:00Z"), timeZone: "America/Montevideo" }); // "2026-10-24T10:00:00-03:00[America/Montevideo]"
 * @example
 * formatZonedDateTime({ date, timeZone: "Asia/Jerusalem", calendar: "hebrew" }, { critical: true }); // "…+03:00[!Asia/Jerusalem][!u-ca=hebrew]"
 */
export function formatZonedDateTime(
	value: ZonedDateTimeInit,
	options: FormatZonedDateTimeOptions = {},
): string {
	let instant = value.date.getTime();
	let timeZone = value.timeZone ?? null;
	let offset = resolveOffset(value.offset, instant, timeZone);

	let local = new Date(instant + (offset ?? 0) * MINUTE_MS);
	let day = `${pad(local.getUTCFullYear(), 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
	let time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
	let millisecond = local.getUTCMilliseconds();
	let fraction = millisecond === 0 ? "" : `.${pad(millisecond, 3)}`;

	let flag = options.critical ? "!" : "";
	let suffix = timeZone === null ? "" : `[${flag}${timeZone}]`;
	if (value.calendar) suffix += `[${flag}${CALENDAR_KEY}=${value.calendar}]`;
	for (let tag of value.tags ?? []) {
		suffix += `[${tag.critical ? "!" : ""}${tag.key}=${tag.value}]`;
	}

	return `${day}T${time}${fraction}${writeOffset(offset)}${suffix}`;
}

/**
 * Reads an RFC 9557 string into a zoned instant. Unknown elective tags are kept, unknown
 * critical ones and unlisted `_` keys fail, and a critical zone must match the offset;
 * an elective mismatch follows `onInconsistentOffset`, which fails by default.
 *
 * @param text - Text that should be an IXDTF string, e.g. read from a TEXT column.
 * @param options - Keys the application processes, and the elective mismatch policy.
 * @returns The zoned instant, or an `InvalidZonedDateTimeError` naming the broken rule.
 *
 * @example
 * parseZonedDateTime("2026-10-24T10:00:00-03:00[America/Montevideo]"); // { status: "success", data: { date: 2026-10-24T13:00:00Z, offset: -180, timeZone: "America/Montevideo", calendar: null, tags: [] } }
 * @example
 * parseZonedDateTime("2022-07-08T00:14:07+01:00[!Europe/Paris]"); // failure, error.problem === "inconsistent"
 */
export function parseZonedDateTime(
	text: string,
	options: ParseZonedDateTimeOptions = {},
): Result<ZonedDateTime, InvalidZonedDateTimeError> {
	let groups = DATE_TIME_PATTERN.exec(text)?.groups;
	if (!groups) return failure(new InvalidZonedDateTimeError("syntax", text));

	let writtenOffset = groups.offset ?? "Z";
	let offset: number | null = null;
	if (writtenOffset.toUpperCase() !== "Z" && writtenOffset !== "-00:00") {
		let minutes = readNumericOffset(writtenOffset);
		if (minutes === undefined) return failure(new InvalidZonedDateTimeError("syntax", text));
		offset = minutes;
	}

	let suffix = readSuffix(groups.suffix ?? "");
	if (!suffix) return failure(new InvalidZonedDateTimeError("syntax", text));

	let parts: ZonedParts = {
		year: Number(groups.year),
		month: Number(groups.month),
		day: Number(groups.day),
		hour: Number(groups.hour),
		minute: Number(groups.minute),
		second: Number(groups.second),
		millisecond: Number((groups.fraction ?? "").slice(0, 3).padEnd(3, "0")),
	};
	if (
		parts.month < 1 ||
		parts.month > 12 ||
		parts.day < 1 ||
		parts.day > daysInMonth(parts.year, parts.month) ||
		parts.hour > 23 ||
		parts.minute > 59 ||
		parts.second > 59
	) {
		return failure(new InvalidZonedDateTimeError("invalidDate", text));
	}

	let keys = new Set(options.keys ?? []);
	if (suffix.tags.some((tag) => tag.key.startsWith("_") && !keys.has(tag.key))) {
		return failure(new InvalidZonedDateTimeError("experimentalKey", text));
	}

	let unique = dedupeTags(suffix.tags);
	if (!unique) return failure(new InvalidZonedDateTimeError("inconsistent", text));

	let calendar: string | null = null;
	let tags: SuffixTag[] = [];
	for (let tag of unique) {
		if (tag.key === CALENDAR_KEY) {
			if (tag.critical && !isSupportedCalendar(tag.value)) {
				return failure(new InvalidZonedDateTimeError("unsupportedCritical", text));
			}
			calendar = tag.value;
		} else if (tag.critical && !keys.has(tag.key)) {
			return failure(new InvalidZonedDateTimeError("unsupportedCritical", text));
		} else {
			tags.push(tag);
		}
	}

	let asUtc = utcFromParts(parts);
	let instant = asUtc - (offset ?? 0) * MINUTE_MS;
	let zone = suffix.timeZone;

	if (zone) {
		if (readNumericOffset(zone.name) === undefined && !isValidTimeZone(zone.name)) {
			return failure(new InvalidZonedDateTimeError("unknownTimeZone", text));
		}

		let actual = zoneOffsetMs(instant, zone.name);
		if (offset !== null && actual !== offset * MINUTE_MS) {
			let policy = options.onInconsistentOffset ?? "reject";
			if (zone.critical || policy === "reject") {
				return failure(new InvalidZonedDateTimeError("inconsistent", text));
			}
			if (policy === "keepWallClock") {
				let fixed = readNumericOffset(zone.name);
				instant =
					fixed === undefined ? instantFromParts(parts, zone.name) : asUtc - fixed * MINUTE_MS;
			}
			offset = wholeMinutes(zoneOffsetMs(instant, zone.name));
		}
	}

	return success({
		date: new Date(instant),
		offset,
		timeZone: zone?.name ?? null,
		calendar,
		tags,
	});
}
