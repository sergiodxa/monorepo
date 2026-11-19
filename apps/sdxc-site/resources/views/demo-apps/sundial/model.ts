/**
 * Sundial's events as JSCalendar (RFC 8984): every event is a JSCalendar Event filed under one of
 * the visitor's calendars, guests are Participants, repeats are recurrence rules, and one moved or
 * skipped occurrence is a recurrence override. Screens read events only through these accessors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSCalendar } from "@sdxc/jscalendar";

import { formatDuration, parseDuration } from "@sdxc/jscalendar";

import type { RepeatId, Rsvp, Seed } from "./data";

import { CALENDARS, ME, colorValue, findCalendar, findPerson } from "./data";

/** The domain every invented address is at, so an exported `.ics` reads as one team's. */
export const DOMAIN = "ridgeline.studio";

/** One event and the calendar it is filed under, which a JSCalendar Group holds as its entries. */
export interface Entry {
	calendar: string;
	event: JSCalendar.Event;
}

/** A person's address, as `mailto:` participants and iTIP messages carry it. */
export function emailOf(person: string): string {
	return `${person}@${DOMAIN}`;
}

/** A `YYYY-MM-DD` day and a minute of it as a JSCalendar LocalDateTime. */
export function localDateTime(date: string, minute: number): JSCalendar.LocalDateTime {
	let hours = String(Math.floor(minute / 60)).padStart(2, "0");
	let minutes = String(minute % 60).padStart(2, "0");
	return `${date}T${hours}:${minutes}:00`;
}

/** A LocalDateTime split into its day and minute of the day. */
export function splitLocal(value: JSCalendar.LocalDateTime): { date: string; minute: number } {
	return {
		date: value.slice(0, 10),
		minute: Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16)),
	};
}

/** Minutes as a JSCalendar duration, written in days for whole all-day lengths. */
export function durationOf(minutes: number, allDay = false): JSCalendar.Duration {
	if (allDay) return formatDuration({ days: Math.max(1, Math.round(minutes / 1440)) });
	return formatDuration({ hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

/** A duration in minutes, `0` for an unreadable one. */
export function minutesOf(duration: JSCalendar.Duration | undefined): number {
	let parts = parseDuration(duration ?? "PT0S");
	if (parts === null) return 0;
	return (
		(parts.weeks ?? 0) * 10080 +
		(parts.days ?? 0) * 1440 +
		(parts.hours ?? 0) * 60 +
		(parts.minutes ?? 0) +
		Math.floor((parts.seconds ?? 0) / 60)
	);
}

/** The recurrence rules a repeat choice stands for; weekly repeats fall on the event's weekday. */
export function rulesOf(repeat: RepeatId): JSCalendar.RecurrenceRule[] | undefined {
	if (repeat === "daily") return [{ "@type": "RecurrenceRule", frequency: "daily" }];
	if (repeat === "weekdays")
		return [
			{
				"@type": "RecurrenceRule",
				frequency: "weekly",
				byDay: (["mo", "tu", "we", "th", "fr"] as const).map((day) => ({ "@type": "NDay", day })),
			},
		];
	if (repeat === "weekly") return [{ "@type": "RecurrenceRule", frequency: "weekly" }];
	if (repeat === "biweekly")
		return [{ "@type": "RecurrenceRule", frequency: "weekly", interval: 2 }];
	if (repeat === "monthly") return [{ "@type": "RecurrenceRule", frequency: "monthly" }];
	if (repeat === "yearly") return [{ "@type": "RecurrenceRule", frequency: "yearly" }];
	return undefined;
}

/**
 * The repeat choice a set of rules reads as, or `custom` for rules the dialog cannot express
 * (an imported `.ics` may carry any RRULE), which an edit keeps as they are.
 */
export function repeatOf(event: JSCalendar.Event): RepeatId | "custom" {
	let rules = event.recurrenceRules ?? [];
	if (rules.length === 0) return "none";
	let [rule] = rules;
	if (rules.length > 1 || !rule || rule.count !== undefined || rule.until !== undefined)
		return "custom";
	let days = (rule.byDay ?? []).map((entry) => entry.day).join(",");
	let interval = rule.interval ?? 1;
	if (rule.frequency === "daily" && interval === 1 && days === "") return "daily";
	if (rule.frequency === "weekly" && interval === 1 && days === "mo,tu,we,th,fr") return "weekdays";
	if (rule.frequency === "weekly" && days === "" && interval === 1) return "weekly";
	if (rule.frequency === "weekly" && days === "" && interval === 2) return "biweekly";
	if (rule.frequency === "monthly" && interval === 1 && days === "") return "monthly";
	if (rule.frequency === "yearly" && interval === 1 && days === "") return "yearly";
	return "custom";
}

/** The participation status a visitor's answer is written as. */
const STATUS: Record<Rsvp, NonNullable<JSCalendar.Participant["participationStatus"]>> = {
	yes: "accepted",
	maybe: "tentative",
	no: "declined",
	pending: "needs-action",
};

/**
 * Participants for a set of guests: each an attendee reachable by iMIP, the organizer its owner.
 * A guest without an answer in `answers` has not replied yet.
 */
export function participantsOf(
	guests: string[],
	organizer: string,
	answers: Record<string, Rsvp> = {},
): Record<string, JSCalendar.Participant> {
	let ids = [...new Set([organizer, ...guests])];
	return Object.fromEntries(
		ids.map((id) => {
			let person = findPerson(id);
			let participant: JSCalendar.Participant = {
				"@type": "Participant",
				name: person?.name ?? id,
				email: emailOf(id),
				sendTo: { imip: `mailto:${emailOf(id)}` },
				kind: "individual",
				roles: id === organizer ? { owner: true, attendee: true } : { attendee: true },
				participationStatus: id === organizer ? "accepted" : STATUS[answers[id] ?? "pending"],
			};
			if (!guests.includes(id)) participant.roles = { owner: true };
			return [id, participant];
		}),
	);
}

/** Guests' person ids: every attendee participant this demo knows. */
export function guestsOf(event: JSCalendar.Event): string[] {
	return Object.entries(event.participants ?? {})
		.filter(([, participant]) => participant.roles?.attendee === true)
		.map(([id]) => id)
		.filter((id) => findPerson(id) !== undefined);
}

/** The organizer's person id, read from the owner participant. */
export function organizerOf(event: JSCalendar.Event): string | undefined {
	return Object.entries(event.participants ?? {}).find(
		([, participant]) => participant.roles?.owner === true,
	)?.[0];
}

/** The visitor's answer to an event someone else organises, or `undefined` for their own. */
export function rsvpOf(event: JSCalendar.Event): Rsvp | undefined {
	let organizer = organizerOf(event);
	if (organizer === undefined || organizer === ME) return undefined;
	let status = event.participants?.[ME]?.participationStatus;
	if (status === undefined) return undefined;
	return (
		(Object.entries(STATUS).find(([, value]) => value === status)?.[0] as Rsvp | undefined) ??
		"pending"
	);
}

/** The participation status an answer is written as. */
export function statusOf(answer: Rsvp): NonNullable<JSCalendar.Participant["participationStatus"]> {
	return STATUS[answer];
}

/** The place's name, from the event's first location. */
export function locationOf(event: JSCalendar.Event): string | undefined {
	return Object.values(event.locations ?? {})[0]?.name;
}

/** Whether an event is all-day: its times are noise, its days are what count. */
export function isAllDay(event: JSCalendar.Event): boolean {
	return event.showWithoutTime === true;
}

/** The colour an event draws in: its own, else its calendar's. */
export function eventColor(entry: { calendar: string; event: JSCalendar.Event }): string {
	return entry.event.color ?? colorValue(findCalendar(entry.calendar)?.color);
}

/** Whether a calendar takes edits: owned, not subscribed. */
export function isEditable(calendar: string): boolean {
	return CALENDARS.some((entry) => entry.id === calendar && !entry.subscribed);
}

/** A seed, as the JSCalendar Event Sundial stores. */
export function toEntry(seed: Seed): Entry {
	let allDay = seed.start === null;
	let organizer = seed.organizer ?? ME;
	let answers: Record<string, Rsvp> = Object.fromEntries(
		seed.guests.map((guest) => [guest, guest === ME ? (seed.rsvp ?? "yes") : "yes"]),
	);
	let event: JSCalendar.Event = {
		"@type": "Event",
		uid: seed.id,
		title: seed.title,
		start: localDateTime(seed.date, seed.start ?? 0),
		duration: durationOf(allDay ? seed.length * 1440 : seed.length, allDay),
		timeZone: allDay ? null : seed.zone,
		freeBusyStatus: allDay ? "free" : "busy",
	};
	if (allDay) event.showWithoutTime = true;
	let rules = rulesOf(seed.repeat);
	if (rules) event.recurrenceRules = rules;
	if (seed.location) event.locations = { main: { "@type": "Location", name: seed.location } };
	if (seed.notes) event.description = seed.notes;
	if (seed.color) event.color = colorValue(seed.color);
	if (
		seed.guests.length > 0 &&
		!(seed.guests.length === 1 && seed.guests[0] === ME && organizer === ME)
	) {
		event.participants = participantsOf(seed.guests, organizer, answers);
		event.replyTo = { imip: `mailto:${emailOf(organizer)}` };
	}
	return { calendar: seed.calendar, event };
}

/** The answers already given on an event, so rebuilding its guests keeps who said what. */
export function answersOf(event: JSCalendar.Event): Record<string, Rsvp> {
	let answers: Record<string, Rsvp> = {};
	for (let [id, participant] of Object.entries(event.participants ?? {})) {
		let found = Object.entries(STATUS).find(
			([, value]) => value === participant.participationStatus,
		);
		if (found) answers[id] = found[0] as Rsvp;
	}
	return answers;
}
