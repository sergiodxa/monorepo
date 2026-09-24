/**
 * Reads calendar text into the typed model: content lines into a component tree, failing on
 * structural errors, then each `VCALENDAR` into typed events, alarms and time zones, with
 * every property and component the model does not name kept verbatim and every recoverable
 * departure from the RFC reported as a warning.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { ICalendar } from "../types.js";

import { parseContentLine, unfold } from "./content-line.js";
import { ICalendarParseError } from "./errors.js";
import { wallMs } from "./expand.js";
import { parseRecurrence } from "./recurrence.js";
import { splitList, unescapeText } from "./text.js";
import {
	parseDateTime,
	parseDateValue,
	parseDuration,
	parsePeriod,
	parseUtcOffset,
} from "./values.js";

/** A property with the physical line it started on. */
interface LineProperty {
	property: ICalendar.Property;
	line: number;
}

/** A component as read, with line numbers kept for warnings. */
interface Node {
	name: string;
	line: number;
	properties: LineProperty[];
	children: Node[];
}

/** Collects warnings while a calendar is typed. */
type Warn = (line: number, message: string) => void;

/** Event statuses the model types. */
const EVENT_STATUSES = ["TENTATIVE", "CONFIRMED", "CANCELLED"] as const;

/** Attendee roles the model types. */
const ROLES = ["CHAIR", "REQ-PARTICIPANT", "OPT-PARTICIPANT", "NON-PARTICIPANT"] as const;

/** Participation statuses the model types. */
const PARTICIPATION = ["NEEDS-ACTION", "ACCEPTED", "DECLINED", "TENTATIVE", "DELEGATED"] as const;

/**
 * Reads calendar text into its top-level `VCALENDAR` nodes. Every `BEGIN` needs its `END`,
 * every line needs a name and a `:`, and nothing may sit outside a `VCALENDAR`.
 *
 * @param source - The calendar text
 * @returns The calendars, or the first structural failure
 */
export function readTree(source: string): Result<Node[], ICalendarParseError> {
	let calendars: Node[] = [];
	let stack: Node[] = [];
	for (let { text, line } of unfold(source)) {
		let parsed = parseContentLine(text);
		if (isFailure(parsed)) return failure(new ICalendarParseError(parsed.error.message, line));
		let property = parsed.data;
		let parent = stack.at(-1);
		if (property.name === "BEGIN") {
			let name = property.value.trim().toUpperCase();
			if (!parent && name !== "VCALENDAR") {
				return failure(
					new ICalendarParseError(`expected BEGIN:VCALENDAR, found BEGIN:${name}`, line),
				);
			}
			let node: Node = { name, line, properties: [], children: [] };
			if (parent) parent.children.push(node);
			else calendars.push(node);
			stack.push(node);
		} else if (property.name === "END") {
			let name = property.value.trim().toUpperCase();
			if (!parent) return failure(new ICalendarParseError(`END:${name} has no BEGIN`, line));
			if (parent.name !== name) {
				return failure(
					new ICalendarParseError(
						`END:${name} closes BEGIN:${parent.name} from line ${parent.line}`,
						line,
					),
				);
			}
			stack.pop();
		} else if (!parent) {
			return failure(new ICalendarParseError(`${property.name} sits outside a VCALENDAR`, line));
		} else parent.properties.push({ property, line });
	}
	let open = stack.at(-1);
	if (open)
		return failure(new ICalendarParseError(`BEGIN:${open.name} is never closed`, open.line));
	if (calendars.length === 0)
		return failure(new ICalendarParseError("the text holds no VCALENDAR", 1));
	return success(calendars);
}

/**
 * A node as an untyped component, dropping the line numbers.
 *
 * @param node - The node
 * @returns The component, verbatim
 */
function toComponent(node: Node): ICalendar.Component {
	return {
		name: node.name,
		properties: node.properties.map(({ property }) => property),
		components: node.children.map(toComponent),
	};
}

/**
 * Reads a DATE-TIME property that the RFC requires in UTC into a `Date`. A zoned or
 * floating value is read as UTC, since nothing else is available at this point.
 *
 * @param property - The property
 * @returns The instant, or `null` when the value does not parse
 */
function readUtcDate(property: ICalendar.Property): Date | null {
	let parsed = parseDateTime(property.value);
	return parsed ? new Date(wallMs(parsed.wall)) : null;
}

/**
 * Reads the value of an `ORGANIZER`, `ATTENDEE` or alarm `ATTENDEE` into a calendar user.
 * Parameters other than `CN` and the ones the caller types stay in `parameters`.
 *
 * @param property - The property
 * @param typed - Parameter names the caller reads into typed fields
 * @returns The user
 */
function readCalendarUser(
	property: ICalendar.Property,
	typed: string[] = [],
): ICalendar.CalendarUser {
	let user: ICalendar.CalendarUser = { address: property.value };
	let parameters: Record<string, string[]> = {};
	for (let [name, values] of Object.entries(property.parameters)) {
		if (name === "CN" && values[0] !== undefined) user.name = values[0];
		else if (!typed.includes(name)) parameters[name] = values;
	}
	if (Object.keys(parameters).length > 0) user.parameters = parameters;
	return user;
}

/**
 * Reads an `ATTENDEE`, typing `ROLE`, `PARTSTAT` and `RSVP` when they hold values the model
 * names; any other value stays in `parameters`.
 *
 * @param property - The property
 * @returns The attendee
 */
function readAttendee(property: ICalendar.Property): ICalendar.Attendee {
	let role = property.parameters.ROLE?.[0]?.toUpperCase();
	let participation = property.parameters.PARTSTAT?.[0]?.toUpperCase();
	let rsvp = property.parameters.RSVP?.[0]?.toUpperCase();
	let knownRole = ROLES.find((candidate) => candidate === role);
	let knownParticipation = PARTICIPATION.find((candidate) => candidate === participation);
	let knownRsvp = rsvp === "TRUE" || rsvp === "FALSE";
	let typed: string[] = [];
	if (knownRole) typed.push("ROLE");
	if (knownParticipation) typed.push("PARTSTAT");
	if (knownRsvp) typed.push("RSVP");
	let attendee: ICalendar.Attendee = readCalendarUser(property, typed);
	if (knownRole) attendee.role = knownRole;
	if (knownParticipation) attendee.participation = knownParticipation;
	if (knownRsvp) attendee.rsvp = rsvp === "TRUE";
	return attendee;
}

/**
 * Reads a `VALARM`. An alarm with no `ACTION` or no readable `TRIGGER` is dropped with a
 * warning, since a client cannot fire it.
 *
 * @param node - The alarm node
 * @param warn - Collects warnings
 * @returns The alarm, or `null`
 */
function readAlarm(node: Node, warn: Warn): ICalendar.Alarm | null {
	let action: string | undefined;
	let trigger: ICalendar.Alarm["trigger"] | undefined;
	let alarm: Omit<ICalendar.Alarm, "action" | "trigger"> = {};
	let properties: ICalendar.Property[] = [];
	let repeatCount: number | undefined;
	let repeatEvery: ICalendar.Duration | undefined;
	for (let { property } of node.properties) {
		let { name, value, parameters } = property;
		if (name === "ACTION") action = value.toUpperCase();
		else if (name === "TRIGGER") {
			if (parameters.VALUE?.[0]?.toUpperCase() === "DATE-TIME") {
				let at = readUtcDate(property);
				if (at) trigger = { at };
			} else {
				let duration = parseDuration(value);
				if (duration) {
					let before: ICalendar.Duration = { ...duration };
					if (duration.negative) delete before.negative;
					else before.negative = true;
					let related = parameters.RELATED?.[0]?.toUpperCase();
					trigger = related === "END" || related === "START" ? { before, related } : { before };
				}
			}
		} else if (name === "DESCRIPTION") alarm.description = unescapeText(value);
		else if (name === "SUMMARY") alarm.summary = unescapeText(value);
		else if (name === "ATTENDEE") (alarm.attendees ??= []).push(readCalendarUser(property));
		else if (name === "REPEAT" && /^\d+$/.test(value)) repeatCount = Number(value);
		else if (name === "DURATION" && parseDuration(value)) repeatEvery = parseDuration(value) ?? {};
		else properties.push(property);
	}
	if (!action || !trigger) {
		warn(node.line, "VALARM without a readable ACTION and TRIGGER was dropped");
		return null;
	}
	if (repeatCount !== undefined && repeatEvery)
		alarm.repeat = { count: repeatCount, every: repeatEvery };
	if (properties.length > 0) alarm.properties = properties;
	return { action, trigger, ...alarm };
}

/**
 * Reads a `VEVENT`. `DTSTART` is required to type it; without one the event stays an untyped
 * component. A missing `UID` or `DTSTAMP` is a warning, and a known property whose value
 * does not parse stays in `properties` with a warning.
 *
 * @param node - The event node
 * @param warn - Collects warnings
 * @returns The event, or `null` when it has no readable `DTSTART`
 */
function readEvent(node: Node, warn: Warn): ICalendar.Event | null {
	let event: Partial<ICalendar.Event> & { properties: ICalendar.Property[] } = { properties: [] };
	let keep = (entry: LineProperty, reason?: string) => {
		if (reason) warn(entry.line, reason);
		event.properties.push(entry.property);
	};
	for (let entry of node.properties) {
		let { property } = entry;
		let { name, value, parameters } = property;
		let invalid = `${name}:${value} does not parse; kept untyped`;
		if (name === "UID") event.uid = value;
		else if (name === "DTSTAMP" || name === "CREATED" || name === "LAST-MODIFIED") {
			let date = readUtcDate(property);
			if (!date) keep(entry, invalid);
			else if (name === "DTSTAMP") event.dtstamp = date;
			else if (name === "CREATED") event.created = date;
			else event.lastModified = date;
		} else if (name === "DTSTART" || name === "DTEND" || name === "RECURRENCE-ID") {
			let date = parseDateValue(value, parameters);
			if (!date) keep(entry, invalid);
			else if (name === "DTSTART") event.start = date;
			else if (name === "DTEND") event.end = date;
			else event.recurrenceId = date;
		} else if (name === "DURATION") {
			let duration = parseDuration(value);
			if (duration) event.duration = duration;
			else keep(entry, invalid);
		} else if (name === "SUMMARY") event.summary = unescapeText(value);
		else if (name === "DESCRIPTION") event.description = unescapeText(value);
		else if (name === "LOCATION") event.location = unescapeText(value);
		else if (name === "URL") event.url = value;
		else if (name === "STATUS") {
			let status = EVENT_STATUSES.find((candidate) => candidate === value.toUpperCase());
			if (status) event.status = status;
			else keep(entry, invalid);
		} else if (name === "TRANSP") {
			let transparency = value.toUpperCase();
			if (transparency === "OPAQUE" || transparency === "TRANSPARENT")
				event.transparency = transparency;
			else keep(entry, invalid);
		} else if (name === "SEQUENCE") {
			if (/^\d+$/.test(value)) event.sequence = Number(value);
			else keep(entry, invalid);
		} else if (name === "CATEGORIES") {
			(event.categories ??= []).push(...splitList(value).map(unescapeText));
		} else if (name === "RRULE") {
			let rule = parseRecurrence(value);
			if (isFailure(rule))
				keep(entry, `RRULE:${value} does not parse (${rule.error.message}); kept untyped`);
			else if (event.recurrence) keep(entry, "a second RRULE was kept untyped");
			else event.recurrence = rule.data;
		} else if (name === "RDATE" && parameters.VALUE?.[0]?.toUpperCase() === "PERIOD") {
			let periods = value.split(",").map((item) => parsePeriod(item, parameters));
			if (periods.every((item) => item !== null)) (event.recurrenceDates ??= []).push(...periods);
			else keep(entry, invalid);
		} else if (name === "RDATE" || name === "EXDATE") {
			let dates = value.split(",").map((item) => parseDateValue(item, parameters));
			if (!dates.every((item) => item !== null)) keep(entry, invalid);
			else if (name === "RDATE") (event.recurrenceDates ??= []).push(...dates);
			else (event.exceptionDates ??= []).push(...dates);
		} else if (name === "ORGANIZER") event.organizer = readCalendarUser(property);
		else if (name === "ATTENDEE") (event.attendees ??= []).push(readAttendee(property));
		else keep(entry);
	}
	if (!event.start) {
		warn(node.line, "VEVENT without a readable DTSTART was kept as an untyped component");
		return null;
	}
	if (event.uid === undefined) warn(node.line, "VEVENT has no UID");
	if (event.dtstamp === undefined) warn(node.line, "VEVENT has no DTSTAMP");
	let alarms: ICalendar.Alarm[] = [];
	for (let child of node.children) {
		if (child.name !== "VALARM") {
			warn(child.line, `${child.name} inside a VEVENT was dropped`);
			continue;
		}
		let alarm = readAlarm(child, warn);
		if (alarm) alarms.push(alarm);
	}
	if (alarms.length > 0) event.alarms = alarms;
	return {
		...event,
		uid: event.uid ?? "",
		dtstamp: event.dtstamp ?? new Date(Number.NaN),
		start: event.start,
	};
}

/**
 * Reads a `STANDARD` or `DAYLIGHT` observance.
 *
 * @param node - The observance node
 * @returns The observance, or `null` without a readable `DTSTART` and both offsets
 */
function readObservance(node: Node): ICalendar.Observance | null {
	let start: ICalendar.WallClock | undefined;
	let offsetFrom: number | null = null;
	let offsetTo: number | null = null;
	let observance: Partial<ICalendar.Observance> = {};
	let properties: ICalendar.Property[] = [];
	for (let { property } of node.properties) {
		let { name, value } = property;
		if (name === "DTSTART") start = parseDateTime(value)?.wall;
		else if (name === "TZOFFSETFROM") offsetFrom = parseUtcOffset(value);
		else if (name === "TZOFFSETTO") offsetTo = parseUtcOffset(value);
		else if (name === "TZNAME") observance.name = unescapeText(value);
		else if (name === "RRULE" && !observance.recurrence) {
			let rule = parseRecurrence(value);
			if (isFailure(rule)) properties.push(property);
			else observance.recurrence = rule.data;
		} else if (name === "RDATE" && property.parameters.VALUE?.[0]?.toUpperCase() !== "PERIOD") {
			let walls = value.split(",").map((item) => parseDateTime(item)?.wall);
			if (walls.every((wall) => wall !== undefined))
				(observance.recurrenceDates ??= []).push(...walls);
			else properties.push(property);
		} else properties.push(property);
	}
	if (!start || offsetFrom === null || offsetTo === null) return null;
	if (properties.length > 0) observance.properties = properties;
	let kind: ICalendar.Observance["kind"] = node.name === "DAYLIGHT" ? "DAYLIGHT" : "STANDARD";
	return { kind, start, offsetFrom, offsetTo, ...observance };
}

/**
 * Reads a `VTIMEZONE`. One without a `TZID`, or with an observance missing its onset or
 * offsets, stays an untyped component with a warning.
 *
 * @param node - The time zone node
 * @param warn - Collects warnings
 * @returns The time zone, or `null`
 */
function readTimeZone(node: Node, warn: Warn): ICalendar.TimeZone | null {
	let tzid: string | undefined;
	let properties: ICalendar.Property[] = [];
	for (let { property } of node.properties) {
		if (property.name === "TZID") tzid = property.value;
		else properties.push(property);
	}
	let observances: ICalendar.Observance[] = [];
	for (let child of node.children) {
		let observance =
			child.name === "STANDARD" || child.name === "DAYLIGHT" ? readObservance(child) : null;
		if (!observance) {
			warn(child.line, `${child.name} in VTIMEZONE ${tzid ?? ""} does not parse`);
			return null;
		}
		observances.push(observance);
	}
	if (!tzid) {
		warn(node.line, "VTIMEZONE without a TZID was kept as an untyped component");
		return null;
	}
	let zone: ICalendar.TimeZone = { tzid, observances };
	if (properties.length > 0) zone.properties = properties;
	return zone;
}

/**
 * Types one `VCALENDAR` node. RFC 7986 properties win over their `X-WR-` counterparts when
 * both are present, and both are consumed so a round trip writes each once.
 *
 * @param node - The calendar node
 * @returns The calendar and its warnings
 */
export function readCalendar(node: Node): ICalendar.Parsed {
	let warnings: string[] = [];
	let warn: Warn = (line, message) => warnings.push(`Line ${line}: ${message}`);
	let calendar: ICalendar.Calendar = {
		productId: "",
		timeZones: [],
		events: [],
		components: [],
		properties: [],
	};
	let seen = new Set<string>();
	let aliases: Record<string, string> = {};
	for (let { property, line } of node.properties) {
		let { name, value } = property;
		seen.add(name);
		if (name === "PRODID") calendar.productId = value;
		else if (name === "VERSION") {
			if (value.trim() !== "2.0") warn(line, `VERSION:${value} is not 2.0`);
		} else if (name === "METHOD") calendar.method = value.toUpperCase();
		else if (name === "NAME") calendar.name = unescapeText(value);
		else if (name === "DESCRIPTION") calendar.description = unescapeText(value);
		else if (name === "URL") calendar.url = value;
		else if (name === "REFRESH-INTERVAL" && parseDuration(value))
			calendar.refreshInterval = parseDuration(value) ?? {};
		else if (name === "X-WR-CALNAME") aliases.name = unescapeText(value);
		else if (name === "X-WR-CALDESC") aliases.description = unescapeText(value);
		else if (name === "X-PUBLISHED-TTL" && parseDuration(value)) aliases.refreshInterval = value;
		else calendar.properties.push(property);
	}
	calendar.name ??= aliases.name;
	calendar.description ??= aliases.description;
	if (!calendar.refreshInterval && aliases.refreshInterval) {
		calendar.refreshInterval = parseDuration(aliases.refreshInterval) ?? {};
	}
	for (let key of ["name", "description", "refreshInterval"] as const) {
		if (calendar[key] === undefined) delete calendar[key];
	}
	if (!seen.has("PRODID")) warn(node.line, "VCALENDAR has no PRODID");
	if (!seen.has("VERSION")) warn(node.line, "VCALENDAR has no VERSION");
	for (let child of node.children) {
		let typed: ICalendar.Event | ICalendar.TimeZone | null = null;
		if (child.name === "VEVENT") {
			let event = readEvent(child, warn);
			if (event) calendar.events.push(event);
			typed = event;
		} else if (child.name === "VTIMEZONE") {
			let zone = readTimeZone(child, warn);
			if (zone) calendar.timeZones.push(zone);
			typed = zone;
		}
		if (!typed) calendar.components.push(toComponent(child));
	}
	return { calendar, warnings };
}
