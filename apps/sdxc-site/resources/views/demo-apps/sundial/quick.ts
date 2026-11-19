/**
 * Quick add: one line of English becomes an event. `@sdxc/natural-dates` finds the dates, times,
 * length and repeat; what it leaves is the title, and "with Ana and Tomás" invites the teammates
 * it names. Unstated parts take a calendar's usual defaults: today, the next hour, an hour long.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Found } from "@sdxc/natural-dates";

import { find, strip } from "@sdxc/natural-dates";
import { isFailure } from "@sdxc/result";

import type { EventFields } from "./event";

import { ME, PEOPLE } from "./data";
import { durationOf, localDateTime } from "./model";
import { clockAt } from "./time";

/** "with Ana", "with Mara and Tomás", "with Priya, Jonah & Aiko". */
const WITH = /\bwith\s+([\p{L}]+(?:\s*(?:,|&|\band\b)\s*[\p{L}]+)*)/iu;

/** The longest title a quick add keeps. */
const TITLE_LIMIT = 120;

/** A name lowercased without accents, so "tomas" finds Tomás. */
function plain(name: string): string {
	return name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/** The teammates a "with …" phrase names by first name. */
export function guestsIn(text: string): string[] {
	let match = WITH.exec(text);
	if (!match) return [];
	let names = (match[1] ?? "").split(/\s*(?:,|&|\band\b)\s*/iu).map(plain);
	return PEOPLE.filter(
		(person) => person.id !== ME && names.includes(plain(person.name.split(" ")[0] ?? "")),
	).map((person) => person.id);
}

/** Minutes of the day from an `HH:MM` time. */
function minutesOf(time: string): number {
	return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

/** What a quick-add line reads as: the event's fields, and the day it lands on. */
export interface QuickEvent {
	fields: EventFields;
	date: string;
	found: Found;
}

/**
 * Reads a quick-add line into an event's fields on the viewer's clock, or `null` for a line with
 * nothing to add.
 *
 * @param text The line as typed.
 * @param zone The viewer's zone, which the dates and times are on.
 * @param now The present, which "tomorrow" and the default start count from.
 */
export function quickEvent(text: string, zone: string, now: Date): QuickEvent | null {
	let line = text.trim().slice(0, 300);
	if (line === "") return null;
	let read = find(line, { now, timeZone: zone });
	if (isFailure(read)) return null;
	let found = read.data;
	let today = clockAt(now.getTime(), zone);
	let date = found.date ?? today.date;
	let guests = guestsIn(line);
	let title = strip(line, found.matches).slice(0, TITLE_LIMIT) || "New event";
	let base = {
		calendar: "work",
		title,
		recurrenceRules: found.repeat
			? [{ "@type": "RecurrenceRule" as const, ...found.repeat }]
			: undefined,
		guests: guests.length === 0 ? [] : [ME, ...guests],
	};
	if (found.allDay || (found.endDate !== undefined && found.start === undefined)) {
		let days =
			found.endDate === undefined
				? 1
				: Math.round(
						(Date.parse(`${found.endDate}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) /
							86_400_000,
					) + 1;
		return {
			date,
			found,
			fields: {
				...base,
				start: localDateTime(date, 0),
				duration: durationOf(days * 1440, true),
				timeZone: null,
				showWithoutTime: true,
			},
		};
	}
	let start =
		found.start === undefined
			? Math.min(23 * 60, date === today.date ? (Math.floor(today.minute / 60) + 1) * 60 : 9 * 60)
			: minutesOf(found.start);
	let length =
		found.duration ??
		(found.end === undefined ? 60 : (minutesOf(found.end) - start + 1440) % 1440 || 60);
	return {
		date,
		found,
		fields: {
			...base,
			start: localDateTime(date, start),
			duration: durationOf(length),
			timeZone: zone,
			showWithoutTime: false,
		},
	};
}
