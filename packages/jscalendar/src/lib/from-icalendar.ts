/**
 * Converts `@sdxc/icalendar`'s model into JSCalendar, following the iCalendar-to-JSCalendar
 * rules of draft-ietf-calext-jscalendar-icalendar written in RFC 8984's properties. What has
 * no JSCalendar property is kept in each object's `iCalendar` property, as the draft allows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "@sdxc/icalendar";

import { escapeText, unescapeText } from "@sdxc/icalendar";
import { parseRecurrence } from "@sdxc/icalendar/rrule";
import { isSuccess } from "@sdxc/result";

import type { JSCalendar } from "../types.js";

import {
	exactParts,
	instantOfValue,
	readRawDate,
	toJCalComponent,
	toJCalProperty,
	toLocal,
	wallOfValue,
	zoneOf,
} from "./ical-values.js";
import { fromICalendarRule } from "./rules.js";
import { MAPPING_NAMESPACE, uuidv5 } from "./uuid5.js";
import { formatDuration, formatUTCDateTime } from "./values.js";

/** Options for `fromICalendar`. */
export interface FromICalendarOptions {
	/**
	 * The group's `uid` when the calendar has no `UID` property; derived from the
	 * calendar's `URL`, or its product id and name, when unset.
	 */
	uid?: string;
}

/** The key the mapping draft derives for a value: its UUIDv5 in the draft's namespace. */
function keyOf(value: string): string {
	return uuidv5(MAPPING_NAMESPACE, value);
}

/** The JSID a property or component carries, which the draft makes the object's key. */
function jsid(parameters: Record<string, string[]> | undefined): string | undefined {
	return parameters?.JSID?.[0];
}

/**
 * The `iCalendar` property for what a component kept, or `undefined` when it kept nothing.
 *
 * @param name - The component name, lowercase
 * @param properties - jCal properties
 * @param components - jCal components
 * @param converted - Which properties produced which JSCalendar paths
 * @returns The ICalComponent
 */
function preserved(
	name: string,
	properties: JSCalendar.JCalProperty[],
	components: JSCalendar.JCalComponent[] = [],
	converted: Record<string, JSCalendar.ICalProperty> = {},
): JSCalendar.ICalComponent | undefined {
	if (!properties.length && !components.length && !Object.keys(converted).length) return undefined;
	let component: JSCalendar.ICalComponent = { "@type": "ICalComponent", name };
	if (properties.length) component.properties = properties;
	if (components.length) component.components = components;
	if (Object.keys(converted).length) component.convertedProperties = converted;
	return component;
}

/** A calendar address as a JSCalendar method map: `imip` for `mailto:`, `other` otherwise. */
function methodsOf(address: string): Record<string, string> {
	return address.toLowerCase().startsWith("mailto:") ? { imip: address } : { other: address };
}

/**
 * The roles an `ATTENDEE`'s `ROLE` stands for in RFC 8984.
 *
 * @param role - The ROLE parameter
 * @returns The roles map
 */
function rolesOf(role: ICalendar.Attendee["role"]): Record<string, true> {
	if (role === "CHAIR") return { attendee: true, chair: true };
	if (role === "OPT-PARTICIPANT") return { optional: true };
	if (role === "NON-PARTICIPANT") return { informational: true };
	return { attendee: true };
}

/**
 * The participants, organizer and reply address of an event. An organizer who also attends
 * becomes one participant, with the `owner` role beside their attendee roles.
 *
 * @param event - The iCalendar event
 * @returns The JSCalendar properties to set
 */
function participantsOf(
	event: ICalendar.Event,
): Pick<JSCalendar.Event, "participants" | "replyTo"> {
	let participants: Record<string, JSCalendar.Participant> = {};
	let byAddress = new Map<string, string>();

	for (let attendee of event.attendees ?? []) {
		let key = jsid(attendee.parameters) ?? keyOf(attendee.address);
		let participant: JSCalendar.Participant = {
			"@type": "Participant",
			sendTo: methodsOf(attendee.address),
			roles: rolesOf(attendee.role),
		};
		if (attendee.name) participant.name = attendee.name;
		let email = attendee.parameters?.EMAIL?.[0];
		if (email) participant.email = email;
		let kind = attendee.parameters?.CUTYPE?.[0]?.toLowerCase();
		if (kind) participant.kind = kind === "room" ? "location" : kind;
		if (attendee.participation) {
			participant.participationStatus = attendee.participation.toLowerCase();
		}
		if (attendee.rsvp !== undefined) participant.expectReply = attendee.rsvp;
		participants[key] = participant;
		byAddress.set(attendee.address.toLowerCase(), key);
	}

	let organizer = event.organizer;
	if (!organizer) {
		return Object.keys(participants).length ? { participants } : {};
	}
	let key =
		byAddress.get(organizer.address.toLowerCase()) ??
		jsid(organizer.parameters) ??
		keyOf(organizer.address);
	let existing = participants[key];
	if (existing) existing.roles = { ...existing.roles, owner: true };
	else {
		participants[key] = {
			"@type": "Participant",
			sendTo: methodsOf(organizer.address),
			roles: { owner: true },
			...(organizer.name ? { name: organizer.name } : {}),
		};
	}
	if (existing && !existing.name && organizer.name) existing.name = organizer.name;
	return { participants, replyTo: methodsOf(organizer.address) };
}

/**
 * Converts a `VALARM` into an Alert. `ACTION`s other than `DISPLAY` and `EMAIL`, and the
 * description, summary, attendees and repeat a JSCalendar Alert has no property for, are
 * kept in the alert's `iCalendar` property.
 *
 * @param alarm - The iCalendar alarm
 * @returns The alert
 */
function alertOf(alarm: ICalendar.Alarm): JSCalendar.Alert {
	let trigger: JSCalendar.Alert["trigger"];
	if ("at" in alarm.trigger) {
		trigger = { "@type": "AbsoluteTrigger", when: formatUTCDateTime(alarm.trigger.at) };
	} else {
		let { negative, ...parts } = alarm.trigger.before;
		let offset = formatDuration({ ...parts, negative: !negative });
		trigger = { "@type": "OffsetTrigger", offset: offset === "-PT0S" ? "PT0S" : offset };
		if (alarm.trigger.related === "END") trigger.relativeTo = "end";
	}
	let alert: JSCalendar.Alert = { "@type": "Alert", trigger };

	let kept: JSCalendar.JCalProperty[] = [];
	let action = alarm.action.toUpperCase();
	if (action === "DISPLAY" || action === "EMAIL") alert.action = action.toLowerCase();
	else kept.push(["action", {}, "text", alarm.action]);
	if (alarm.description !== undefined) kept.push(["description", {}, "text", alarm.description]);
	if (alarm.summary !== undefined) kept.push(["summary", {}, "text", alarm.summary]);
	for (let attendee of alarm.attendees ?? []) {
		kept.push([
			"attendee",
			attendee.name ? { cn: attendee.name } : {},
			"cal-address",
			attendee.address,
		]);
	}
	if (alarm.repeat) {
		kept.push(["repeat", {}, "integer", alarm.repeat.count]);
		kept.push(["duration", {}, "duration", formatDuration(alarm.repeat.every)]);
	}
	for (let property of alarm.properties ?? []) {
		if (property.name !== "JSID" && property.name !== "UID") kept.push(toJCalProperty(property));
	}
	let iCalendar = preserved("valarm", kept);
	if (iCalendar) alert.iCalendar = iCalendar;
	return alert;
}

/**
 * The duration an event's `DTEND` stands for: whole days between two DATEs, otherwise the
 * exact time between the two instants.
 *
 * @param start - The DTSTART
 * @param end - The DTEND
 * @param calendar - Resolves `TZID`s
 * @returns The Duration
 */
function durationBetween(
	start: ICalendar.DateValue,
	end: ICalendar.DateValue,
	calendar: ICalendar.Calendar,
): JSCalendar.Duration {
	if (start.type === "date" && end.type === "date") {
		let days = Math.max(0, Math.round((wallOfValue(end) - wallOfValue(start)) / 86_400_000));
		return formatDuration(days % 7 === 0 && days > 0 ? { weeks: days / 7 } : { days });
	}
	if (zoneOf(start) === null || zoneOf(end) === null) {
		return formatDuration(exactParts(wallOfValue(end) - wallOfValue(start)));
	}
	return formatDuration(
		exactParts(instantOfValue(end, calendar) - instantOfValue(start, calendar)),
	);
}

/**
 * Converts one `VEVENT` into an Event, on its own: a recurrence override comes out as an
 * instance with `recurrenceId`, which `fromICalendar` may fold into its main event.
 *
 * @param event - The iCalendar event
 * @param calendar - The calendar it belongs to, for its zones and method
 * @returns The Event
 */
export function eventFromICalendar(
	event: ICalendar.Event,
	calendar: ICalendar.Calendar,
): JSCalendar.Event {
	let zone = zoneOf(event.start);
	let local = (value: ICalendar.DateValue) => toLocal(value, zone, calendar);
	let object: JSCalendar.Event = { "@type": "Event", uid: event.uid, start: local(event.start) };
	if (zone) object.timeZone = zone;
	if (event.start.type === "date") object.showWithoutTime = true;
	if (calendar.method) object.method = calendar.method.toLowerCase();
	if (!Number.isNaN(event.dtstamp.getTime())) object.updated = formatUTCDateTime(event.dtstamp);
	if (event.created) object.created = formatUTCDateTime(event.created);
	if (event.sequence !== undefined) object.sequence = event.sequence;
	if (event.summary !== undefined) object.title = event.summary;
	if (event.description !== undefined) object.description = event.description;
	if (event.status) object.status = event.status.toLowerCase();
	if (event.transparency) object.freeBusyStatus = event.transparency === "OPAQUE" ? "busy" : "free";
	if (event.categories?.length) {
		object.keywords = Object.fromEntries(event.categories.map((category) => [category, true]));
	}
	if (event.url) {
		object.links = { [keyOf(event.url)]: { "@type": "Link", href: event.url, rel: "describedby" } };
	}

	let converted: Record<string, JSCalendar.ICalProperty> = {};
	let locations: Record<string, JSCalendar.Location> = {};
	if (event.location !== undefined) {
		locations[keyOf(escapeText(event.location))] = { "@type": "Location", name: event.location };
	}
	if (event.end) {
		object.duration = durationBetween(event.start, event.end, calendar);
		let endZone = zoneOf(event.end);
		if (endZone && endZone !== zone) {
			locations.end = { "@type": "Location", relativeTo: "end", timeZone: endZone };
		} else converted.duration = { "@type": "ICalProperty", name: "dtend" };
	} else if (event.duration) {
		object.duration = formatDuration(event.duration);
	}
	if (Object.keys(locations).length) object.locations = locations;

	if (event.recurrence) {
		object.recurrenceRules = [fromICalendarRule(event.recurrence, local)];
	}
	let overrides: Record<string, JSCalendar.PatchObject> = {};
	for (let value of event.recurrenceDates ?? []) {
		if (value.type !== "period") {
			overrides[local(value)] = {};
			continue;
		}
		let key = local(value.start);
		let length = value.end
			? durationBetween(value.start, value.end, calendar)
			: formatDuration(value.duration ?? {});
		overrides[key] = { duration: length };
		converted[`recurrenceOverrides/${key}`] = {
			"@type": "ICalProperty",
			name: "rdate",
			valueType: "period",
		};
	}
	for (let value of event.exceptionDates ?? []) overrides[local(value)] = { excluded: true };
	if (Object.keys(overrides).length) object.recurrenceOverrides = overrides;

	if (event.recurrenceId) {
		object.recurrenceId = local(event.recurrenceId);
		let recurrenceZone = zoneOf(event.recurrenceId);
		if (recurrenceZone) object.recurrenceIdTimeZone = recurrenceZone;
	}

	Object.assign(object, participantsOf(event));

	let alerts: Record<string, JSCalendar.Alert> = {};
	(event.alarms ?? []).forEach((alarm, index) => {
		let named = (name: string) =>
			alarm.properties?.find((property) => property.name === name)?.value;
		alerts[named("JSID") ?? named("UID") ?? String(index + 1)] = alertOf(alarm);
	});
	if (Object.keys(alerts).length) object.alerts = alerts;

	let kept: JSCalendar.JCalProperty[] = [];
	if (event.lastModified) {
		kept.push(["last-modified", {}, "date-time", formatUTCDateTime(event.lastModified)]);
	}
	for (let property of event.properties) kept.push(toJCalProperty(property));
	let iCalendar = preserved("vevent", kept, [], converted);
	if (iCalendar) object.iCalendar = iCalendar;
	return object;
}

/**
 * Converts an untyped `VTODO` into a Task. The properties a Task names are read from their
 * raw values; any other property and every subcomponent is kept in `iCalendar`.
 *
 * @param component - The `VTODO`
 * @param calendar - The calendar it belongs to
 * @returns The Task
 */
export function taskFromICalendar(
	component: ICalendar.Component,
	calendar: ICalendar.Calendar,
): JSCalendar.Task {
	let task: JSCalendar.Task = { "@type": "Task", uid: "" };
	if (calendar.method) task.method = calendar.method.toLowerCase();
	let dates: { start?: ICalendar.DateValue; due?: ICalendar.DateValue } = {};
	let rule: ICalendar.RecurrenceRule | undefined;
	let kept: JSCalendar.JCalProperty[] = [];
	for (let property of component.properties) {
		let { name, value, parameters } = property;
		let date = readRawDate(value, parameters);
		let number = Number(value);
		if (name === "UID") task.uid = value;
		else if (name === "DTSTAMP" && date) task.updated = formatUTCDateTime(wallOfValue(date));
		else if (name === "CREATED" && date) task.created = formatUTCDateTime(wallOfValue(date));
		else if (name === "SUMMARY") task.title = unescapeText(value);
		else if (name === "DESCRIPTION") task.description = unescapeText(value);
		else if (name === "DTSTART" && date) dates.start = date;
		else if (name === "DUE" && date) dates.due = date;
		else if (name === "STATUS") task.progress = value.toLowerCase();
		else if (name === "SEQUENCE" && Number.isSafeInteger(number)) task.sequence = number;
		else if (name === "PRIORITY" && Number.isSafeInteger(number)) task.priority = number;
		else if (name === "PERCENT-COMPLETE" && Number.isSafeInteger(number)) {
			task.percentComplete = number;
		} else if (name === "ESTIMATED-DURATION") task.estimatedDuration = value;
		else if (name === "CATEGORIES") {
			for (let category of value.split(/(?<!\\),/)) {
				task.keywords = { ...task.keywords, [unescapeText(category)]: true };
			}
		} else if (name === "RRULE" && isSuccess(parseRecurrence(value))) {
			let parsed = parseRecurrence(value);
			if (isSuccess(parsed)) rule = parsed.data;
		} else kept.push(toJCalProperty(property));
	}

	let anchor = dates.start ?? dates.due;
	let zone = anchor ? zoneOf(anchor) : null;
	let local = (value: ICalendar.DateValue) => toLocal(value, zone, calendar);
	if (zone) task.timeZone = zone;
	if (anchor?.type === "date") task.showWithoutTime = true;
	if (dates.start) task.start = local(dates.start);
	if (dates.due) task.due = local(dates.due);
	if (rule && anchor) task.recurrenceRules = [fromICalendarRule(rule, local)];

	let iCalendar = preserved("vtodo", kept, component.components.map(toJCalComponent));
	if (iCalendar) task.iCalendar = iCalendar;
	return task;
}

/**
 * Whether two JSON values are equal, member by member.
 *
 * @param a - One value
 * @param b - The other
 * @returns `true` when they serialize alike regardless of key order
 */
function same(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	let keysA = Object.keys(a);
	let keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;
	return keysA.every((key) =>
		same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
	);
}

/** Properties a fold never writes into an override's patch, since RFC 8984 ignores them there. */
const UNPATCHED = new Set([
	"@type",
	"uid",
	"method",
	"prodId",
	"recurrenceId",
	"recurrenceIdTimeZone",
	"recurrenceRules",
	"excludedRecurrenceRules",
	"recurrenceOverrides",
	"replyTo",
	"sentBy",
	"privacy",
]);

/** Whether a value is a JSON object, the only kind of value a patch descends into. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Writes the patches that turn one object into another, descending into objects present on
 * both sides so a changed member is patched alone, as `participants/p1/participationStatus`.
 *
 * @param base - What the patch applies to
 * @param target - What it should produce
 * @param prefix - The pointer to `base`, empty at the top
 * @param patch - Collects the patches
 */
function diffInto(
	base: Record<string, unknown>,
	target: Record<string, unknown>,
	prefix: string,
	patch: JSCalendar.PatchObject,
): void {
	for (let key of new Set([...Object.keys(base), ...Object.keys(target)])) {
		if (!prefix && UNPATCHED.has(key)) continue;
		let pointer = prefix + key.replaceAll("~", "~0").replaceAll("/", "~1");
		let from = base[key];
		let to = target[key];
		if (!(key in target)) patch[pointer] = null;
		else if (!(key in base)) patch[pointer] = to;
		else if (isPlainObject(from) && isPlainObject(to)) diffInto(from, to, `${pointer}/`, patch);
		else if (!same(from, to)) patch[pointer] = to;
	}
}

/**
 * The PatchObject that turns a main event's instance into the override iCalendar wrote for
 * it.
 *
 * @param main - The main event
 * @param override - The converted override
 * @returns The patch for the main event's `recurrenceOverrides`
 */
function patchFor(main: JSCalendar.Event, override: JSCalendar.Event): JSCalendar.PatchObject {
	let base: Record<string, unknown> = { ...main, start: override.recurrenceId };
	let patch: JSCalendar.PatchObject = {};
	diffInto(base, { ...override }, "", patch);
	return patch;
}

/**
 * Converts a calendar into a Group: each `VEVENT` an Event and each `VTODO` a Task, and each
 * recurrence override folded into its main event's `recurrenceOverrides` as the patch that
 * produces it. An override whose main event is absent stays an entry of its own.
 *
 * @param calendar - The iCalendar calendar
 * @param options - The group's `uid` when the calendar has none
 * @returns The Group
 * @example fromICalendar(unwrap(parse(text)).calendar);
 */
export function fromICalendar(
	calendar: ICalendar.Calendar,
	options: FromICalendarOptions = {},
): JSCalendar.Group {
	let events = calendar.events.map((event) => eventFromICalendar(event, calendar));
	let mains = new Map<string, JSCalendar.Event>();
	for (let event of events) {
		if (event.recurrenceId === undefined) mains.set(event.uid, event);
	}
	let entries: JSCalendar.Entry[] = [];
	for (let event of events) {
		let main = event.recurrenceId === undefined ? undefined : mains.get(event.uid);
		if (!main || event.recurrenceId === undefined) {
			entries.push(event);
			continue;
		}
		let { recurrenceId } = event;
		main.recurrenceOverrides = {
			...main.recurrenceOverrides,
			[recurrenceId]: patchFor(main, event),
		};
	}
	for (let component of calendar.components) {
		if (component.name === "VTODO") entries.push(taskFromICalendar(component, calendar));
	}

	let kept: JSCalendar.JCalProperty[] = [];
	let uid = options.uid;
	let updated: string | undefined;
	for (let property of calendar.properties) {
		let date = readRawDate(property.value, property.parameters);
		if (property.name === "UID" && !uid) uid = property.value;
		else if (property.name === "LAST-MODIFIED" && date) {
			updated = formatUTCDateTime(wallOfValue(date));
		} else if (property.name !== "UID") kept.push(toJCalProperty(property));
	}
	if (calendar.refreshInterval) {
		kept.push([
			"refresh-interval",
			{ value: "duration" },
			"duration",
			formatDuration(calendar.refreshInterval),
		]);
	}
	let others = calendar.components.filter((component) => component.name !== "VTODO");

	let group: JSCalendar.Group = {
		"@type": "Group",
		uid: uid ?? keyOf(calendar.url ?? `${calendar.productId}\n${calendar.name ?? ""}`),
		entries,
	};
	if (calendar.productId) group.prodId = calendar.productId;
	if (updated) group.updated = updated;
	if (calendar.name !== undefined) group.title = calendar.name;
	if (calendar.description !== undefined) group.description = calendar.description;
	if (calendar.url) {
		group.links = {
			[keyOf(calendar.url)]: { "@type": "Link", href: calendar.url, rel: "describedby" },
		};
	}
	let iCalendar = preserved("vcalendar", kept, others.map(toJCalComponent));
	if (iCalendar) group.iCalendar = iCalendar;
	return group;
}
