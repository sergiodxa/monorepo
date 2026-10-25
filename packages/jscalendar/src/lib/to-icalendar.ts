/**
 * Converts JSCalendar into `@sdxc/icalendar`'s model, following the JSCalendar-to-iCalendar
 * rules of draft-ietf-calext-jscalendar-icalendar for RFC 8984's properties, and restoring
 * what an earlier conversion kept in an object's `iCalendar` property.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "@sdxc/icalendar";
import type { Result } from "@sdxc/result";

import { escapeText } from "@sdxc/icalendar";
import { stringifyRecurrence } from "@sdxc/icalendar/rrule";
import { vtimezone } from "@sdxc/icalendar/timezone";
import { failure, isFailure, success } from "@sdxc/result";

import type { JSCalendar } from "../types.js";

import { occurrences } from "../recurrence.js";

import type { DateForm } from "./ical-values.js";

import { ConversionError } from "./errors.js";
import {
	formOf,
	fromJCalComponent,
	fromJCalProperty,
	fromLocal,
	rawDate,
	toICalendarDuration,
	untilOf,
	wallOfValue,
} from "./ical-values.js";
import { applyPatch } from "./patch.js";
import { toICalendarRule } from "./rules.js";
import { MAPPING_NAMESPACE, uuidv5 } from "./uuid5.js";
import {
	addDuration,
	formatLocalDateTime,
	isUTCZone,
	parseDuration,
	parseLocalDateTime,
	parseUTCDateTime,
	toInstant,
	toWall,
	wallFromMs,
	wallMs,
} from "./values.js";

/** Options for `toICalendar`. */
export interface ToICalendarOptions {
	/**
	 * The `PRODID` when the object has no `prodId`.
	 * @default "-//sdxc//jscalendar//EN"
	 */
	productId?: string;
	/** The `DTSTAMP` of an object without `updated`; the time of the call when unset. */
	now?: Date;
}

/** The `PRODID` written when neither the object nor the options name one. */
const DEFAULT_PRODUCT_ID = "-//sdxc//jscalendar//EN";

/** How far past the last date a `VTIMEZONE` covers, so recurrences keep their offsets. */
const ZONE_HORIZON_MS = 5 * 366 * 86_400_000;

/** The `CLASS` values for RFC 8984's privacy values; an unknown one is `PRIVATE`. */
const CLASSES: Record<string, string> = {
	public: "PUBLIC",
	private: "PRIVATE",
	secret: "CONFIDENTIAL",
};

/** The span of wall clocks each `TZID` is used over, for the `VTIMEZONE`s to build. */
type ZoneUse = Map<string, { from: number; to: number }>;

/** What one conversion collects across its components. */
interface Context {
	zones: ZoneUse;
	now: Date;
}

/**
 * Records that a value uses its `TZID`, widening that zone's span.
 *
 * @param context - The conversion
 * @param value - The value written
 */
function use(context: Context, value: ICalendar.DateValue | undefined): void {
	if (!value || value.type === "date" || typeof value.zone !== "object") return;
	let wall = wallOfValue(value);
	let span = context.zones.get(value.zone.tzid);
	context.zones.set(value.zone.tzid, {
		from: Math.min(span?.from ?? wall, wall),
		to: Math.max(span?.to ?? wall, wall),
	});
}

/** The key the mapping draft derives for a value, which needs no `JSID` to round-trip. */
function keyOf(value: string): string {
	return uuidv5(MAPPING_NAMESPACE, value);
}

/**
 * Whether every time of an all-day object is midnight, so its dates can be DATEs.
 *
 * @param object - The event or task
 * @returns `true` when the DATE form applies
 */
function isAllDay(object: JSCalendar.Entry): boolean {
	if (!object.showWithoutTime || object.timeZone) return false;
	let midnight = (value: string | undefined) => value === undefined || value.endsWith("T00:00:00");
	let wholeDays = (value: string | undefined) => value === undefined || !value.includes("T");
	let times = [object.recurrenceId, ...Object.keys(object.recurrenceOverrides ?? {})];
	for (let rule of object.recurrenceRules ?? []) times.push(rule.until);
	if (object["@type"] === "Event") {
		times.push(object.start);
		if (!wholeDays(object.duration)) return false;
	} else {
		times.push(object.start, object.due);
		if (!wholeDays(object.estimatedDuration)) return false;
	}
	return times.every(midnight);
}

/**
 * The properties an earlier conversion kept, as untyped iCalendar properties.
 *
 * @param object - Anything with an `iCalendar` property
 * @param skip - Lowercase names the caller restores into typed fields
 * @returns The properties
 */
function keptProperties(
	object: { iCalendar?: JSCalendar.ICalComponent },
	skip: string[] = [],
): ICalendar.Property[] {
	return (object.iCalendar?.properties ?? [])
		.filter(([name]) => !skip.includes(name))
		.map(fromJCalProperty);
}

/**
 * The first value of a kept property.
 *
 * @param object - Anything with an `iCalendar` property
 * @param name - The lowercase property name
 * @returns The value, or `undefined`
 */
function keptValue(object: { iCalendar?: JSCalendar.ICalComponent }, name: string): unknown {
	return object.iCalendar?.properties?.find(([kept]) => kept === name)?.[3];
}

/**
 * Converts an Alert into a `VALARM`. An alert without an action is a `DISPLAY` one, and a
 * `DISPLAY` alarm without a kept description describes itself with the event's title.
 *
 * @param key - The alert's key, written as `JSID` when it is not a plain index
 * @param alert - The alert
 * @param title - The event's title
 * @returns The alarm, or `null` for a trigger of an unknown type
 */
function alarmOf(
	key: string,
	alert: JSCalendar.Alert,
	title: string | undefined,
): ICalendar.Alarm | null {
	let trigger: ICalendar.Alarm["trigger"];
	if (alert.trigger["@type"] === "AbsoluteTrigger") {
		let when = parseUTCDateTime((alert.trigger as JSCalendar.AbsoluteTrigger).when);
		if (when === null) return null;
		trigger = { at: new Date(when) };
	} else if (alert.trigger["@type"] === "OffsetTrigger") {
		let offset = alert.trigger as JSCalendar.OffsetTrigger;
		let parts = parseDuration(offset.offset);
		if (!parts) return null;
		let before = toICalendarDuration({ ...parts, negative: !parts.negative });
		if (Object.keys(before).length === 1) delete before.negative;
		trigger = offset.relativeTo === "end" ? { before, related: "END" } : { before };
	} else return null;

	let keptAction = keptValue(alert, "action");
	let action =
		alert.action?.toUpperCase() ?? (typeof keptAction === "string" ? keptAction : "DISPLAY");
	let alarm: ICalendar.Alarm = { action, trigger };
	let description = keptValue(alert, "description");
	if (typeof description === "string") alarm.description = description;
	else if (action === "DISPLAY") alarm.description = title ?? "Reminder";
	let summary = keptValue(alert, "summary");
	if (typeof summary === "string") alarm.summary = summary;
	let count = keptValue(alert, "repeat");
	let every = keptValue(alert, "duration");
	let everyParts = typeof every === "string" ? parseDuration(every) : null;
	if (typeof count === "number" && everyParts) {
		alarm.repeat = { count, every: toICalendarDuration(everyParts) };
	}
	let attendees = (alert.iCalendar?.properties ?? []).filter(([name]) => name === "attendee");
	if (attendees.length) {
		alarm.attendees = attendees.map(([, parameters, , address]) => {
			let user: ICalendar.CalendarUser = { address: String(address) };
			if (typeof parameters.cn === "string") user.name = parameters.cn;
			return user;
		});
	}
	let properties = keptProperties(alert, [
		"action",
		"description",
		"summary",
		"attendee",
		"repeat",
		"duration",
	]);
	if (!/^\d+$/.test(key)) properties.unshift({ name: "JSID", parameters: {}, value: key });
	if (properties.length) alarm.properties = properties;
	return alarm;
}

/**
 * The address a participant is reached at: their `imip` or `other` method, or their email.
 *
 * @param participant - The participant
 * @returns The calendar address, or `undefined`
 */
function addressOf(participant: JSCalendar.Participant): string | undefined {
	let { sendTo, email } = participant;
	return sendTo?.imip ?? sendTo?.other ?? (email ? `mailto:${email}` : undefined);
}

/**
 * The `ROLE` RFC 8984's roles stand for; `REQ-PARTICIPANT`, the default, is left unset.
 *
 * @param roles - The participant's roles
 * @returns The role
 */
function roleOf(roles: Record<string, true> | undefined): ICalendar.Attendee["role"] {
	if (roles?.chair) return "CHAIR";
	if (roles?.optional) return "OPT-PARTICIPANT";
	if (roles?.informational && !roles.attendee) return "NON-PARTICIPANT";
	return undefined;
}

/**
 * The `ORGANIZER` and `ATTENDEE`s of an event or task. The organizer is the `replyTo`
 * address; a participant whose only role is `owner` organizes without attending.
 *
 * @param object - The event or task
 * @returns The organizer and attendees
 */
function peopleOf(object: JSCalendar.Entry): Pick<ICalendar.Event, "organizer" | "attendees"> {
	let people: Pick<ICalendar.Event, "organizer" | "attendees"> = {};
	let organizerAddress = object.replyTo?.imip ?? object.replyTo?.other;
	let attendees: ICalendar.Attendee[] = [];
	for (let [key, participant] of Object.entries(object.participants ?? {})) {
		let address = addressOf(participant);
		if (!address) continue;
		let parameters: Record<string, string[]> = {};
		if (key !== keyOf(address)) parameters.JSID = [key];
		if (participant.roles?.owner && address === organizerAddress) {
			people.organizer = { address };
			if (participant.name) people.organizer.name = participant.name;
			if (parameters.JSID) people.organizer.parameters = { JSID: parameters.JSID };
			let roles = Object.keys(participant.roles).filter((role) => role !== "owner");
			if (!roles.length && participant.participationStatus === undefined) continue;
		}
		if (participant.email && `mailto:${participant.email}` !== address) {
			parameters.EMAIL = [participant.email];
		}
		if (participant.kind) {
			parameters.CUTYPE = [
				participant.kind === "location" ? "ROOM" : participant.kind.toUpperCase(),
			];
		}
		let attendee: ICalendar.Attendee = { address };
		if (participant.name) attendee.name = participant.name;
		let role = roleOf(participant.roles);
		if (role) attendee.role = role;
		let status = participant.participationStatus?.toUpperCase();
		if (status) attendee.participation = status as ICalendar.Attendee["participation"];
		if (participant.expectReply !== undefined) attendee.rsvp = participant.expectReply;
		if (Object.keys(parameters).length) attendee.parameters = parameters;
		attendees.push(attendee);
	}
	if (!people.organizer && organizerAddress) people.organizer = { address: organizerAddress };
	if (attendees.length) people.attendees = attendees;
	return people;
}

/**
 * The properties shared by an event's main component and its overrides: what it says, who
 * takes part, its alarms and what an earlier conversion kept.
 *
 * @param object - The event or an instance of it
 * @param context - The conversion
 * @returns The fields of the `VEVENT`
 */
function describe(object: JSCalendar.Event, context: Context): Omit<ICalendar.Event, "start"> {
	let updated = object.updated === undefined ? null : parseUTCDateTime(object.updated);
	let event: Omit<ICalendar.Event, "start"> = {
		uid: object.uid,
		dtstamp: updated === null ? context.now : new Date(updated),
		properties: [],
	};
	let created = object.created === undefined ? null : parseUTCDateTime(object.created);
	if (created !== null) event.created = new Date(created);
	let lastModified = keptValue(object, "last-modified");
	let modified = typeof lastModified === "string" ? parseUTCDateTime(lastModified) : null;
	if (modified !== null) event.lastModified = new Date(modified);
	if (object.sequence !== undefined) event.sequence = object.sequence;
	if (object.title !== undefined) event.summary = object.title;
	let rich = object.descriptionContentType && object.descriptionContentType !== "text/plain";
	if (object.description !== undefined && !rich) event.description = object.description;
	else if (object.description !== undefined) {
		event.properties.push({
			name: "STYLED-DESCRIPTION",
			parameters: { VALUE: ["TEXT"], FMTTYPE: [object.descriptionContentType as string] },
			value: escapeText(object.description),
		});
	}
	let status = object.status?.toUpperCase();
	if (status === "TENTATIVE" || status === "CONFIRMED" || status === "CANCELLED") {
		event.status = status;
	}
	if (object.freeBusyStatus === "free") event.transparency = "TRANSPARENT";
	if (object.freeBusyStatus === "busy") event.transparency = "OPAQUE";
	if (object.keywords) event.categories = Object.keys(object.keywords);

	let links = Object.entries(object.links ?? {});
	let page =
		links.find(([, link]) => link.rel === "describedby") ?? links.find(([, link]) => !link.rel);
	if (page) event.url = page[1].href;
	for (let [, link] of links) {
		if (link === page?.[1]) continue;
		let parameters: Record<string, string[]> = {};
		if (link.contentType) parameters.FMTTYPE = [link.contentType];
		if (link.title) parameters.LABEL = [link.title];
		if (!link.rel || link.rel === "enclosure") {
			event.properties.push({ name: "ATTACH", parameters, value: link.href });
		} else {
			parameters.LINKREL = [link.rel];
			parameters.VALUE = ["URI"];
			event.properties.push({ name: "LINK", parameters, value: link.href });
		}
	}

	let place = Object.values(object.locations ?? {}).find(
		(location) => location.name !== undefined && location.relativeTo !== "end",
	);
	if (place?.name !== undefined) event.location = place.name;
	for (let virtual of Object.values(object.virtualLocations ?? {})) {
		let parameters: Record<string, string[]> = { VALUE: ["URI"] };
		if (virtual.name) parameters.LABEL = [virtual.name];
		if (virtual.features)
			parameters.FEATURE = Object.keys(virtual.features).map((f) => f.toUpperCase());
		event.properties.push({ name: "CONFERENCE", parameters, value: virtual.uri });
	}
	if (object.privacy !== undefined) {
		event.properties.push({
			name: "CLASS",
			parameters: {},
			value: CLASSES[object.privacy] ?? "PRIVATE",
		});
	}
	if (object.priority !== undefined) {
		event.properties.push({ name: "PRIORITY", parameters: {}, value: String(object.priority) });
	}
	if (object.color !== undefined) {
		event.properties.push({ name: "COLOR", parameters: {}, value: object.color });
	}

	Object.assign(event, peopleOf(object));
	let alarms = Object.entries(object.alerts ?? {}).flatMap(([key, alert]) => {
		let alarm = alarmOf(key, alert, object.title);
		return alarm ? [alarm] : [];
	});
	if (alarms.length) event.alarms = alarms;
	event.properties.push(...keptProperties(object, ["last-modified"]));
	return event;
}

/**
 * When an event ends, as a DTEND: in the end location's zone when it has one, otherwise in
 * the start's form.
 *
 * @param object - The event
 * @param form - The start's form
 * @param zone - The zone the start is read in
 * @returns The DTEND, or `undefined` when the event has no duration
 */
function endOf(
	object: JSCalendar.Event,
	form: DateForm,
	zone: string,
): ICalendar.DateValue | undefined {
	let parts = object.duration === undefined ? null : parseDuration(object.duration);
	let start = parseLocalDateTime(object.start);
	if (!parts || !start) return undefined;
	let wall = wallMs(start);
	if (form.kind === "date" || form.kind === "floating") {
		let instant = addDuration(wall, parts, "UTC");
		return fromLocal(formatWall(instant), form) ?? undefined;
	}
	let instant = addDuration(wall, parts, zone);
	let endZone = Object.values(object.locations ?? {}).find(
		(location) => location.relativeTo === "end" && location.timeZone,
	)?.timeZone;
	let target = endZone ?? zone;
	return fromLocal(formatWall(toWall(instant, target)), formOf(target, false)) ?? undefined;
}

/** Wall milliseconds as a LocalDateTime, whole seconds only. */
function formatWall(wall: number): string {
	return formatLocalDateTime({ ...wallFromMs(wall), millisecond: 0 });
}

/**
 * Whether an override key is an instance the event's own rules generate, which decides
 * whether iCalendar needs an `RDATE` beside the override component.
 *
 * @param object - The recurring event
 * @param key - The override's recurrence id
 * @returns `true` when a rule produces it
 */
function generated(object: JSCalendar.Event, key: string): boolean {
	if (!object.recurrenceRules?.length) return false;
	let parts = parseLocalDateTime(key);
	if (!parts) return false;
	let zone = object.timeZone ?? "UTC";
	let instant = toInstant(wallMs(parts), zone);
	let found = occurrences(
		{ ...object, recurrenceOverrides: undefined },
		{ from: instant, to: instant + 1, limit: 4, timeZone: "UTC" },
	);
	return !isFailure(found) && found.data.some((occurrence) => occurrence.recurrenceId === key);
}

/**
 * Converts an Event into its `VEVENT`s: the main one, then one per override that patches
 * more than an added date's length.
 *
 * @param object - The event
 * @param context - The conversion
 * @returns The components, or why a rule cannot be written
 */
function eventsOf(
	object: JSCalendar.Event,
	context: Context,
): Result<ICalendar.Event[], ConversionError> {
	let form = formOf(object.timeZone, isAllDay(object));
	let zone = object.timeZone ?? "UTC";
	let start = fromLocal(object.start, form);
	if (!start) return failure(new ConversionError(`${object.uid}: start is not a LocalDateTime`));
	let event: ICalendar.Event = { ...describe(object, context), start };
	use(context, start);

	let dtend = object.iCalendar?.convertedProperties?.duration?.name === "dtend";
	let endZone = Object.values(object.locations ?? {}).some(
		(location) => location.relativeTo === "end" && location.timeZone,
	);
	let parts = object.duration === undefined ? null : parseDuration(object.duration);
	if (parts && (dtend || endZone)) {
		event.end = endOf(object, form, zone);
		use(context, event.end);
	} else if (parts) event.duration = toICalendarDuration(parts);

	let [first, ...more] = object.recurrenceRules ?? [];
	let until = (local: string) => untilOf(local, form);
	if (first) {
		let rule = toICalendarRule(first, until);
		if (isFailure(rule))
			return failure(new ConversionError(`${object.uid}: ${rule.error.message}`));
		event.recurrence = rule.data;
	}
	for (let [name, rules] of [
		["RRULE", more],
		["EXRULE", object.excludedRecurrenceRules ?? []],
	] as const) {
		for (let extra of rules) {
			let rule = toICalendarRule(extra, until);
			if (isFailure(rule))
				return failure(new ConversionError(`${object.uid}: ${rule.error.message}`));
			event.properties.push({ name, parameters: {}, value: stringifyRecurrence(rule.data) });
		}
	}

	if (object.recurrenceId !== undefined) {
		let idForm = formOf(object.recurrenceIdTimeZone, form.kind === "date");
		let recurrenceId = fromLocal(object.recurrenceId, idForm);
		if (recurrenceId) event.recurrenceId = recurrenceId;
		use(context, recurrenceId ?? undefined);
	}

	let components = [event];
	let base: JSCalendar.Event = { ...object };
	delete base.recurrenceRules;
	delete base.excludedRecurrenceRules;
	delete base.recurrenceOverrides;
	for (let [key, patch] of Object.entries(object.recurrenceOverrides ?? {})) {
		let value = fromLocal(key, form);
		if (!value) continue;
		use(context, value);
		let keys = Object.keys(patch);
		if (patch.excluded === true) {
			event.exceptionDates = [...(event.exceptionDates ?? []), value];
			continue;
		}
		let period = object.iCalendar?.convertedProperties?.[`recurrenceOverrides/${key}`];
		let length = typeof patch.duration === "string" ? parseDuration(patch.duration) : null;
		if (keys.length === 1 && length && period?.valueType === "period") {
			event.recurrenceDates = [
				...(event.recurrenceDates ?? []),
				{ type: "period", start: value, duration: toICalendarDuration(length) },
			];
			continue;
		}
		if (keys.length === 0 || !generated(object, key)) {
			event.recurrenceDates = [...(event.recurrenceDates ?? []), value];
		}
		if (keys.length === 0) continue;
		let instance = applyPatch({ ...base, start: key, recurrenceId: key }, patch);
		if (isFailure(instance)) {
			return failure(new ConversionError(`${object.uid}: the override at ${key} is invalid`));
		}
		let patched: JSCalendar.Event = {
			...instance.data,
			uid: object.uid,
			recurrenceIdTimeZone: object.timeZone ?? null,
		};
		if (!patched.timeZone) delete patched.recurrenceIdTimeZone;
		let override = eventsOf(patched, context);
		if (isFailure(override)) return override;
		components.push(...override.data);
	}
	return success(components);
}

/**
 * Converts a Task into an untyped `VTODO`, the component the iCalendar model keeps as
 * written.
 *
 * @param object - The task
 * @param context - The conversion
 * @returns The component, or why a rule cannot be written
 */
function todoOf(
	object: JSCalendar.Task,
	context: Context,
): Result<ICalendar.Component, ConversionError> {
	let form = formOf(object.timeZone, isAllDay(object));
	let properties: ICalendar.Property[] = [];
	let push = (name: string, value: string, parameters: Record<string, string[]> = {}) =>
		properties.push({ name, parameters, value });
	let stamp = (instant: number) =>
		rawDate({ type: "date-time", wall: wallFromMs(instant), zone: "utc" }).value;
	let updated = object.updated === undefined ? null : parseUTCDateTime(object.updated);
	let created = object.created === undefined ? null : parseUTCDateTime(object.created);
	push("UID", object.uid);
	push("DTSTAMP", stamp(updated ?? context.now.getTime()));
	if (created !== null) push("CREATED", stamp(created));
	if (object.sequence !== undefined) push("SEQUENCE", String(object.sequence));
	if (object.title !== undefined) push("SUMMARY", escapeText(object.title));
	if (object.description !== undefined) push("DESCRIPTION", escapeText(object.description));
	for (let [name, local] of [
		["DTSTART", object.start],
		["DUE", object.due],
	] as const) {
		let value = local === undefined ? null : fromLocal(local, form);
		if (!value) continue;
		use(context, value);
		let raw = rawDate(value);
		push(name, raw.value, raw.parameters);
	}
	if (object.progress !== undefined) push("STATUS", object.progress.toUpperCase());
	if (object.percentComplete !== undefined)
		push("PERCENT-COMPLETE", String(object.percentComplete));
	if (object.priority !== undefined) push("PRIORITY", String(object.priority));
	if (object.estimatedDuration !== undefined) push("ESTIMATED-DURATION", object.estimatedDuration);
	if (object.keywords) push("CATEGORIES", Object.keys(object.keywords).map(escapeText).join(","));
	for (let rule of object.recurrenceRules ?? []) {
		let converted = toICalendarRule(rule, (local) => untilOf(local, form));
		if (isFailure(converted)) {
			return failure(new ConversionError(`${object.uid}: ${converted.error.message}`));
		}
		push("RRULE", stringifyRecurrence(converted.data));
	}
	properties.push(...keptProperties(object));
	return success({
		name: "VTODO",
		properties,
		components: (object.iCalendar?.components ?? []).map(fromJCalComponent),
	});
}

/**
 * Converts a Group, Event or Task into a calendar. A Group's events become `VEVENT`s with
 * their overrides, its tasks `VTODO`s, and every `TZID` used gets a `VTIMEZONE` from `Intl`
 * covering its dates and five years beyond, so recurrences keep their offsets.
 *
 * @param object - The Group, or a single Event or Task
 * @param options - The `PRODID` and `DTSTAMP` fallbacks
 * @returns The calendar, or why an object cannot be written
 * @example stringify(unwrap(toICalendar(group)));
 */
export function toICalendar(
	object: JSCalendar.CalendarObject,
	options: ToICalendarOptions = {},
): Result<ICalendar.Calendar, ConversionError> {
	let context: Context = { zones: new Map(), now: options.now ?? new Date() };
	let entries = object["@type"] === "Group" ? object.entries : [object];
	let productId =
		object.prodId ??
		entries.find((entry) => entry.prodId)?.prodId ??
		options.productId ??
		DEFAULT_PRODUCT_ID;
	let calendar: ICalendar.Calendar = {
		productId,
		timeZones: [],
		events: [],
		components: [],
		properties: [],
	};
	let method = entries.find((entry) => entry.method)?.method;
	if (method) calendar.method = method.toUpperCase();

	for (let entry of entries) {
		if (entry["@type"] === "Event") {
			let events = eventsOf(entry, context);
			if (isFailure(events)) return events;
			calendar.events.push(...events.data);
		} else {
			let todo = todoOf(entry, context);
			if (isFailure(todo)) return todo;
			calendar.components.push(todo.data);
		}
	}

	if (object["@type"] === "Group") {
		calendar.properties.push({ name: "UID", parameters: {}, value: object.uid });
		if (object.title !== undefined) calendar.name = object.title;
		if (object.description !== undefined) calendar.description = object.description;
		let page = Object.values(object.links ?? {}).find((link) => link.rel === "describedby");
		if (page) calendar.url = page.href;
		let updated = object.updated === undefined ? null : parseUTCDateTime(object.updated);
		if (updated !== null) {
			let raw = rawDate({ type: "date-time", wall: wallFromMs(updated), zone: "utc" });
			calendar.properties.push({ name: "LAST-MODIFIED", parameters: {}, value: raw.value });
		}
		if (object.source !== undefined) {
			calendar.properties.push({
				name: "SOURCE",
				parameters: { VALUE: ["URI"] },
				value: object.source,
			});
		}
		let refresh = keptValue(object, "refresh-interval");
		let interval = typeof refresh === "string" ? parseDuration(refresh) : null;
		if (interval) calendar.refreshInterval = toICalendarDuration(interval);
		calendar.properties.push(...keptProperties(object, ["refresh-interval"]));
		calendar.components.push(...(object.iCalendar?.components ?? []).map(fromJCalComponent));
	}

	for (let [tzid, span] of context.zones) {
		if (isUTCZone(tzid)) continue;
		let zone = vtimezone(tzid, { from: span.from - 86_400_000, to: span.to + ZONE_HORIZON_MS });
		if (isFailure(zone)) return failure(new ConversionError(zone.error.message));
		calendar.timeZones.push(zone.data);
	}
	return success(calendar);
}
