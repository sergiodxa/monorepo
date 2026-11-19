/**
 * The changes a visitor can make to their calendar, written as JSCalendar does: a moved or deleted
 * repeat is a recurrence override, an edit to a seed event is a PatchObject against the seed, and
 * an event of the visitor's own is stored whole. Each returns the visitor's next set of changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSCalendar } from "@sdxc/jscalendar";

import type { Rsvp } from "./data";
import type { EventFields } from "./event";
import type { Entry } from "./model";
import type { Changes } from "./state";
import type { Instance } from "./time";

import { ME } from "./data";
import { answersOf, emailOf, organizerOf, participantsOf, statusOf } from "./model";

/** The seed's own events by uid, which a stored patch is computed against. */
export type Seeds = Map<string, Entry>;

/**
 * The PatchObject that turns one event into another: each top-level property that differs, set
 * to its new value, or `null` where it was removed.
 */
export function diff(from: JSCalendar.Event, to: JSCalendar.Event): JSCalendar.PatchObject {
	let patch: JSCalendar.PatchObject = {};
	let keys = new Set([...Object.keys(from), ...Object.keys(to)]);
	for (let key of keys) {
		let before = (from as unknown as Record<string, unknown>)[key];
		let after = (to as unknown as Record<string, unknown>)[key];
		if (JSON.stringify(before) !== JSON.stringify(after))
			patch[key] = after === undefined ? null : after;
	}
	return patch;
}

/**
 * Stores an event: a seed event on its own calendar as a patch against the seed, anything else
 * whole in the visitor's list. A seed moved to another calendar is stored as the visitor's own
 * copy, and the seed is hidden.
 */
export function store(changes: Changes, seeds: Seeds, entry: Entry): Changes {
	let seed = seeds.get(entry.event.uid);
	if (seed && seed.calendar === entry.calendar) {
		return {
			...changes,
			patched: { ...changes.patched, [entry.event.uid]: diff(seed.event, entry.event) },
		};
	}
	if (seed) {
		let copy = { ...entry, event: { ...entry.event, uid: `${entry.event.uid}-copy` } };
		return {
			...changes,
			deleted: [...new Set([...changes.deleted, seed.event.uid])],
			added: [...changes.added.filter((item) => item.event.uid !== copy.event.uid), copy],
		};
	}
	return {
		...changes,
		added: [...changes.added.filter((item) => item.event.uid !== entry.event.uid), entry],
	};
}

/** Removes an event: a seed's uid joins the deleted list, the visitor's own leaves theirs. */
export function remove(changes: Changes, seeds: Seeds, uid: string): Changes {
	if (seeds.has(uid)) return { ...changes, deleted: [...new Set([...changes.deleted, uid])] };
	return { ...changes, added: changes.added.filter((entry) => entry.event.uid !== uid) };
}

/** Adds to one occurrence's override, so the rest of the series stays as it was. */
function override(
	event: JSCalendar.Event,
	recurrenceId: string,
	patch: JSCalendar.PatchObject,
): JSCalendar.Event {
	let overrides = event.recurrenceOverrides ?? {};
	return {
		...event,
		recurrenceOverrides: { ...overrides, [recurrenceId]: { ...overrides[recurrenceId], ...patch } },
	};
}

/**
 * Reschedules an occurrence to a new start and length, in the event's own zone: the event itself
 * when it does not repeat, else that one occurrence's override.
 */
export function reschedule(instance: Instance, start: string, duration: string): JSCalendar.Event {
	if (instance.recurrenceId === undefined) return { ...instance.series, start, duration };
	return override(instance.series, instance.recurrenceId, { start, duration });
}

/** Skips one occurrence of a repeating event, or reports that the whole event goes. */
export function skip(instance: Instance): JSCalendar.Event | null {
	if (instance.recurrenceId === undefined) return null;
	return override(instance.series, instance.recurrenceId, { excluded: true });
}

/** Records the visitor's answer on the event, for every occurrence. */
export function answer(event: JSCalendar.Event, rsvp: Rsvp): JSCalendar.Event {
	let participant = event.participants?.[ME];
	if (!participant) return event;
	return {
		...event,
		participants: {
			...event.participants,
			[ME]: { ...participant, participationStatus: statusOf(rsvp) },
		},
	};
}

/** The event's properties a dialog sets, with guests rebuilt so earlier answers are kept. */
function properties(event: JSCalendar.Event, fields: EventFields): Partial<JSCalendar.Event> {
	let organizer = organizerOf(event) ?? ME;
	let solo = fields.guests.length === 0 || (fields.guests.length === 1 && fields.guests[0] === ME);
	return {
		title: fields.title,
		locations: fields.location
			? { main: { "@type": "Location", name: fields.location } }
			: undefined,
		description: fields.description,
		color: fields.color,
		participants: solo ? undefined : participantsOf(fields.guests, organizer, answersOf(event)),
		replyTo: solo ? undefined : { imip: `mailto:${emailOf(organizer)}` },
	};
}

/** Drops the properties a change left `undefined`, so the event serializes without them. */
function compact(event: JSCalendar.Event): JSCalendar.Event {
	return Object.fromEntries(
		Object.entries(event).filter(([, value]) => value !== undefined),
	) as unknown as JSCalendar.Event;
}

/**
 * Applies the edit dialog to an occurrence. "This event" on a repeat writes the occurrence's
 * override; otherwise the whole event changes, and a repeat keeps its first day, taking only the
 * new time of day, so an edit opened on a later occurrence never drops the earlier ones.
 */
export function edit(
	instance: Instance,
	fields: EventFields,
	scope: "this" | "all",
): JSCalendar.Event {
	let { series } = instance;
	let props = properties(series, fields);
	if (instance.recurrenceId !== undefined && scope === "this") {
		let patch: JSCalendar.PatchObject = { start: fields.start, duration: fields.duration };
		for (let [key, value] of Object.entries(props)) {
			let current = (series as unknown as Record<string, unknown>)[key];
			if (JSON.stringify(current) !== JSON.stringify(value)) patch[key] = value ?? null;
		}
		return override(series, instance.recurrenceId, patch);
	}
	let repeats = (series.recurrenceRules ?? []).length > 0;
	let rules = fields.recurrenceRules === "keep" ? series.recurrenceRules : fields.recurrenceRules;
	let start =
		repeats && rules ? `${series.start.slice(0, 10)}${fields.start.slice(10)}` : fields.start;
	return compact({
		...series,
		...props,
		start,
		duration: fields.duration,
		timeZone: fields.timeZone,
		showWithoutTime: fields.showWithoutTime ? true : undefined,
		recurrenceRules: rules,
		recurrenceOverrides: rules ? series.recurrenceOverrides : undefined,
		freeBusyStatus: fields.showWithoutTime ? "free" : "busy",
	});
}

/** A new event of the visitor's own, organized by them. */
export function create(uid: string, fields: EventFields): JSCalendar.Event {
	let event: JSCalendar.Event = {
		"@type": "Event",
		uid,
		title: fields.title,
		start: fields.start,
		duration: fields.duration,
		timeZone: fields.timeZone,
		freeBusyStatus: fields.showWithoutTime ? "free" : "busy",
	};
	return compact({
		...event,
		...properties(event, fields),
		showWithoutTime: fields.showWithoutTime ? true : undefined,
		recurrenceRules: fields.recurrenceRules === "keep" ? undefined : fields.recurrenceRules,
	});
}
