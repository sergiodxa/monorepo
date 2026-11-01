import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Input and output shared by the `sdxc-icalendar` commands: reading a calendar from a path or
 * stdin, reading a `--from`/`--start` value in a zone, and printing an instant as an ISO 8601
 * date-time with that zone's offset, so every command reads and prints dates one way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Stdin } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { instantFromParts, offsetMsAt } from "@sdxc/dates/zone";
import { failure, isFailure, success, wrap } from "@sdxc/result";

import type { ICalendar } from "../types.js";

/**
 * A date, a local date-time, or a date-time with `Z` or an offset; the groups are year, month,
 * day, hour, minute, second and zone.
 */
export const WHEN_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * The calendar text a command reads: the file at `file`, resolved against `cwd`, or stdin when
 * `file` is `-`. A terminal on stdin fails, since nothing was piped to read.
 *
 * @param file - The path argument, `-` for stdin
 * @param io - The run's directory and stdin
 * @returns The text, or why it cannot be read
 */
export async function readInput(
	file: string,
	io: { cwd: string; stdin: Stdin },
): Promise<Result<string, Error>> {
	if (file === "-") {
		if (io.stdin.isTTY) return failure(new Error("Pass an .ics file, or pipe one on stdin"));
		return success(await io.stdin.text());
	}
	let path = resolve(io.cwd, file);
	let text = await wrap(() => readFile(path, "utf8"));
	if (isFailure(text)) return failure(new Error(`Cannot read ${file}: ${text.error.message}`));
	return success(String(text.data));
}

/**
 * A date flag as an iCalendar value: a date is a DATE, a local date-time is a wall clock in
 * `timeZone` (UTC when that zone is UTC), and `Z` or an offset names a UTC instant.
 *
 * @param text - A value `WHEN_PATTERN` matches
 * @param timeZone - The IANA zone a local date-time is read in
 * @returns The value
 */
export function whenValue(text: string, timeZone: string): ICalendar.DateValue {
	let [, year, month, day, hour, minute, second, zone] = WHEN_PATTERN.exec(text) ?? [];
	let date = { year: Number(year), month: Number(month), day: Number(day) };
	if (hour === undefined) return { type: "date", ...date };
	let wall = { ...date, hour: Number(hour), minute: Number(minute), second: Number(second ?? 0) };
	if (zone === undefined) {
		return { type: "date-time", wall, zone: timeZone === "UTC" ? "utc" : { tzid: timeZone } };
	}
	let sign = zone.startsWith("-") ? -1 : 1;
	let offset = zone === "Z" ? 0 : sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4)));
	let instant = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute - offset);
	let utc = new Date(instant + wall.second * 1000);
	return {
		type: "date-time",
		wall: {
			year: utc.getUTCFullYear(),
			month: utc.getUTCMonth() + 1,
			day: utc.getUTCDate(),
			hour: utc.getUTCHours(),
			minute: utc.getUTCMinutes(),
			second: utc.getUTCSeconds(),
		},
		zone: "utc",
	};
}

/**
 * The instant a `whenValue` names: a DATE is its midnight in `timeZone`.
 *
 * @param value - A value `whenValue` produced
 * @param timeZone - The zone a DATE and a local date-time are read in
 * @returns Epoch milliseconds
 */
export function instantOf(value: ICalendar.DateValue, timeZone: string): number {
	let wall =
		value.type === "date" ? { ...value, hour: 0, minute: 0, second: 0 } : { ...value.wall };
	let zone = value.type === "date-time" && value.zone === "utc" ? "UTC" : timeZone;
	return instantFromParts({ ...wall, millisecond: 0 }, zone);
}

/**
 * An instant as an ISO 8601 date-time on `timeZone`'s wall clock, with `Z` in UTC and the
 * zone's offset elsewhere, to whole seconds.
 *
 * @param instant - Epoch milliseconds
 * @param timeZone - The IANA zone to print in
 * @returns The date-time, such as `2026-11-02T09:30:00+01:00`
 */
export function formatInstant(instant: number, timeZone: string): string {
	let offset = timeZone === "UTC" ? 0 : offsetMsAt(instant, timeZone);
	let local = new Date(instant + offset).toISOString().slice(0, 19);
	if (offset === 0 && timeZone === "UTC") return `${local}Z`;
	let minutes = Math.round(Math.abs(offset) / 60_000);
	let sign = offset < 0 ? "-" : "+";
	let hours = String(Math.floor(minutes / 60)).padStart(2, "0");
	return `${local}${sign}${hours}:${String(minutes % 60).padStart(2, "0")}`;
}
