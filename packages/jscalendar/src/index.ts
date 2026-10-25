/**
 * Reads, validates and writes RFC 8984 JSCalendar objects, the JSON counterpart of
 * iCalendar: typed events, tasks and groups, PatchObjects, the value formats, and the
 * `application/jscalendar+json` response a feed is served as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { Issue } from "./lib/errors.js";
import type { JSCalendar } from "./types.js";

import { JSCalendarParseError } from "./lib/errors.js";
import { OBJECT_SCHEMA } from "./lib/schema.js";

export type { JSCalendar } from "./types.js";
export type { Issue } from "./lib/errors.js";
export type { DurationParts } from "./lib/values.js";

export { JSCalendarParseError, PatchError } from "./lib/errors.js";
export { applyPatch } from "./lib/patch.js";
export { EVENT_SCHEMA, GROUP_SCHEMA, OBJECT_SCHEMA, TASK_SCHEMA } from "./lib/schema.js";
export {
	formatDuration,
	formatLocalDateTime,
	formatUTCDateTime,
	isId,
	parseDuration,
	parseLocalDateTime,
	parseUTCDateTime,
} from "./lib/values.js";

/** The media type of a JSCalendar object (RFC 8984 §8.1). */
export const MEDIA_TYPE = "application/jscalendar+json";

/**
 * The issues of a failed validation as plain paths and messages.
 *
 * @param issues - What `remix/data-schema` reported
 * @returns The issues, each path reduced to its keys
 */
function issuesOf(issues: ReadonlyArray<s.Issue>): Issue[] {
	return issues.map((issue) => ({
		path: (issue.path ?? []).map((segment) =>
			typeof segment === "object" ? (segment.key as string | number) : (segment as string | number),
		),
		message: issue.message,
	}));
}

/**
 * Reads and validates a JSCalendar object. A string is parsed as JSON first; any other value
 * is validated as already-parsed JSON. Properties the model does not name, such as vendor
 * extensions, are kept.
 *
 * @param source - JSON text, or the value `JSON.parse` returned
 * @returns The Event, Task or Group, or every problem found
 * @example parse(await request.text());
 */
export function parse(source: unknown): Result<JSCalendar.CalendarObject, JSCalendarParseError> {
	let value = source;
	if (typeof source === "string") {
		try {
			value = JSON.parse(source);
		} catch (error) {
			let reason = error instanceof Error ? error.message : String(error);
			return failure(new JSCalendarParseError(`The text is not JSON: ${reason}`));
		}
	}
	let result = s.parseSafe(OBJECT_SCHEMA, value);
	if (result.success) return success(result.value);
	let issues = issuesOf(result.issues);
	let [first] = issues;
	let where = first && first.path.length > 0 ? ` at ${first.path.join(".")}` : "";
	return failure(
		new JSCalendarParseError(`Invalid JSCalendar${where}: ${first?.message ?? "unknown"}`, issues),
	);
}

/**
 * Writes a JSCalendar object as JSON, properties in the order the object holds them.
 *
 * @param object - The Event, Task or Group
 * @param space - Indentation, as `JSON.stringify` takes it
 * @returns The JSON text
 */
export function stringify(object: JSCalendar.CalendarObject, space?: number | string): string {
	return JSON.stringify(object, null, space);
}

/**
 * The full media type for an object, with the `type` parameter RFC 8984 requires.
 *
 * @param object - The Event, Task or Group
 * @returns E.g. `application/jscalendar+json; type=group`
 */
export function contentType(object: JSCalendar.CalendarObject): string {
	return `${MEDIA_TYPE}; type=${object["@type"].toLowerCase()}`;
}

/**
 * An `application/jscalendar+json` response for a feed or a single object. Headers in
 * `init` are kept, and a `Content-Type` there wins.
 *
 * @param object - The Event, Task or Group to serve
 * @param init - Response options
 * @returns The response
 */
export function jscalendarResponse(
	object: JSCalendar.CalendarObject,
	init: ResponseInit = {},
): Response {
	let headers = new Headers(init.headers);
	if (!headers.has("Content-Type")) headers.set("Content-Type", contentType(object));
	return new Response(stringify(object), { ...init, headers });
}
