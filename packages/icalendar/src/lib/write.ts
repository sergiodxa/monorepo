/**
 * Writes the typed model as calendar text: typed fields become properties in a fixed order,
 * untyped properties and components are written back verbatim, and every line is folded at
 * 75 octets and ended with CRLF.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "../types.js";

import type { WrittenValue } from "./values.js";

import { formatContentLine } from "./content-line.js";
import { wallFromMs } from "./expand.js";
import { stringifyRecurrence } from "./recurrence.js";
import { escapeText } from "./text.js";
import {
	formatDateValue,
	formatDuration,
	formatPeriod,
	formatUtcOffset,
	formatWall,
} from "./values.js";

/**
 * A property from a name, a value and parameters.
 *
 * @param name - Upper-cased property name
 * @param value - The value as written
 * @param parameters - Its parameters
 * @returns The property
 */
function property(
	name: string,
	value: string,
	parameters: Record<string, string[]> = {},
): ICalendar.Property {
	return { name, parameters, value };
}

/**
 * A DATE-TIME property for an instant, in UTC.
 *
 * @param name - Upper-cased property name
 * @param date - The instant
 * @returns The property
 */
function utcProperty(name: string, date: Date): ICalendar.Property {
	return property(name, `${formatWall(wallFromMs(Math.floor(date.getTime() / 1000) * 1000))}Z`);
}

/**
 * A property holding a written value and the parameters that type it.
 *
 * @param name - Upper-cased property name
 * @param written - The value and its parameters
 * @returns The property
 */
function typedProperty(name: string, written: WrittenValue): ICalendar.Property {
	return property(name, written.value, written.parameters);
}

/**
 * A `VALUE` and `TZID` key grouping date values that can share one property line.
 *
 * @param written - A written value
 * @returns The key
 */
function groupKey(written: WrittenValue): string {
	return JSON.stringify(written.parameters);
}

/**
 * `RDATE` or `EXDATE` lines, one per run of consecutive values sharing their parameters,
 * so a list of UTC times stays on one line and a zone change starts a new one.
 *
 * @param name - `RDATE` or `EXDATE`
 * @param values - The dates and periods
 * @returns The properties
 */
function dateListProperties(
	name: string,
	values: (ICalendar.DateValue | ICalendar.Period)[],
): ICalendar.Property[] {
	let properties: ICalendar.Property[] = [];
	let lastKey = "";
	for (let value of values) {
		let written =
			value.type === "period"
				? (() => {
						let period = formatPeriod(value);
						return { value: period.value, parameters: { ...period.parameters, VALUE: ["PERIOD"] } };
					})()
				: formatDateValue(value);
		let key = groupKey(written);
		let last = properties.at(-1);
		if (last && key === lastKey) last.value += `,${written.value}`;
		else properties.push(typedProperty(name, written));
		lastKey = key;
	}
	return properties;
}

/**
 * An `ORGANIZER` or `ATTENDEE` property: `CN`, the attendee's typed parameters, then the
 * untyped ones.
 *
 * @param name - The property name
 * @param user - The calendar user
 * @returns The property
 */
function userProperty(
	name: string,
	user: ICalendar.CalendarUser | ICalendar.Attendee,
): ICalendar.Property {
	let parameters: Record<string, string[]> = {};
	if (user.name !== undefined) parameters.CN = [user.name];
	if ("role" in user && user.role) parameters.ROLE = [user.role];
	if ("participation" in user && user.participation) parameters.PARTSTAT = [user.participation];
	if ("rsvp" in user && user.rsvp !== undefined) parameters.RSVP = [user.rsvp ? "TRUE" : "FALSE"];
	return property(name, user.address, { ...parameters, ...user.parameters });
}

/**
 * A `VALARM` as a component. `before` is written negated, since `TRIGGER:-PT15M` is what
 * fires fifteen minutes before.
 *
 * @param alarm - The alarm
 * @returns The component
 */
function alarmComponent(alarm: ICalendar.Alarm): ICalendar.Component {
	let properties = [property("ACTION", alarm.action)];
	if ("at" in alarm.trigger) {
		let trigger = utcProperty("TRIGGER", alarm.trigger.at);
		trigger.parameters.VALUE = ["DATE-TIME"];
		properties.push(trigger);
	} else {
		let before = alarm.trigger.before;
		let offset = { ...before, negative: !before.negative };
		let parameters: Record<string, string[]> = alarm.trigger.related
			? { RELATED: [alarm.trigger.related] }
			: {};
		properties.push(property("TRIGGER", formatDuration(offset), parameters));
	}
	if (alarm.description !== undefined)
		properties.push(property("DESCRIPTION", escapeText(alarm.description)));
	if (alarm.summary !== undefined) properties.push(property("SUMMARY", escapeText(alarm.summary)));
	for (let attendee of alarm.attendees ?? []) properties.push(userProperty("ATTENDEE", attendee));
	if (alarm.repeat) {
		properties.push(property("REPEAT", String(alarm.repeat.count)));
		properties.push(property("DURATION", formatDuration(alarm.repeat.every)));
	}
	properties.push(...(alarm.properties ?? []));
	return { name: "VALARM", properties, components: [] };
}

/**
 * A `VEVENT` as a component. An empty `uid` and an invalid `dtstamp`, which the reader
 * produces for an event missing them, are left out, so a round trip keeps the event as read.
 *
 * @param event - The event
 * @returns The component
 */
function eventComponent(event: ICalendar.Event): ICalendar.Component {
	let properties: ICalendar.Property[] = [];
	let add = (name: string, value: string | undefined, escape = true) => {
		if (value !== undefined) properties.push(property(name, escape ? escapeText(value) : value));
	};
	if (event.uid !== "") add("UID", event.uid, false);
	if (!Number.isNaN(event.dtstamp.getTime()))
		properties.push(utcProperty("DTSTAMP", event.dtstamp));
	properties.push(typedProperty("DTSTART", formatDateValue(event.start)));
	if (event.end) properties.push(typedProperty("DTEND", formatDateValue(event.end)));
	else if (event.duration) add("DURATION", formatDuration(event.duration), false);
	if (event.recurrenceId)
		properties.push(typedProperty("RECURRENCE-ID", formatDateValue(event.recurrenceId)));
	if (event.recurrence) add("RRULE", stringifyRecurrence(event.recurrence), false);
	properties.push(...dateListProperties("RDATE", event.recurrenceDates ?? []));
	properties.push(...dateListProperties("EXDATE", event.exceptionDates ?? []));
	add("SUMMARY", event.summary);
	add("DESCRIPTION", event.description);
	add("LOCATION", event.location);
	add("URL", event.url, false);
	add("STATUS", event.status, false);
	add("TRANSP", event.transparency, false);
	if (event.sequence !== undefined) add("SEQUENCE", String(event.sequence), false);
	if (event.created) properties.push(utcProperty("CREATED", event.created));
	if (event.lastModified) properties.push(utcProperty("LAST-MODIFIED", event.lastModified));
	if (event.categories?.length)
		add("CATEGORIES", event.categories.map(escapeText).join(","), false);
	if (event.organizer) properties.push(userProperty("ORGANIZER", event.organizer));
	for (let attendee of event.attendees ?? []) properties.push(userProperty("ATTENDEE", attendee));
	properties.push(...event.properties);
	return { name: "VEVENT", properties, components: (event.alarms ?? []).map(alarmComponent) };
}

/**
 * A `VTIMEZONE` as a component, observances in the order given.
 *
 * @param zone - The time zone
 * @returns The component
 */
function timeZoneComponent(zone: ICalendar.TimeZone): ICalendar.Component {
	let components = zone.observances.map((observance): ICalendar.Component => {
		let properties = [property("DTSTART", formatWall(observance.start))];
		if (observance.recurrence)
			properties.push(property("RRULE", stringifyRecurrence(observance.recurrence)));
		if (observance.recurrenceDates?.length) {
			properties.push(property("RDATE", observance.recurrenceDates.map(formatWall).join(",")));
		}
		properties.push(property("TZOFFSETFROM", formatUtcOffset(observance.offsetFrom)));
		properties.push(property("TZOFFSETTO", formatUtcOffset(observance.offsetTo)));
		if (observance.name !== undefined)
			properties.push(property("TZNAME", escapeText(observance.name)));
		properties.push(...(observance.properties ?? []));
		return { name: observance.kind, properties, components: [] };
	});
	return {
		name: "VTIMEZONE",
		properties: [property("TZID", zone.tzid), ...(zone.properties ?? [])],
		components,
	};
}

/**
 * The calendar as one component tree: `VERSION` and `PRODID` first, the RFC 7986 fields
 * each followed by the `X-` property older clients read, then zones, events and the rest.
 *
 * @param calendar - The calendar
 * @returns The `VCALENDAR` component
 */
function calendarComponent(calendar: ICalendar.Calendar): ICalendar.Component {
	let properties = [property("VERSION", "2.0"), property("PRODID", calendar.productId)];
	if (calendar.method) properties.push(property("METHOD", calendar.method));
	if (calendar.name !== undefined) {
		properties.push(property("NAME", escapeText(calendar.name)));
		properties.push(property("X-WR-CALNAME", escapeText(calendar.name)));
	}
	if (calendar.description !== undefined) {
		properties.push(property("DESCRIPTION", escapeText(calendar.description)));
		properties.push(property("X-WR-CALDESC", escapeText(calendar.description)));
	}
	if (calendar.url !== undefined) properties.push(property("URL", calendar.url));
	if (calendar.refreshInterval) {
		let interval = formatDuration(calendar.refreshInterval);
		properties.push(property("REFRESH-INTERVAL", interval, { VALUE: ["DURATION"] }));
		properties.push(property("X-PUBLISHED-TTL", interval));
	}
	properties.push(...calendar.properties);
	return {
		name: "VCALENDAR",
		properties,
		components: [
			...calendar.timeZones.map(timeZoneComponent),
			...calendar.events.map(eventComponent),
			...calendar.components,
		],
	};
}

/**
 * Writes a component and everything inside it as folded content lines.
 *
 * @param component - The component
 * @param lines - Receives the lines
 */
function writeComponent(component: ICalendar.Component, lines: string[]): void {
	lines.push(`BEGIN:${component.name}`);
	for (let entry of component.properties) lines.push(formatContentLine(entry));
	for (let child of component.components) writeComponent(child, lines);
	lines.push(`END:${component.name}`);
}

/**
 * Writes a calendar as text: CRLF after every line, the last one included.
 *
 * @param calendar - The calendar
 * @returns The calendar text
 */
export function writeCalendar(calendar: ICalendar.Calendar): string {
	let lines: string[] = [];
	writeComponent(calendarComponent(calendar), lines);
	return `${lines.join("\r\n")}\r\n`;
}
