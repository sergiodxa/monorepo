/**
 * Sundial's calendars as files: each calendar is a JSCalendar Group served as iCalendar or
 * JSCalendar JSON, an `.ics` or JSCalendar upload becomes events, and invitations travel as iTIP
 * (a REQUEST to the guests, each guest's REPLY read back onto the event).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ICalendar } from "@sdxc/icalendar";
import type { JSCalendar } from "@sdxc/jscalendar";

import {
	calendarResponse,
	parse as parseICalendar,
	stringify as stringifyICalendar,
} from "@sdxc/icalendar";
import { readReply, reply, request } from "@sdxc/icalendar/itip";
import { jscalendarResponse, parse as parseJSCalendar } from "@sdxc/jscalendar";
import { fromICalendar, toICalendar } from "@sdxc/jscalendar/icalendar";
import { isFailure } from "@sdxc/result";

import type { Entry } from "./model";

import { CALENDARS, ME, colorValue, findCalendar } from "./data";
import { DOMAIN, emailOf, guestsOf, organizerOf } from "./model";

/** The `PRODID` every file and message Sundial writes carries. */
export const PRODUCT_ID = "-//Ridgeline//Sundial demo//EN";

/** The calendar an import lands in, owned so its events can be moved and edited. */
export const IMPORT_CALENDAR = "travel";

/** The longest description an imported event keeps, so imports stay small enough for a cookie. */
const DESCRIPTION_LIMIT = 280;

/** One calendar as a JSCalendar Group of its events. */
export function groupOf(calendar: string, entries: Entry[]): JSCalendar.Group {
	let found = findCalendar(calendar);
	return {
		"@type": "Group",
		uid: `${calendar}@${DOMAIN}`,
		title: found?.name ?? calendar,
		color: colorValue(found?.color),
		entries: entries.filter((entry) => entry.calendar === calendar).map((entry) => entry.event),
	};
}

/** Every calendar together, for the "all calendars" feed. */
function everything(entries: Entry[]): JSCalendar.Group {
	return {
		"@type": "Group",
		uid: `all@${DOMAIN}`,
		title: "Noor's calendars",
		entries: entries.map((entry) => entry.event),
	};
}

/** A JSCalendar object as an iCalendar response, or `null` when it cannot be converted. */
function icsResponse(
	object: JSCalendar.Group | JSCalendar.Event,
	filename: string,
): Response | null {
	let calendar = toICalendar(object, { productId: PRODUCT_ID });
	if (isFailure(calendar)) return null;
	return calendarResponse(calendar.data, { filename });
}

/**
 * Answers a Sundial file: `calendars/<id>.ics` or `.json` for one calendar, `calendars/all.ics`
 * for every one, `events/<uid>.ics` for one event, and `replies/<uid>.ics` for the visitor's
 * iTIP REPLY to an invitation. Anything else answers `null`.
 *
 * @param part The path under `files/`.
 * @param entries The visitor's calendar.
 */
export function fileOf(part: string, entries: Entry[]): Response | null {
	let match = /^(calendars|events|replies)\/(.+)\.(ics|json)$/.exec(part);
	if (!match) return null;
	let [, kind, name = "", format] = match;
	if (kind === "calendars") {
		if (name !== "all" && !CALENDARS.some((calendar) => calendar.id === name)) return null;
		let group = name === "all" ? everything(entries) : groupOf(name, entries);
		if (format === "ics") return icsResponse(group, `${name}.ics`);
		let response = jscalendarResponse(group);
		response.headers.set("Content-Disposition", `attachment; filename="${name}.json"`);
		return response;
	}
	let entry = entries.find((item) => item.event.uid === name);
	if (!entry || format !== "ics") return null;
	if (kind === "events") return icsResponse(entry.event, "event.ics");
	let answer = replyTo(entry.event);
	return answer === null ? null : calendarResponse(answer, { filename: "reply.ics" });
}

/** The single `VEVENT` an event converts to, its overrides folded in as iCalendar does. */
function icsEvent(
	event: JSCalendar.Event,
): { calendar: ICalendar.Calendar; event: ICalendar.Event } | null {
	let calendar = toICalendar(event, { productId: PRODUCT_ID });
	if (isFailure(calendar)) return null;
	let [main] = calendar.data.events;
	return main ? { calendar: calendar.data, event: main } : null;
}

/** The iTIP PARTSTAT a participation status is written as. */
const PARTSTAT: Record<string, ICalendar.Attendee["participation"]> = {
	accepted: "ACCEPTED",
	tentative: "TENTATIVE",
	declined: "DECLINED",
	"needs-action": "NEEDS-ACTION",
};

/** The visitor's iTIP REPLY to an invitation, carrying their current answer, or `null` for their own events. */
export function replyTo(event: JSCalendar.Event): ICalendar.Calendar | null {
	let organizer = organizerOf(event);
	if (organizer === undefined || organizer === ME) return null;
	let converted = icsEvent(event);
	if (!converted) return null;
	let status = event.participants?.[ME]?.participationStatus ?? "needs-action";
	let message = reply(converted.event, {
		productId: PRODUCT_ID,
		attendee: `mailto:${emailOf(ME)}`,
		participation: PARTSTAT[status] ?? "NEEDS-ACTION",
		timeZones: converted.calendar.timeZones,
	});
	return isFailure(message) ? null : message.data;
}

/** What each guest answers, from whether they are free and working when the event happens. */
export type Decide = (guest: string) => "ACCEPTED" | "TENTATIVE" | "DECLINED";

/**
 * Sends an event's invitations as an iTIP REQUEST, has each guest answer with an iTIP REPLY,
 * and reads every reply back onto the event's participants, as an organizer's calendar would
 * on receiving them. An event without guests, or one that will not convert, comes back as is.
 *
 * @param event The visitor's event, organized by them.
 * @param decide What each guest answers.
 * @returns The event with every guest's answer, and how many said each.
 */
export function invite(
	event: JSCalendar.Event,
	decide: Decide,
): { event: JSCalendar.Event; answers: Record<string, number> } {
	let guests = guestsOf(event).filter((guest) => guest !== ME);
	let converted = icsEvent(event);
	if (guests.length === 0 || !converted || organizerOf(event) !== ME) return { event, answers: {} };
	let sent = request(converted.event, {
		productId: PRODUCT_ID,
		timeZones: converted.calendar.timeZones,
	});
	if (isFailure(sent)) return { event, answers: {} };
	let [received] = sent.data.events;
	if (!received) return { event, answers: {} };
	let participants = { ...event.participants };
	let answers: Record<string, number> = {};
	for (let guest of guests) {
		let answer = reply(received, {
			productId: PRODUCT_ID,
			attendee: `mailto:${emailOf(guest)}`,
			participation: decide(guest),
		});
		if (isFailure(answer)) continue;
		let read = readReply(stringifyICalendar(answer.data));
		if (isFailure(read)) continue;
		for (let { attendee } of read.data) {
			let id = attendee.address.replace(/^mailto:/i, "").split("@")[0] ?? "";
			let participant = participants[id];
			let status = Object.entries(PARTSTAT).find(
				([, value]) => value === attendee.participation,
			)?.[0];
			if (!participant || !status) continue;
			participants[id] = { ...participant, participationStatus: status };
			answers[status] = (answers[status] ?? 0) + 1;
		}
	}
	return { event: { ...event, participants }, answers };
}

/** An imported event, trimmed to what Sundial draws so imports fit in a cookie. */
function lean(event: JSCalendar.Event): JSCalendar.Event {
	let { iCalendar: _kept, alerts: _alerts, localizations: _text, links: _links, ...rest } = event;
	if (rest.description !== undefined && rest.description.length > DESCRIPTION_LIMIT) {
		rest.description = `${rest.description.slice(0, DESCRIPTION_LIMIT - 1)}…`;
	}
	return rest;
}

/**
 * Reads an uploaded or posted calendar: iCalendar text, or JSCalendar JSON holding a Group or an
 * Event. Tasks are left out, since the calendar shows events.
 *
 * @param text The file's text.
 * @returns The events it holds, or a sentence saying why it could not be read.
 */
export function readCalendar(text: string): { events: JSCalendar.Event[] } | { problem: string } {
	let trimmed = text.trim();
	if (trimmed.startsWith("BEGIN:VCALENDAR")) {
		let parsed = parseICalendar(trimmed);
		if (isFailure(parsed))
			return { problem: "That file isn't an iCalendar file Sundial can read." };
		let group = fromICalendar(parsed.data.calendar);
		return {
			events: group.entries
				.filter((entry): entry is JSCalendar.Event => entry["@type"] === "Event")
				.map(lean),
		};
	}
	let parsed = parseJSCalendar(trimmed);
	if (isFailure(parsed)) return { problem: "That file isn't an iCalendar or JSCalendar file." };
	let object = parsed.data;
	if (object["@type"] === "Event") return { events: [lean(object)] };
	if (object["@type"] === "Group")
		return {
			events: object.entries
				.filter((entry): entry is JSCalendar.Event => entry["@type"] === "Event")
				.map(lean),
		};
	return { problem: "A task list has no events to add." };
}
