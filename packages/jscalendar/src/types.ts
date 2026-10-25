/**
 * The typed model of RFC 8984 JSCalendar: events, tasks and groups with their locations,
 * links, participants, alerts and recurrence rules. Every value is the JSON a document
 * carries, so a parsed object serializes back unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Groups the JSCalendar types under a single import surface.
 */
export namespace JSCalendar {
	/** Any top-level object a JSCalendar document holds. */
	export type CalendarObject = Event | Task | Group;

	/** An entry of a group: the objects that carry dates. */
	export type Entry = Event | Task;

	/**
	 * `A-Za-z0-9`, `-` and `_`, 1 to 255 octets: the keys of every map of objects, such as
	 * `locations` or `participants`.
	 */
	export type Id = string;

	/** `2020-01-15T13:00:00`: a wall-clock time read in the object's `timeZone`, or floating. */
	export type LocalDateTime = string;

	/** `2020-01-02T18:23:04Z`: an instant, always in UTC. */
	export type UTCDateTime = string;

	/** `PT1H30M` or `P1D`: weeks and days are nominal, hours and smaller are exact. */
	export type Duration = string;

	/** A `Duration` with an optional sign, `-PT15M` meaning fifteen minutes before. */
	export type SignedDuration = string;

	/** An IANA zone name such as `America/New_York`; `Etc/UTC` stands for UTC. */
	export type TimeZoneId = string;

	/**
	 * Patches keyed by a JSON Pointer without its leading `/`, e.g. `"title"` or
	 * `"participants/p1/participationStatus"`; a `null` value removes the property.
	 */
	export type PatchObject = Record<string, unknown>;

	/** The properties events and tasks share. */
	export interface Common {
		uid: string;
		/** The object's relationship to other objects, keyed by their `uid`. */
		relatedTo?: Record<string, Relation>;
		prodId?: string;
		created?: UTCDateTime;
		updated?: UTCDateTime;
		/** Increases with each significant revision, so clients replace their copy. */
		sequence?: number;
		/** The iTIP method, lowercase, e.g. `"request"`; set only on objects being sent. */
		method?: string;
		title?: string;
		description?: string;
		/** @default "text/plain" */
		descriptionContentType?: string;
		/** Whether the times are noise to show, as in an all-day event. */
		showWithoutTime?: boolean;
		locations?: Record<Id, Location>;
		virtualLocations?: Record<Id, VirtualLocation>;
		links?: Record<Id, Link>;
		/** A BCP 47 language tag for the free-text properties. */
		locale?: string;
		/** Free-form tags, each mapped to `true`. */
		keywords?: Record<string, true>;
		/** URIs of categories, each mapped to `true`. */
		categories?: Record<string, true>;
		/** A CSS color name or a `#rrggbb` value. */
		color?: string;
		/** Set on an object that is one instance of a recurring object. */
		recurrenceId?: LocalDateTime;
		recurrenceIdTimeZone?: TimeZoneId | null;
		/** Each rule adds its date-times, the union counted once. */
		recurrenceRules?: RecurrenceRule[];
		/** Date-times these generate are removed from the ones `recurrenceRules` adds. */
		excludedRecurrenceRules?: RecurrenceRule[];
		/**
		 * Keyed by recurrence id: `{}` adds an occurrence, `{ excluded: true }` removes one,
		 * and any other patch changes that occurrence.
		 */
		recurrenceOverrides?: Record<LocalDateTime, PatchObject>;
		/** Set only inside a recurrence override's patch. */
		excluded?: boolean;
		/** `1` is the highest and `9` the lowest; `0` means undefined. */
		priority?: number;
		freeBusyStatus?: "free" | "busy" | (string & {});
		/** An unknown value is kept and treated as `"private"`. */
		privacy?: "public" | "private" | "secret" | (string & {});
		/** Reply methods to their URIs, e.g. `{ imip: "mailto:organizer@example.com" }`. */
		replyTo?: Record<string, string>;
		sentBy?: string;
		participants?: Record<Id, Participant>;
		requestStatus?: string;
		useDefaultAlerts?: boolean;
		alerts?: Record<Id, Alert>;
		/** Language tags to patches translating this object's text. */
		localizations?: Record<string, PatchObject>;
		/** The zone `start` and `due` are read in; unset or `null` means floating time. */
		timeZone?: TimeZoneId | null;
		/** What a conversion from iCalendar kept that has no JSCalendar property. */
		iCalendar?: ICalComponent;
	}

	/** A scheduled amount of time on a calendar. */
	export interface Event extends Common {
		"@type": "Event";
		start: LocalDateTime;
		/** @default "PT0S" */
		duration?: Duration;
		/** @default "confirmed" */
		status?: "confirmed" | "cancelled" | "tentative" | (string & {});
	}

	/** An action item, assignment or to-do. */
	export interface Task extends Common {
		"@type": "Task";
		due?: LocalDateTime;
		start?: LocalDateTime;
		estimatedDuration?: Duration;
		/** `0` to `100`. */
		percentComplete?: number;
		progress?: "needs-action" | "in-process" | "completed" | "failed" | "cancelled" | (string & {});
		progressUpdated?: UTCDateTime;
	}

	/** A collection of events and tasks, the counterpart of a whole `VCALENDAR`. */
	export interface Group {
		"@type": "Group";
		uid: string;
		prodId?: string;
		created?: UTCDateTime;
		updated?: UTCDateTime;
		title?: string;
		description?: string;
		descriptionContentType?: string;
		links?: Record<Id, Link>;
		locale?: string;
		keywords?: Record<string, true>;
		categories?: Record<string, true>;
		color?: string;
		entries: Entry[];
		/** Where the group can be re-fetched. */
		source?: string;
		/** What a conversion from iCalendar kept that has no JSCalendar property. */
		iCalendar?: ICalComponent;
	}

	/** A physical place. */
	export interface Location {
		"@type"?: "Location";
		name?: string;
		description?: string;
		locationTypes?: Record<string, true>;
		/** `"start"` or `"end"`: the place the event starts or ends at. */
		relativeTo?: "start" | "end" | (string & {});
		/** The zone of this place, e.g. where a flight lands. */
		timeZone?: TimeZoneId;
		/** A `geo:` URI. */
		coordinates?: string;
		links?: Record<Id, Link>;
	}

	/** A way to join an event online. */
	export interface VirtualLocation {
		"@type"?: "VirtualLocation";
		name?: string;
		description?: string;
		uri: string;
		features?: Record<string, true>;
	}

	/** An external resource, such as a page about the event or an attachment. */
	export interface Link {
		"@type"?: "Link";
		href: string;
		cid?: string;
		contentType?: string;
		size?: number;
		/** A registered link relation, e.g. `"describedby"` or `"icon"`. */
		rel?: string;
		display?: string;
		title?: string;
	}

	/** How this object relates to another, e.g. `{ relation: { parent: true } }`. */
	export interface Relation {
		"@type"?: "Relation";
		/** An empty map leaves the relation unspecified. */
		relation?: Record<string, true>;
	}

	/** Someone or something taking part: an attendee, the owner, a room. */
	export interface Participant {
		"@type"?: "Participant";
		name?: string;
		email?: string;
		description?: string;
		/** Methods to reach them, e.g. `{ imip: "mailto:guest@example.com" }`. */
		sendTo?: Record<string, string>;
		kind?: "individual" | "group" | "location" | "resource" | (string & {});
		/** E.g. `{ owner: true, attendee: true }`. */
		roles?: Record<string, true>;
		locationId?: Id;
		language?: string;
		/** @default "needs-action" */
		participationStatus?:
			| "needs-action"
			| "accepted"
			| "declined"
			| "tentative"
			| "delegated"
			| (string & {});
		participationComment?: string;
		expectReply?: boolean;
		scheduleAgent?: "server" | "client" | "none" | (string & {});
		scheduleForceSend?: boolean;
		scheduleSequence?: number;
		scheduleStatus?: string[];
		scheduleUpdated?: UTCDateTime;
		sentBy?: string;
		invitedBy?: Id;
		delegatedTo?: Record<Id, true>;
		delegatedFrom?: Record<Id, true>;
		memberOf?: Record<Id, true>;
		links?: Record<Id, Link>;
		progress?: string;
		progressUpdated?: UTCDateTime;
		percentComplete?: number;
	}

	/** A reminder. */
	export interface Alert {
		"@type"?: "Alert";
		trigger: OffsetTrigger | AbsoluteTrigger | UnknownTrigger;
		acknowledged?: UTCDateTime;
		relatedTo?: Record<string, Relation>;
		/** @default "display" */
		action?: "display" | "email" | (string & {});
		/** What a conversion from iCalendar kept that has no JSCalendar property. */
		iCalendar?: ICalComponent;
	}

	/** Fires a duration from the start or end; a negative `offset` fires before it. */
	export interface OffsetTrigger {
		"@type": "OffsetTrigger";
		offset: SignedDuration;
		/** @default "start" */
		relativeTo?: "start" | "end";
	}

	/** Fires at an instant. */
	export interface AbsoluteTrigger {
		"@type": "AbsoluteTrigger";
		when: UTCDateTime;
	}

	/** A trigger from an extension this model does not know, kept as written. */
	export interface UnknownTrigger {
		"@type": string;
		[property: string]: unknown;
	}

	/** A repeating pattern: the `RRULE` of iCalendar as JSON. */
	export interface RecurrenceRule {
		"@type"?: "RecurrenceRule";
		frequency: "yearly" | "monthly" | "weekly" | "daily" | "hourly" | "minutely" | "secondly";
		/** @default 1 */
		interval?: number;
		/** @default "gregorian" */
		rscale?: string;
		/** @default "omit" */
		skip?: "omit" | "backward" | "forward";
		/** @default "mo" */
		firstDayOfWeek?: Weekday;
		byDay?: NDay[];
		byMonthDay?: number[];
		/** Month numbers as strings, `"3L"` naming a leap month. */
		byMonth?: string[];
		byYearDay?: number[];
		byWeekNo?: number[];
		byHour?: number[];
		byMinute?: number[];
		bySecond?: number[];
		bySetPosition?: number[];
		/** Counts the object's own start as the first occurrence. */
		count?: number;
		/** The last start, inclusive, in the object's zone. */
		until?: LocalDateTime;
	}

	/** A weekday, lowercase, as JSCalendar spells it. */
	export type Weekday = "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";

	/** A weekday in a rule, `nthOfPeriod: -1` naming the last one in the month or year. */
	export interface NDay {
		"@type"?: "NDay";
		day: Weekday;
		nthOfPeriod?: number;
	}

	/**
	 * The `iCalendar` property of the JSCalendar-iCalendar mapping: the component an object
	 * came from, with the properties and subcomponents that have no JSCalendar counterpart
	 * in jCal form, so converting back restores them.
	 */
	export interface ICalComponent {
		"@type"?: "ICalComponent";
		/** The component name, lowercase, e.g. `"vevent"`. */
		name: string;
		/** jCal properties: `[name, parameters, valueType, ...values]`. */
		properties?: JCalProperty[];
		/** jCal components: `[name, properties, components]`. */
		components?: JCalComponent[];
		/** Keyed by the PatchObject path of the property a conversion produced. */
		convertedProperties?: Record<string, ICalProperty>;
	}

	/** Which iCalendar property a JSCalendar property was converted from. */
	export interface ICalProperty {
		"@type"?: "ICalProperty";
		/** Lowercase, e.g. `"dtend"`. */
		name: string;
		valueType?: string;
		parameters?: Record<string, string | string[]>;
	}

	/** A property in jCal (RFC 7265): name, parameters, value type, then its values. */
	export type JCalProperty = [string, Record<string, string | string[]>, string, ...unknown[]];

	/** A component in jCal (RFC 7265): name, properties, subcomponents. */
	export type JCalComponent = [string, JCalProperty[], JCalComponent[]];
}
