/**
 * The iCalendar side of the conversion: date values in and out of LocalDateTimes and zones,
 * durations in both models, raw content-line values for the components and properties the
 * typed iCalendar model keeps untyped, and jCal for what JSCalendar preserves verbatim.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "@sdxc/icalendar";

import { toInstant as icalInstant } from "@sdxc/icalendar";

import type { JSCalendar } from "../types.js";

import type { DurationParts } from "./values.js";

import {
	formatLocalDateTime,
	isUTCZone,
	parseLocalDateTime,
	toInstant,
	toWall,
	wallFromMs,
	wallMs,
} from "./values.js";

/** The zone a JSCalendar object gives the UTC form of a DATE-TIME. */
export const UTC_ZONE = "Etc/UTC";

/**
 * How the dates of one component are written, which RFC 5545 requires to agree between
 * DTSTART, DUE and RECURRENCE-ID: a DATE, a UTC time, a time in a `TZID`, or floating.
 */
export type DateForm =
	| { kind: "date" }
	| { kind: "utc" }
	| { kind: "zoned"; tzid: string }
	| { kind: "floating" };

/**
 * The JSCalendar zone of a value: `Etc/UTC` for UTC, the `TZID`, or `null` for floating
 * times and DATEs.
 *
 * @param value - The iCalendar value
 * @returns The TimeZoneId, or `null`
 */
export function zoneOf(value: ICalendar.DateValue): string | null {
	if (value.type === "date" || value.zone === "floating") return null;
	return value.zone === "utc" ? UTC_ZONE : value.zone.tzid;
}

/**
 * The wall milliseconds a value shows, midnight for a DATE.
 *
 * @param value - The iCalendar value
 * @returns Wall milliseconds
 */
export function wallOfValue(value: ICalendar.DateValue): number {
	if (value.type === "date") return Date.UTC(value.year, value.month - 1, value.day);
	let { year, month, day, hour, minute, second } = value.wall;
	return wallMs({ year, month, day, hour, minute, second, millisecond: 0 });
}

/**
 * The instant a value names, a DATE or floating time read as UTC wall clock so two of them
 * still subtract to their wall-clock distance.
 *
 * @param value - The iCalendar value
 * @param calendar - Resolves `TZID`s through its `VTIMEZONE`s
 * @returns Epoch milliseconds
 */
export function instantOfValue(value: ICalendar.DateValue, calendar?: ICalendar.Calendar): number {
	return icalInstant(value, calendar) ?? wallOfValue(value);
}

/**
 * A value as a LocalDateTime in a zone: the wall clock as written when the zones agree,
 * the instant read in the target zone when they differ.
 *
 * @param value - The iCalendar value
 * @param zone - The JSCalendar object's zone, `null` for floating
 * @param calendar - Resolves the value's own `TZID`
 * @returns The LocalDateTime
 */
export function toLocal(
	value: ICalendar.DateValue,
	zone: string | null,
	calendar?: ICalendar.Calendar,
): JSCalendar.LocalDateTime {
	let own = zoneOf(value);
	if (own === null || zone === null || own === zone) {
		return formatLocalDateTime(wallFromMs(wallOfValue(value)));
	}
	return formatLocalDateTime(wallFromMs(toWall(instantOfValue(value, calendar), zone)));
}

/**
 * The form an object's dates take in iCalendar, per the mapping draft: a DATE for an
 * all-day floating object whose times are all midnight, the UTC form for `Etc/UTC`, a
 * `TZID` for any other zone, floating without one.
 *
 * @param zone - The object's `timeZone`
 * @param allDay - Whether `showWithoutTime` is set and every time is midnight
 * @returns The form
 */
export function formOf(zone: string | null | undefined, allDay: boolean): DateForm {
	if (!zone) return allDay ? { kind: "date" } : { kind: "floating" };
	if (isUTCZone(zone)) return { kind: "utc" };
	return { kind: "zoned", tzid: zone };
}

/**
 * Writes a LocalDateTime in a form. Fractions of a second are dropped, since a DATE-TIME
 * counts whole seconds.
 *
 * @param local - The LocalDateTime
 * @param form - How the component writes its dates
 * @returns The iCalendar value, or `null` for a malformed LocalDateTime
 */
export function fromLocal(local: string, form: DateForm): ICalendar.DateValue | null {
	let parts = parseLocalDateTime(local);
	if (!parts) return null;
	let { year, month, day, hour, minute, second } = parts;
	if (form.kind === "date") return { type: "date", year, month, day };
	let wall = { year, month, day, hour, minute, second };
	if (form.kind === "utc") return { type: "date-time", wall, zone: "utc" };
	if (form.kind === "zoned") return { type: "date-time", wall, zone: { tzid: form.tzid } };
	return { type: "date-time", wall, zone: "floating" };
}

/**
 * An UNTIL for a rule: RFC 5545 requires UTC when the start has a `TZID`, so a zoned
 * LocalDateTime is converted to the instant it names.
 *
 * @param local - The rule's `until`
 * @param form - The start's form
 * @returns The iCalendar value
 */
export function untilOf(local: string, form: DateForm): ICalendar.DateValue {
	let value = fromLocal(local, form) ?? { type: "date-time", wall: wallFromMs(0), zone: "utc" };
	if (form.kind !== "zoned" || value.type === "date") return value;
	let instant = toInstant(wallOfValue(value), form.tzid);
	let { year, month, day, hour, minute, second } = wallFromMs(instant);
	return { type: "date-time", wall: { year, month, day, hour, minute, second }, zone: "utc" };
}

/**
 * A JSCalendar duration in iCalendar's model. RFC 5545 writes weeks only on their own, so
 * weeks beside other parts become days, and fractions of a second are dropped.
 *
 * @param parts - The JSCalendar duration
 * @returns The iCalendar duration
 */
export function toICalendarDuration(parts: DurationParts): ICalendar.Duration {
	let duration: ICalendar.Duration = {};
	if (parts.negative) duration.negative = true;
	let alone = !parts.days && !parts.hours && !parts.minutes && !parts.seconds;
	if (parts.weeks && alone) duration.weeks = parts.weeks;
	let days = (parts.weeks && !alone ? parts.weeks * 7 : 0) + (parts.days ?? 0);
	if (days) duration.days = days;
	if (parts.hours) duration.hours = parts.hours;
	if (parts.minutes) duration.minutes = parts.minutes;
	let seconds = Math.floor(parts.seconds ?? 0);
	if (seconds) duration.seconds = seconds;
	return duration;
}

/**
 * Exact milliseconds as duration parts, the way the mapping draft writes a DTEND's distance
 * from DTSTART: hours, minutes and seconds only.
 *
 * @param ms - Milliseconds, clamped at zero
 * @returns The parts
 */
export function exactParts(ms: number): DurationParts {
	let total = Math.max(0, Math.round(ms / 1000));
	let parts: DurationParts = {};
	let hours = Math.floor(total / 3600);
	let minutes = Math.floor((total % 3600) / 60);
	let seconds = total % 60;
	if (hours) parts.hours = hours;
	if (minutes) parts.minutes = minutes;
	if (seconds) parts.seconds = seconds;
	return parts;
}

/**
 * Writes a value as raw content-line text with its parameters, for the properties of the
 * components the typed model keeps untyped, such as a `VTODO`.
 *
 * @param value - The iCalendar value
 * @returns The value text and its `VALUE`/`TZID` parameters
 */
export function rawDate(value: ICalendar.DateValue): {
	value: string;
	parameters: Record<string, string[]>;
} {
	let pad = (number: number, size = 2) => String(number).padStart(size, "0");
	if (value.type === "date") {
		return {
			value: `${pad(value.year, 4)}${pad(value.month)}${pad(value.day)}`,
			parameters: { VALUE: ["DATE"] },
		};
	}
	let { year, month, day, hour, minute, second } = value.wall;
	let text = `${pad(year, 4)}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}${pad(second)}`;
	if (value.zone === "utc") return { value: `${text}Z`, parameters: {} };
	if (value.zone === "floating") return { value: text, parameters: {} };
	return { value: text, parameters: { TZID: [value.zone.tzid] } };
}

/**
 * Reads a raw DATE or DATE-TIME with its parameters.
 *
 * @param value - E.g. `"20200119T180000"`
 * @param parameters - The property's parameters, for `TZID` and `VALUE`
 * @returns The iCalendar value, or `null` when the text is neither
 */
export function readRawDate(
	value: string,
	parameters: Record<string, string[]>,
): ICalendar.DateValue | null {
	let match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
	if (!match) return null;
	let [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number) as number[];
	if (match[4] === undefined) {
		return { type: "date", year: year as number, month: month as number, day: day as number };
	}
	let wall = {
		year: year as number,
		month: month as number,
		day: day as number,
		hour: hour as number,
		minute: minute as number,
		second: second as number,
	};
	if (match[7]) return { type: "date-time", wall, zone: "utc" };
	let tzid = parameters.TZID?.[0];
	return { type: "date-time", wall, zone: tzid ? { tzid } : "floating" };
}

/**
 * An untyped iCalendar property as jCal, its value kept as written under the `unknown`
 * value type so it converts back unchanged.
 *
 * @param property - The property
 * @returns The jCal property
 */
export function toJCalProperty(property: ICalendar.Property): JSCalendar.JCalProperty {
	let parameters: Record<string, string | string[]> = {};
	for (let [name, values] of Object.entries(property.parameters)) {
		parameters[name.toLowerCase()] = values.length === 1 ? (values[0] as string) : values;
	}
	return [property.name.toLowerCase(), parameters, "unknown", property.value];
}

/**
 * A jCal property back as an untyped iCalendar property. Values of known types are written
 * as their text; several values are joined by commas.
 *
 * @param property - The jCal property
 * @returns The iCalendar property
 */
export function fromJCalProperty(property: JSCalendar.JCalProperty): ICalendar.Property {
	let [name, rawParameters, , ...values] = property;
	let parameters: Record<string, string[]> = {};
	for (let [key, value] of Object.entries(rawParameters)) {
		parameters[key.toUpperCase()] = Array.isArray(value) ? value : [value];
	}
	return { name: name.toUpperCase(), parameters, value: values.map(String).join(",") };
}

/**
 * An untyped component as jCal.
 *
 * @param component - The component
 * @returns The jCal component
 */
export function toJCalComponent(component: ICalendar.Component): JSCalendar.JCalComponent {
	return [
		component.name.toLowerCase(),
		component.properties.map(toJCalProperty),
		component.components.map(toJCalComponent),
	];
}

/**
 * A jCal component back as an untyped component.
 *
 * @param component - The jCal component
 * @returns The component
 */
export function fromJCalComponent(component: JSCalendar.JCalComponent): ICalendar.Component {
	let [name, properties, components] = component;
	return {
		name: name.toUpperCase(),
		properties: properties.map(fromJCalProperty),
		components: components.map(fromJCalComponent),
	};
}
