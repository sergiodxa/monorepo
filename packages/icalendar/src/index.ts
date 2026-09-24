/**
 * Reads and writes RFC 5545 iCalendar objects: typed events, alarms and time zones over a
 * generic component layer that keeps everything else, so a calendar read and written back
 * loses nothing, plus the `text/calendar` response a feed or download is served as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { ICalendar } from "./types.js";

import { ICalendarParseError } from "./lib/errors.js";
import { wallFromMs, wallMs } from "./lib/expand.js";
import { readCalendar, readTree } from "./lib/read.js";
import { writeCalendar } from "./lib/write.js";
import { resolverFor } from "./lib/zones.js";

export type { ICalendar } from "./types.js";

export { ICalendarParseError } from "./lib/errors.js";
export { escapeText, unescapeText } from "./lib/text.js";

/** The media type of an iCalendar object (RFC 5545 §8.1). */
export const MEDIA_TYPE = "text/calendar";

/**
 * Reads the first `VCALENDAR` in the text. Structural errors fail with the line they start
 * on; missing `UID`, `DTSTAMP` or `PRODID` and values that do not parse become warnings,
 * with the unreadable property kept verbatim.
 *
 * @param source - The calendar text, CRLF or LF
 * @returns The calendar and its warnings, or the structural failure
 */
export function parse(source: string): Result<ICalendar.Parsed, ICalendarParseError> {
	let parsed = parseAll(source);
	if (isFailure(parsed)) return parsed;
	let [first] = parsed.data;
	if (!first) return failure(new ICalendarParseError("the text holds no VCALENDAR", 1));
	return success(first);
}

/**
 * Reads every `VCALENDAR` in the text, for files that concatenate several. A structural
 * error in any of them fails the whole text.
 *
 * @param source - The calendar text
 * @returns One parsed calendar per `VCALENDAR`, in order
 */
export function parseAll(source: string): Result<ICalendar.Parsed[], ICalendarParseError> {
	let tree = readTree(source);
	if (isFailure(tree)) return tree;
	return success(tree.data.map(readCalendar));
}

/**
 * Writes a calendar as CRLF lines folded at 75 octets. `VERSION:2.0` is always written, and
 * every `TZID` a date-time uses needs its `VTIMEZONE` in `timeZones`, which `vtimezone` from
 * `@sdxc/icalendar/timezone` builds.
 *
 * @param calendar - The calendar to write
 * @returns The calendar text
 */
export function stringify(calendar: ICalendar.Calendar): string {
	return writeCalendar(calendar);
}

/**
 * The instant a DATE-TIME names. A `TZID` resolves through the calendar's `VTIMEZONE` of
 * that name first and `Intl` second; a DATE, a floating time, or a `TZID` neither resolves
 * gives `null`, since none of them names one instant.
 *
 * @param value - The value to resolve
 * @param calendar - The calendar whose `VTIMEZONE`s define its `TZID`s
 * @returns Milliseconds since the epoch, or `null`
 */
export function toInstant(
	value: ICalendar.DateValue,
	calendar?: ICalendar.Calendar,
): number | null {
	if (value.type === "date" || value.zone === "floating") return null;
	let resolve = resolverFor(value, calendar ? { calendar } : {});
	return resolve ? resolve(wallMs(value.wall)) : null;
}

/**
 * A UTC DATE-TIME for an instant, the form the writer prefers because it needs no
 * `VTIMEZONE`. Milliseconds are dropped, since DATE-TIME counts whole seconds.
 *
 * @param instant - Milliseconds since the epoch, or a `Date`
 * @returns The date-time
 */
export function utc(instant: number | Date): ICalendar.DateValue {
	let ms = typeof instant === "number" ? instant : instant.getTime();
	return { type: "date-time", wall: wallFromMs(Math.floor(ms / 1000) * 1000), zone: "utc" };
}

/**
 * A `Content-Disposition: attachment` value, with an RFC 8187 `filename*` beside an ASCII
 * fallback when the name has characters outside ASCII.
 *
 * @param filename - The file name a download is saved as
 * @returns The header value
 */
function attachment(filename: string): string {
	let ascii = filename.replaceAll(/[^\x20-\x7E]/g, "_").replaceAll(/["\\]/g, "_");
	let header = `attachment; filename="${ascii}"`;
	if (ascii !== filename) header += `; filename*=UTF-8''${encodeURIComponent(filename)}`;
	return header;
}

/**
 * A `text/calendar` response for a feed or a download. The calendar's `method` becomes the
 * iTIP `method` parameter of the media type, and `filename` makes the response an
 * attachment. Headers in `init` are kept, and a `Content-Type` there wins.
 *
 * @param calendar - The calendar to serve
 * @param init - Response options, plus the download's file name
 * @returns The response
 */
export function calendarResponse(
	calendar: ICalendar.Calendar,
	init: ResponseInit & { filename?: string } = {},
): Response {
	let { filename, ...responseInit } = init;
	let headers = new Headers(responseInit.headers);
	if (!headers.has("Content-Type")) {
		let method = calendar.method ? `; method=${calendar.method}` : "";
		headers.set("Content-Type", `${MEDIA_TYPE}; charset=utf-8${method}`);
	}
	if (filename !== undefined && !headers.has("Content-Disposition")) {
		headers.set("Content-Disposition", attachment(filename));
	}
	return new Response(stringify(calendar), { ...responseInit, headers });
}
