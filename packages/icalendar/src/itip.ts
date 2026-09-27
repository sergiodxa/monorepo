/**
 * iTIP (RFC 5546) scheduling messages for events: the organizer's `REQUEST` and `CANCEL`, an
 * attendee's `REPLY`, reading a reply's participation status, the §2.1.4 sequence rule, and
 * the calendar part a mailer sends an invitation as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { ICalendar } from "./types.js";

import { ITipError } from "./lib/errors.js";
import { wallMs } from "./lib/expand.js";
import { readAttendee, readCalendarUser } from "./lib/read.js";
import { escapeText } from "./lib/text.js";
import { parseDateTime, parseDateValue } from "./lib/values.js";

import { parse, stringify } from "./index.js";

export { ITipError } from "./lib/errors.js";

/**
 * Groups the iTIP option and result types under a single import surface.
 */
export namespace ITip {
	/** What every scheduling message carries besides the event. */
	export interface Options {
		/** `PRODID` of the calendar the message is written as. */
		productId: string;
		/**
		 * `DTSTAMP`: with a `METHOD`, when the message was created, which recipients use to
		 * order two messages with the same `SEQUENCE`.
		 * @default new Date()
		 */
		dtstamp?: Date;
		/** The `VTIMEZONE`s the event's `TZID`s name; UTC and floating times need none. */
		timeZones?: ICalendar.TimeZone[];
	}

	/** A `CANCEL` for the whole event, or for some attendees only. */
	export interface CancelOptions extends Options {
		/**
		 * Addresses of the attendees to uninvite, compared case-insensitively with or without
		 * `mailto:`. Omitted, the whole event is cancelled for every attendee.
		 */
		attendees?: string[];
	}

	/** An attendee's answer to a `REQUEST`. */
	export interface ReplyOptions extends Options {
		/** The replying attendee's address, usually one the request invited. */
		attendee: string;
		participation: "ACCEPTED" | "DECLINED" | "TENTATIVE" | "DELEGATED" | "NEEDS-ACTION";
		/** `COMMENT` for the organizer, e.g. why the answer is tentative. */
		comment?: string;
	}

	/** One `VEVENT` of a `REPLY`: which revision of which event, and the attendee's answer. */
	export interface Reply {
		uid: string;
		/** The revision answered; a reply without `SEQUENCE` answers revision `0`. */
		sequence: number;
		/** Invalid when the reply carries no readable `DTSTAMP`. */
		dtstamp: Date;
		/** Set when the reply answers one instance of a recurring event. */
		recurrenceId?: ICalendar.DateValue;
		organizer?: ICalendar.CalendarUser;
		/** The replying attendee; `participation` is unset when `PARTSTAT` is missing or unknown. */
		attendee: ICalendar.Attendee;
	}

	/**
	 * A `text/calendar` part for a mail message: the shape a mailer takes to send it as an
	 * alternative part with `method=`, optionally attached as a file too.
	 */
	export interface CalendarPart {
		method: string;
		content: string;
		filename?: string;
	}
}

/** The properties whose change RFC 5546 §2.1.4 says MUST increment `SEQUENCE`. */
const SIGNIFICANT_FIELDS = [
	"start",
	"end",
	"duration",
	"recurrence",
	"recurrenceDates",
	"exceptionDates",
	"status",
] as const satisfies readonly (keyof ICalendar.Event)[];

/** The failure message for a `VEVENT` that does not name exactly the one attendee replying. */
const ONE_ATTENDEE = "A REPLY's VEVENT carries exactly one ATTENDEE.";

/** The `mailto:` scheme prefix, matched without regard to case. */
const MAILTO = /^mailto:/i;

/**
 * An address in the form two spellings of one calendar user share: lower-cased, without
 * `mailto:`. Mailbox local parts can be case-sensitive, and no client relies on that.
 *
 * @param address - A `mailto:` URI or a bare address
 * @returns The comparable form
 */
function addressKey(address: string): string {
	return address.replace(MAILTO, "").toLowerCase();
}

/**
 * Serializes a value with object keys sorted, so two equal values built in different key
 * orders compare equal.
 *
 * @param value - A JSON-compatible value
 * @returns Its canonical text
 */
function canonical(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	let entries = Object.entries(value)
		.filter(([, item]) => item !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : 1));
	return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

/**
 * The checks every organizer message shares: an event is identified by its `UID` and sent
 * by its `ORGANIZER`, so neither can be missing.
 *
 * @param event - The event to send
 * @param method - The method, for the failure message
 * @returns The organizer, or the failure
 */
function organizerOf(
	event: ICalendar.Event,
	method: string,
): Result<ICalendar.CalendarUser, ITipError> {
	if (event.uid === "") return failure(new ITipError(`A ${method} needs the event's UID.`));
	if (!event.organizer) return failure(new ITipError(`A ${method} needs an ORGANIZER.`));
	return success(event.organizer);
}

/**
 * A scheduling calendar holding one event.
 *
 * @param method - The iTIP method
 * @param event - The event as the message carries it
 * @param options - The product identifier and time zones
 * @returns The calendar
 */
function message(
	method: string,
	event: ICalendar.Event,
	options: ITip.Options,
): ICalendar.Calendar {
	return {
		productId: options.productId,
		method,
		timeZones: options.timeZones ?? [],
		events: [event],
		components: [],
		properties: [],
	};
}

/**
 * The `SEQUENCE` a revised event carries: one more than before when a property RFC 5546
 * §2.1.4 names changed (`DTSTART`, `DTEND`, `DURATION`, `RRULE`, `RDATE`, `EXDATE`,
 * `STATUS`), the same otherwise. A change the organizer deems significant, like a distant new
 * `LOCATION`, is theirs to bump on top.
 *
 * @param previous - The event as attendees last received it
 * @param next - The revised event
 * @returns The sequence to send `next` with
 * @example let revised = { ...event, start, sequence: nextSequence(event, { ...event, start }) };
 */
export function nextSequence(previous: ICalendar.Event, next: ICalendar.Event): number {
	let sequence = previous.sequence ?? 0;
	let changed = SIGNIFICANT_FIELDS.some(
		(field) => canonical(previous[field]) !== canonical(next[field]),
	);
	return changed ? sequence + 1 : sequence;
}

/**
 * A `METHOD:REQUEST` inviting the event's attendees, or sending them a revision, with the
 * event's `SEQUENCE` as given. An attendee with neither `PARTSTAT` nor `RSVP` gets
 * `NEEDS-ACTION`, and `RSVP=TRUE` unless their role is `NON-PARTICIPANT`.
 *
 * @param event - The event, with its organizer and at least one attendee
 * @param options - The product identifier, message timestamp and time zones
 * @returns The calendar to send, or why the event cannot be requested
 * @example let invitation = request({ ...event, sequence: nextSequence(sent, event) }, { productId });
 */
export function request(
	event: ICalendar.Event,
	options: ITip.Options,
): Result<ICalendar.Calendar, ITipError> {
	let organizer = organizerOf(event, "REQUEST");
	if (isFailure(organizer)) return organizer;
	if (!event.attendees?.length) {
		return failure(new ITipError("A REQUEST needs at least one ATTENDEE."));
	}
	if (event.status === "CANCELLED") {
		return failure(new ITipError("A cancelled event is sent with cancel(), not request()."));
	}

	let attendees = event.attendees.map((attendee): ICalendar.Attendee => {
		if (attendee.participation || attendee.rsvp !== undefined) return attendee;
		let rsvp = attendee.role !== "NON-PARTICIPANT";
		return { ...attendee, participation: "NEEDS-ACTION", rsvp };
	});

	return success(
		message(
			"REQUEST",
			{
				...event,
				dtstamp: options.dtstamp ?? new Date(),
				summary: event.summary ?? "",
				attendees,
			},
			options,
		),
	);
}

/**
 * A `METHOD:CANCEL`. Without `attendees` it cancels the whole event for everyone with
 * `STATUS:CANCELLED`; with them it uninvites just those, without a status. Either way the
 * sequence goes up by one, as §2.1.4 requires of a `CANCEL`, and no attendee is asked to reply.
 *
 * @param event - The event as attendees last received it
 * @param options - The product identifier, message timestamp, and attendees to uninvite
 * @returns The calendar to send, or why the event cannot be cancelled
 * @example let cancellation = cancel(event, { productId, attendees: ["mailto:b@example.com"] });
 */
export function cancel(
	event: ICalendar.Event,
	options: ITip.CancelOptions,
): Result<ICalendar.Calendar, ITipError> {
	let organizer = organizerOf(event, "CANCEL");
	if (isFailure(organizer)) return organizer;

	let attendees = event.attendees ?? [];
	if (options.attendees) {
		let keys = options.attendees.map(addressKey);
		let known = new Set(attendees.map((attendee) => addressKey(attendee.address)));
		let unknown = options.attendees.find((address) => !known.has(addressKey(address)));
		if (unknown !== undefined) {
			return failure(new ITipError(`${unknown} is not an attendee of the event.`));
		}
		attendees = attendees.filter((attendee) => keys.includes(addressKey(attendee.address)));
	}
	if (attendees.length === 0) {
		return failure(new ITipError("A CANCEL needs at least one ATTENDEE to notify."));
	}

	let { alarms: _, status: __, ...rest } = event;
	let cancelled: ICalendar.Event = {
		...rest,
		dtstamp: options.dtstamp ?? new Date(),
		sequence: (event.sequence ?? 0) + 1,
		attendees: attendees.map(({ participation: _p, rsvp: _r, ...attendee }) => attendee),
	};
	if (!options.attendees) cancelled.status = "CANCELLED";

	return success(message("CANCEL", cancelled, options));
}

/**
 * A `METHOD:REPLY` from one attendee. It echoes the request's `UID`, `SEQUENCE` and
 * `RECURRENCE-ID` unchanged, as §2.1.4 requires of a reply, and carries only that attendee,
 * keeping the name and parameters the request gave them.
 *
 * @param event - The event as the request delivered it
 * @param options - The product identifier, the replying attendee and their answer
 * @returns The calendar to send the organizer, or why the event cannot be answered
 * @example let answer = reply(event, { productId, attendee: "mailto:b@example.com", participation: "ACCEPTED" });
 */
export function reply(
	event: ICalendar.Event,
	options: ITip.ReplyOptions,
): Result<ICalendar.Calendar, ITipError> {
	let organizer = organizerOf(event, "REPLY");
	if (isFailure(organizer)) return organizer;

	let key = addressKey(options.attendee);
	let invited = event.attendees?.find((attendee) => addressKey(attendee.address) === key);
	let { rsvp: _, ...attendee } = invited ?? { address: options.attendee };

	let answer: ICalendar.Event = {
		uid: event.uid,
		dtstamp: options.dtstamp ?? new Date(),
		start: event.start,
		organizer: organizer.data,
		attendees: [{ ...attendee, participation: options.participation }],
		properties: [],
	};
	if (event.sequence !== undefined) answer.sequence = event.sequence;
	if (event.recurrenceId) answer.recurrenceId = event.recurrenceId;
	if (event.summary !== undefined) answer.summary = event.summary;
	if (options.comment !== undefined) {
		answer.properties.push({ name: "COMMENT", parameters: {}, value: escapeText(options.comment) });
	}

	return success(message("REPLY", answer, options));
}

/**
 * Reads the reply a typed `VEVENT` carries.
 *
 * @param event - The event
 * @returns The reply, or why the event is not one
 */
function replyFromEvent(event: ICalendar.Event): Result<ITip.Reply, ITipError> {
	let [attendee, ...others] = event.attendees ?? [];
	if (!attendee || others.length > 0) return failure(new ITipError(ONE_ATTENDEE));
	if (event.uid === "") return failure(new ITipError("A REPLY's VEVENT needs a UID."));
	let reply: ITip.Reply = {
		uid: event.uid,
		sequence: event.sequence ?? 0,
		dtstamp: event.dtstamp,
		attendee,
	};
	if (event.organizer) reply.organizer = event.organizer;
	if (event.recurrenceId) reply.recurrenceId = event.recurrenceId;
	return success(reply);
}

/**
 * Reads the reply a `VEVENT` kept verbatim carries; the reader keeps one without `DTSTART`
 * that way, and a reply may omit `DTSTART`.
 *
 * @param component - The `VEVENT` component
 * @returns The reply, or why the component is not one
 */
function replyFromComponent(component: ICalendar.Component): Result<ITip.Reply, ITipError> {
	let find = (name: string) => component.properties.find((property) => property.name === name);
	let attendees = component.properties.filter((property) => property.name === "ATTENDEE");
	let [attendee, ...others] = attendees;
	if (!attendee || others.length > 0) return failure(new ITipError(ONE_ATTENDEE));
	let uid = find("UID")?.value;
	if (!uid) return failure(new ITipError("A REPLY's VEVENT needs a UID."));

	let sequence = find("SEQUENCE")?.value ?? "0";
	let stamp = parseDateTime(find("DTSTAMP")?.value ?? "");
	let reply: ITip.Reply = {
		uid,
		sequence: /^\d+$/.test(sequence) ? Number(sequence) : 0,
		dtstamp: new Date(stamp ? wallMs(stamp.wall) : Number.NaN),
		attendee: readAttendee(attendee),
	};
	let organizer = find("ORGANIZER");
	if (organizer) reply.organizer = readCalendarUser(organizer);
	let recurrenceId = find("RECURRENCE-ID");
	let instance = recurrenceId && parseDateValue(recurrenceId.value, recurrenceId.parameters);
	if (instance) reply.recurrenceId = instance;
	return success(reply);
}

/**
 * Reads a `METHOD:REPLY`: one entry per `VEVENT`, so a reply covering several instances of a
 * recurring event lists each with its `recurrenceId`. Text that does not parse, another
 * method, or a `VEVENT` without its one `ATTENDEE` or its `UID` fail.
 *
 * @param source - The reply's text, or a calendar already parsed
 * @returns The answers it carries, or why it is not a reply
 * @example let [answer] = unwrap(readReply(text)); // answer.attendee.participation === "ACCEPTED"
 */
export function readReply(source: string | ICalendar.Calendar): Result<ITip.Reply[], ITipError> {
	let calendar = source;
	if (typeof calendar === "string") {
		let parsed = parse(calendar);
		if (isFailure(parsed)) {
			return failure(new ITipError("The reply does not parse.", { cause: parsed.error }));
		}
		calendar = parsed.data.calendar;
	}
	if (calendar.method !== "REPLY") {
		return failure(new ITipError(`Expected METHOD:REPLY, found ${calendar.method ?? "none"}.`));
	}

	let read = [
		...calendar.events.map(replyFromEvent),
		...calendar.components
			.filter((component) => component.name === "VEVENT")
			.map(replyFromComponent),
	];
	if (read.length === 0) return failure(new ITipError("A REPLY needs a VEVENT."));

	let replies: ITip.Reply[] = [];
	for (let entry of read) {
		if (isFailure(entry)) return entry;
		replies.push(entry.data);
	}
	return success(replies);
}

/**
 * The part a mailer sends a scheduling calendar as: the calendar's method, `PUBLISH` when it
 * has none, and its text. A mailer that takes this shape writes it as
 * `text/calendar; method=…`, which is what makes a client offer accept and decline.
 *
 * @param calendar - The calendar built by `request`, `cancel` or `reply`
 * @param options - `filename` also attaches the calendar as that file
 * @returns The part
 * @example await mailer.send({ ...message, calendar: calendarPart(unwrap(request(event, { productId }))) });
 */
export function calendarPart(
	calendar: ICalendar.Calendar,
	options: { filename?: string } = {},
): ITip.CalendarPart {
	let part: ITip.CalendarPart = {
		method: calendar.method ?? "PUBLISH",
		content: stringify(calendar),
	};
	if (options.filename !== undefined) part.filename = options.filename;
	return part;
}
