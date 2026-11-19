/**
 * Sundial's clock: turns stored events, kept in the zone they were planned in, into what a
 * viewer in another zone sees on a range of days — each repeat expanded at its own wall-clock
 * time across DST, then cut into per-day pieces on the viewer's clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Recurrence, Weekday } from "@sdxc/dates";

import { expandRecurrence } from "@sdxc/dates";
import { instantFromParts, zonedParts } from "@sdxc/dates/zone";
import { iife } from "@sdxc/iife";

import type { CalendarEvent, RepeatId } from "./data";

import { LOCALE, shiftDate } from "./data";

/** Milliseconds in a minute and a day. */
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** One occurrence of an event, at its instants. */
export interface Instance {
	/** The event id and the day it happens on in the event's zone: `standup~2026-11-18`. */
	key: string;
	event: CalendarEvent;
	/** The day this occurrence falls on in the event's own zone, which an exception names. */
	day: string;
	start: Date;
	end: Date;
	/** For an all-day instance, its first and last day, inclusive. */
	days?: { first: string; last: string };
}

/** The part of an instance on one of the viewer's days, in minutes of that day. */
export interface Segment {
	id: string;
	instance: Instance;
	date: string;
	start: number;
	end: number;
	/** Whether the instance runs on from the day before or into the day after. */
	cut: boolean;
}

/** A `YYYY-MM-DD` day and minute of an instant on a zone's clock. */
export function clockAt(instant: number, zone: string): { date: string; minute: number } {
	let parts = zonedParts(instant, zone);
	let date = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
	return { date, minute: parts.hour * 60 + parts.minute };
}

/** The instant a zone's clock shows a minute of a `YYYY-MM-DD` day. */
export function instantAt(date: string, minute: number, zone: string): number {
	let [year = 0, month = 1, day = 1] = date.split("-").map(Number);
	let dayShift = Math.floor(minute / 1440);
	if (dayShift !== 0) return instantAt(shiftDate(date, dayShift), minute - dayShift * 1440, zone);
	return instantFromParts(
		{
			year,
			month,
			day,
			hour: Math.floor(minute / 60),
			minute: minute % 60,
			second: 0,
			millisecond: 0,
		},
		zone,
	);
}

/** The repeat rule a dialog choice stands for, read against the event's first day. */
function ruleOf(repeat: RepeatId, exceptions: string[] | undefined): Recurrence | null {
	let base = { exceptions };
	if (repeat === "daily") return { ...base, frequency: "daily" };
	if (repeat === "weekdays")
		return { ...base, frequency: "weekly", weekdays: [1, 2, 3, 4, 5] as Weekday[] };
	if (repeat === "weekly") return { ...base, frequency: "weekly" };
	if (repeat === "biweekly") return { ...base, frequency: "weekly", interval: 2 };
	if (repeat === "monthly") return { ...base, frequency: "monthly" };
	if (repeat === "yearly") return { ...base, frequency: "yearly" };
	return null;
}

/**
 * Every occurrence of the events that touches a range of the viewer's days. Timed events repeat
 * at their own zone's wall clock; all-day events float, the same dates in every zone.
 *
 * @param events Stored events.
 * @param first The range's first day, `YYYY-MM-DD` on the viewer's clock.
 * @param days How many days the range covers.
 * @param zone The viewer's zone.
 */
export function instancesIn(
	events: CalendarEvent[],
	first: string,
	days: number,
	zone: string,
): Instance[] {
	let window = {
		start: new Date(instantAt(first, 0, zone)),
		end: new Date(instantAt(shiftDate(first, days), 0, zone)),
	};
	let floating = {
		start: new Date(Date.parse(`${first}T00:00:00Z`)),
		end: new Date(Date.parse(`${shiftDate(first, days)}T00:00:00Z`)),
	};
	let found: Instance[] = [];
	for (let event of events) {
		let allDay = event.start === null;
		let start = allDay
			? Date.parse(`${event.date}T00:00:00Z`)
			: instantAt(event.date, event.start ?? 0, event.zone);
		let end = allDay ? start + event.length * DAY_MS : start + event.length * MINUTE_MS;
		let rule = ruleOf(event.repeat, event.exceptions);
		let seriesZone = allDay ? "UTC" : event.zone;
		let range = allDay ? floating : window;
		let occurrences = iife(() => {
			if (rule !== null)
				return expandRecurrence(
					{ start: new Date(start), end: new Date(end) },
					rule,
					range,
					seriesZone,
				);
			if (start < range.end.getTime() && end > range.start.getTime())
				return [{ start: new Date(start), end: new Date(end) }];
			return [];
		});
		for (let occurrence of occurrences) {
			let day = clockAt(occurrence.start.getTime(), seriesZone).date;
			found.push({
				key: `${event.id}~${day}`,
				event,
				day,
				start: occurrence.start,
				end: occurrence.end,
				days: allDay
					? {
							first: occurrence.start.toISOString().slice(0, 10),
							last: new Date(occurrence.end.getTime() - DAY_MS).toISOString().slice(0, 10),
						}
					: undefined,
			});
		}
	}
	return found.sort((a, b) => a.start.getTime() - b.start.getTime() || a.key.localeCompare(b.key));
}

/** Whether an instance belongs in the all-day lane: all-day, or a day long or more. */
export function inLane(instance: Instance): boolean {
	return instance.days !== undefined || instance.end.getTime() - instance.start.getTime() >= DAY_MS;
}

/** An instance's first and last day on the viewer's clock, for the lane. */
export function laneDays(instance: Instance, zone: string): { first: string; last: string } {
	if (instance.days) return instance.days;
	let first = clockAt(instance.start.getTime(), zone).date;
	let end = clockAt(instance.end.getTime() - 1, zone).date;
	return { first, last: end };
}

/**
 * Cuts a timed instance into one piece per viewer day it touches, in minutes of each day, so an
 * overnight flight shows its evening on one day and its morning on the next.
 *
 * @param instance A timed instance shorter than a day.
 * @param zone The viewer's zone.
 */
export function segmentsOf(instance: Instance, zone: string): Segment[] {
	let start = clockAt(instance.start.getTime(), zone);
	let end = clockAt(instance.end.getTime(), zone);
	if (start.date === end.date || (end.minute === 0 && shiftDate(start.date, 1) === end.date)) {
		return [
			{
				id: instance.key,
				instance,
				date: start.date,
				start: start.minute,
				end: end.date === start.date ? Math.max(end.minute, start.minute) : 1440,
				cut: false,
			},
		];
	}
	let pieces: Segment[] = [
		{ id: instance.key, instance, date: start.date, start: start.minute, end: 1440, cut: true },
	];
	let cursor = shiftDate(start.date, 1);
	while (cursor < end.date) {
		pieces.push({
			id: `${instance.key}~${cursor}`,
			instance,
			date: cursor,
			start: 0,
			end: 1440,
			cut: true,
		});
		cursor = shiftDate(cursor, 1);
	}
	if (end.minute > 0)
		pieces.push({
			id: `${instance.key}~${end.date}`,
			instance,
			date: end.date,
			start: 0,
			end: end.minute,
			cut: true,
		});
	return pieces;
}

/** Formats an instance's times on the viewer's clock, such as "9:30 – 10:15 AM". */
export function formatTimes(instance: Instance, zone: string): string {
	if (instance.days) return "All day";
	return new Intl.DateTimeFormat(LOCALE, {
		hour: "numeric",
		minute: "2-digit",
		timeZone: zone,
	}).formatRange(instance.start, instance.end);
}

/** Formats a minute of the day, such as "9:30 AM". */
export function formatMinute(minute: number): string {
	return new Intl.DateTimeFormat(LOCALE, {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
	}).format(Date.UTC(2000, 0, 1, 0, minute));
}

/** Formats a day, such as "Wednesday, November 18". */
export function formatDay(date: string, style: "long" | "short" = "long"): string {
	return new Intl.DateTimeFormat(LOCALE, {
		weekday: style,
		month: style === "long" ? "long" : "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(Date.parse(`${date}T00:00:00Z`));
}

/** A zone's short name on a day, such as "EST" or "GMT+1", read at that day's noon. */
export function zoneName(zone: string, date: string): string {
	let parts = new Intl.DateTimeFormat(LOCALE, {
		timeZone: zone,
		timeZoneName: "short",
	}).formatToParts(instantAt(date, 720, zone));
	let name = parts.find((part) => part.type === "timeZoneName")?.value ?? zone;
	return name.replace(/^GMT\+0$/, "GMT");
}

/**
 * The 24 labels beside a day's hours for a zone column: what a clock in `zone` reads at each
 * hour of `date` on the viewer's clock, so a second zone shows its own DST offset for that day.
 *
 * @param date The day the labels are read on, on the viewer's clock.
 * @param viewer The viewer's zone, which the grid's rows follow.
 * @param zone The zone the labels are for.
 */
export function hourLabels(date: string, viewer: string, zone: string): string[] {
	let format = new Intl.DateTimeFormat(LOCALE, { hour: "numeric", timeZone: zone });
	return Array.from({ length: 24 }, (_, hour) => format.format(instantAt(date, hour * 60, viewer)));
}

/** The viewer's today and present minute. */
export function nowIn(zone: string, at: number): { date: string; minute: number } {
	return clockAt(at, zone);
}
