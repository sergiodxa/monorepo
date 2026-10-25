/**
 * The `remix/data-schema` schemas of every JSCalendar object. Each keeps the properties it
 * does not name, so vendor extensions survive a read and write, and checks the value formats
 * and the cross-property rules RFC 8984 states as MUST.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "remix/data-schema";

import type { JSCalendar } from "../types.js";

import { isId, parseDuration, parseLocalDateTime, parseUTCDateTime } from "./values.js";

/** The weekdays a rule's `byDay` and `firstDayOfWeek` name. */
const WEEKDAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;

/** The frequencies of a recurrence rule, finest last. */
const FREQUENCIES = [
	"yearly",
	"monthly",
	"weekly",
	"daily",
	"hourly",
	"minutely",
	"secondly",
] as const;

/**
 * An object schema that keeps unknown properties, which RFC 8984 requires a client to
 * preserve.
 *
 * @param shape - The properties the object names
 * @returns The schema
 */
function open<shape extends Record<string, s.Schema<any, any>>>(shape: shape) {
	return s.object(shape, { unknownKeys: "passthrough" });
}

/**
 * An optional `@type`. RFC 8984 writes it on every object; reading it as optional on nested
 * objects accepts the documents jscalendarbis allows, while a wrong value still fails.
 *
 * @param name - The type name
 * @returns The schema
 */
function typeTag<const name extends string>(name: name) {
	return s.optional(s.literal(name));
}

/** An integer within JSON's safe range. */
function int() {
	return s.number().refine(Number.isSafeInteger, "Expected an integer");
}

/** A non-negative integer within JSON's safe range. */
function unsignedInt() {
	return int().refine((value) => value >= 0, "Expected a non-negative integer");
}

/** A string in the Id alphabet. */
function id() {
	return s.string().refine(isId, "Expected an Id: 1 to 255 characters of A-Za-z0-9, - and _");
}

/** A LocalDateTime such as `2020-01-15T13:00:00`. */
function localDateTime() {
	return s
		.string()
		.refine(
			(value) => parseLocalDateTime(value) !== null,
			"Expected a LocalDateTime such as 2020-01-15T13:00:00",
		);
}

/** A UTCDateTime such as `2020-01-02T18:23:04Z`. */
function utcDateTime() {
	return s
		.string()
		.refine(
			(value) => parseUTCDateTime(value) !== null,
			"Expected a UTCDateTime such as 2020-01-02T18:23:04Z",
		);
}

/** An unsigned Duration such as `PT1H30M`. */
function duration() {
	return s.string().refine((value) => {
		let parts = parseDuration(value);
		return parts !== null && !/^[+-]/.test(value);
	}, "Expected a Duration such as PT1H30M");
}

/** A Duration with an optional sign, such as `-PT15M`. */
function signedDuration() {
	return s
		.string()
		.refine((value) => parseDuration(value) !== null, "Expected a SignedDuration such as -PT15M");
}

/** A set of strings, written as a map of each to `true`. */
function trueMap() {
	return s.record(s.string(), s.literal(true as const));
}

/** A map of Ids to objects. */
function idMap<output>(value: s.Schema<unknown, output>) {
	return s.record(id(), value);
}

/** A map whose keys and values are both strings, such as `replyTo` or `sendTo`. */
function stringMap() {
	return s.record(s.string(), s.string());
}

/** A Relation object. */
const RELATION_SCHEMA: s.Schema<unknown, JSCalendar.Relation> = open({
	"@type": typeTag("Relation"),
	relation: s.optional(trueMap()),
});

/** A Link object. */
const LINK_SCHEMA: s.Schema<unknown, JSCalendar.Link> = open({
	"@type": typeTag("Link"),
	href: s.string(),
	cid: s.optional(s.string()),
	contentType: s.optional(s.string()),
	size: s.optional(unsignedInt()),
	rel: s.optional(s.string()),
	display: s.optional(s.string()),
	title: s.optional(s.string()),
});

/** A Location object. */
const LOCATION_SCHEMA: s.Schema<unknown, JSCalendar.Location> = open({
	"@type": typeTag("Location"),
	name: s.optional(s.string()),
	description: s.optional(s.string()),
	locationTypes: s.optional(trueMap()),
	relativeTo: s.optional(s.string()),
	timeZone: s.optional(s.string()),
	coordinates: s.optional(s.string()),
	links: s.optional(idMap(LINK_SCHEMA)),
});

/** A VirtualLocation object. */
const VIRTUAL_LOCATION_SCHEMA: s.Schema<unknown, JSCalendar.VirtualLocation> = open({
	"@type": typeTag("VirtualLocation"),
	name: s.optional(s.string()),
	description: s.optional(s.string()),
	uri: s.string(),
	features: s.optional(trueMap()),
});

/** A Participant object; `roles` is optional, as jscalendarbis reads it. */
const PARTICIPANT_SCHEMA: s.Schema<unknown, JSCalendar.Participant> = open({
	"@type": typeTag("Participant"),
	name: s.optional(s.string()),
	email: s.optional(s.string()),
	description: s.optional(s.string()),
	sendTo: s.optional(stringMap()),
	kind: s.optional(s.string()),
	roles: s.optional(trueMap()),
	locationId: s.optional(id()),
	language: s.optional(s.string()),
	participationStatus: s.optional(s.string()),
	participationComment: s.optional(s.string()),
	expectReply: s.optional(s.boolean()),
	scheduleAgent: s.optional(s.string()),
	scheduleForceSend: s.optional(s.boolean()),
	scheduleSequence: s.optional(unsignedInt()),
	scheduleStatus: s.optional(s.array(s.string())),
	scheduleUpdated: s.optional(utcDateTime()),
	sentBy: s.optional(s.string()),
	invitedBy: s.optional(id()),
	delegatedTo: s.optional(trueMap()),
	delegatedFrom: s.optional(trueMap()),
	memberOf: s.optional(trueMap()),
	links: s.optional(idMap(LINK_SCHEMA)),
	progress: s.optional(s.string()),
	progressUpdated: s.optional(utcDateTime()),
	percentComplete: s.optional(unsignedInt().refine((value) => value <= 100, "Expected 0 to 100")),
});

/** An OffsetTrigger. */
const OFFSET_TRIGGER_SCHEMA: s.Schema<unknown, JSCalendar.OffsetTrigger> = open({
	"@type": s.literal("OffsetTrigger"),
	offset: signedDuration(),
	relativeTo: s.optional(s.enum_(["start", "end"] as const)),
});

/** An AbsoluteTrigger. */
const ABSOLUTE_TRIGGER_SCHEMA: s.Schema<unknown, JSCalendar.AbsoluteTrigger> = open({
	"@type": s.literal("AbsoluteTrigger"),
	when: utcDateTime(),
});

/** A trigger of a type an extension defines, kept as written. */
const UNKNOWN_TRIGGER_SCHEMA: s.Schema<unknown, JSCalendar.UnknownTrigger> = open({
	"@type": s
		.string()
		.refine(
			(type) => type !== "OffsetTrigger" && type !== "AbsoluteTrigger",
			"Expected a valid OffsetTrigger or AbsoluteTrigger",
		),
});

/** An Alert object. */
const ALERT_SCHEMA: s.Schema<unknown, JSCalendar.Alert> = open({
	"@type": typeTag("Alert"),
	trigger: s.union([OFFSET_TRIGGER_SCHEMA, ABSOLUTE_TRIGGER_SCHEMA, UNKNOWN_TRIGGER_SCHEMA]),
	acknowledged: s.optional(utcDateTime()),
	relatedTo: s.optional(s.record(s.string(), RELATION_SCHEMA)),
	action: s.optional(s.string()),
});

/**
 * A list of integers each within `[-max, -1]` or `[1, max]`, or `[min, max]` when zero is
 * allowed.
 */
function intList(min: number, max: number, allowsNegative: boolean) {
	return s
		.array(int())
		.refine((values) => values.length > 0, "Expected at least one value")
		.refine(
			(values) =>
				values.every(
					(value) =>
						(value >= min && value <= max) || (allowsNegative && value <= -1 && value >= -max),
				),
			`Expected values within ${allowsNegative ? `-${max} to -1 or ` : ""}${min} to ${max}`,
		);
}

/** An NDay object. */
const NDAY_SCHEMA: s.Schema<unknown, JSCalendar.NDay> = open({
	"@type": typeTag("NDay"),
	day: s.enum_(WEEKDAYS),
	nthOfPeriod: s.optional(int().refine((value) => value !== 0, "Expected a non-zero ordinal")),
});

/** A RecurrenceRule object. */
const RECURRENCE_RULE_SCHEMA: s.Schema<unknown, JSCalendar.RecurrenceRule> = open({
	"@type": typeTag("RecurrenceRule"),
	frequency: s.enum_(FREQUENCIES),
	interval: s.optional(int().refine((value) => value >= 1, "Expected an interval of at least 1")),
	rscale: s.optional(s.string()),
	skip: s.optional(s.enum_(["omit", "backward", "forward"] as const)),
	firstDayOfWeek: s.optional(s.enum_(WEEKDAYS)),
	byDay: s.optional(s.array(NDAY_SCHEMA)),
	byMonthDay: s.optional(intList(1, 31, true)),
	byMonth: s.optional(
		s
			.array(
				s.string().refine((value) => /^[1-9]\d*L?$/.test(value), "Expected a month like 3 or 3L"),
			)
			.refine((values) => values.length > 0, "Expected at least one value"),
	),
	byYearDay: s.optional(intList(1, 366, true)),
	byWeekNo: s.optional(intList(1, 53, true)),
	byHour: s.optional(intList(0, 23, false)),
	byMinute: s.optional(intList(0, 59, false)),
	bySecond: s.optional(intList(0, 60, false)),
	bySetPosition: s.optional(intList(1, 366, true)),
	count: s.optional(unsignedInt().refine((value) => value >= 1, "Expected a count of at least 1")),
	until: s.optional(localDateTime()),
}).refine(
	(rule) => rule.count === undefined || rule.until === undefined,
	"A recurrence rule sets count or until, not both",
);

/** The shape events and tasks share. */
const COMMON_SHAPE = {
	uid: s.string(),
	relatedTo: s.optional(s.record(s.string(), RELATION_SCHEMA)),
	prodId: s.optional(s.string()),
	created: s.optional(utcDateTime()),
	updated: s.optional(utcDateTime()),
	sequence: s.optional(unsignedInt()),
	method: s.optional(s.string()),
	title: s.optional(s.string()),
	description: s.optional(s.string()),
	descriptionContentType: s.optional(s.string()),
	showWithoutTime: s.optional(s.boolean()),
	locations: s.optional(idMap(LOCATION_SCHEMA)),
	virtualLocations: s.optional(idMap(VIRTUAL_LOCATION_SCHEMA)),
	links: s.optional(idMap(LINK_SCHEMA)),
	locale: s.optional(s.string()),
	keywords: s.optional(trueMap()),
	categories: s.optional(trueMap()),
	color: s.optional(s.string()),
	recurrenceId: s.optional(localDateTime()),
	recurrenceIdTimeZone: s.optional(s.nullable(s.string())),
	recurrenceRules: s.optional(s.array(RECURRENCE_RULE_SCHEMA)),
	excludedRecurrenceRules: s.optional(s.array(RECURRENCE_RULE_SCHEMA)),
	recurrenceOverrides: s.optional(s.record(localDateTime(), s.record(s.string(), s.any()))),
	excluded: s.optional(s.boolean()),
	priority: s.optional(int().refine((value) => value >= 0 && value <= 9, "Expected 0 to 9")),
	freeBusyStatus: s.optional(s.string()),
	privacy: s.optional(s.string()),
	replyTo: s.optional(stringMap()),
	sentBy: s.optional(s.string()),
	participants: s.optional(idMap(PARTICIPANT_SCHEMA)),
	requestStatus: s.optional(s.string()),
	useDefaultAlerts: s.optional(s.boolean()),
	alerts: s.optional(idMap(ALERT_SCHEMA)),
	localizations: s.optional(s.record(s.string(), s.record(s.string(), s.any()))),
	timeZone: s.optional(s.nullable(s.string())),
};

/**
 * Whether an instance of a recurring object leaves out the properties that define the
 * recurrence, which RFC 8984 §4.3.1 forbids beside `recurrenceId`.
 *
 * @param object - The event or task
 * @returns `true` when the combination is allowed
 */
function instanceIsFlat(object: JSCalendar.Common): boolean {
	if (object.recurrenceId === undefined) return object.recurrenceIdTimeZone == null;
	return object.recurrenceRules === undefined && object.recurrenceOverrides === undefined;
}

/** The message `instanceIsFlat` fails with. */
const INSTANCE_MESSAGE =
	"recurrenceId excludes recurrenceRules and recurrenceOverrides, and recurrenceIdTimeZone needs recurrenceId";

/** An Event object. */
export const EVENT_SCHEMA: s.Schema<unknown, JSCalendar.Event> = open({
	"@type": s.literal("Event"),
	...COMMON_SHAPE,
	start: localDateTime(),
	duration: s.optional(duration()),
	status: s.optional(s.string()),
}).refine(instanceIsFlat, INSTANCE_MESSAGE);

/** A Task object; a task that recurs needs the `start` or `due` its rules apply to. */
export const TASK_SCHEMA: s.Schema<unknown, JSCalendar.Task> = open({
	"@type": s.literal("Task"),
	...COMMON_SHAPE,
	due: s.optional(localDateTime()),
	start: s.optional(localDateTime()),
	estimatedDuration: s.optional(duration()),
	percentComplete: s.optional(unsignedInt().refine((value) => value <= 100, "Expected 0 to 100")),
	progress: s.optional(s.string()),
	progressUpdated: s.optional(utcDateTime()),
})
	.refine(instanceIsFlat, INSTANCE_MESSAGE)
	.refine(
		(task) =>
			task.recurrenceRules === undefined || task.start !== undefined || task.due !== undefined,
		"A task with recurrenceRules needs start or due",
	);

/** A Group object, holding events and tasks. */
export const GROUP_SCHEMA: s.Schema<unknown, JSCalendar.Group> = open({
	"@type": s.literal("Group"),
	uid: s.string(),
	prodId: s.optional(s.string()),
	created: s.optional(utcDateTime()),
	updated: s.optional(utcDateTime()),
	title: s.optional(s.string()),
	description: s.optional(s.string()),
	descriptionContentType: s.optional(s.string()),
	links: s.optional(idMap(LINK_SCHEMA)),
	locale: s.optional(s.string()),
	keywords: s.optional(trueMap()),
	categories: s.optional(trueMap()),
	color: s.optional(s.string()),
	entries: s.array(s.variant("@type", { Event: EVENT_SCHEMA, Task: TASK_SCHEMA })),
	source: s.optional(s.string()),
});

/** Any top-level JSCalendar object, chosen by its `@type`. */
export const OBJECT_SCHEMA: s.Schema<unknown, JSCalendar.CalendarObject> = s.variant("@type", {
	Event: EVENT_SCHEMA,
	Task: TASK_SCHEMA,
	Group: GROUP_SCHEMA,
});
