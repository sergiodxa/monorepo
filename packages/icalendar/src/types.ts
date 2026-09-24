/**
 * The typed model of an iCalendar object: the calendar, its events, alarms and time zones,
 * the value types they carry, and the generic component and property layer that keeps
 * everything else so a calendar read and written back loses nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Groups the iCalendar types under a single import surface.
 */
export namespace ICalendar {
	/** One `VCALENDAR`: the unit a feed serves and a download holds. */
	export interface Calendar {
		/** `PRODID`, e.g. `"-//sergiodxa//uptime//EN"`; empty when a read calendar has none. */
		productId: string;
		/** iTIP `METHOD`; a published feed leaves it unset. */
		method?: "PUBLISH" | "REQUEST" | "REPLY" | "CANCEL" | (string & {});
		/** RFC 7986 `NAME`, written together with `X-WR-CALNAME` for clients that read only that. */
		name?: string;
		/** RFC 7986 `DESCRIPTION`, written together with `X-WR-CALDESC`. */
		description?: string;
		/** RFC 7986 `URL`: where the calendar can be re-fetched. */
		url?: string;
		/** RFC 7986 `REFRESH-INTERVAL`, written together with `X-PUBLISHED-TTL`. */
		refreshInterval?: Duration;
		/** Every `TZID` a date-time uses needs its `VTIMEZONE` here; UTC needs none. */
		timeZones: TimeZone[];
		events: Event[];
		/** Components other than `VEVENT` and `VTIMEZONE`, kept verbatim. */
		components: Component[];
		/** Calendar properties this interface does not name, e.g. `CALSCALE` or `X-` ones. */
		properties: Property[];
	}

	/** A `DATE`, or a `DATE-TIME` in UTC, floating (no zone), or in a `VTIMEZONE`'s zone. */
	export type DateValue =
		| { type: "date"; year: number; month: number; day: number }
		| { type: "date-time"; wall: WallClock; zone: "utc" | "floating" | { tzid: string } };

	/** A `PERIOD`: a start with either an end or a duration after it. */
	export interface Period {
		type: "period";
		start: DateValue;
		end?: DateValue;
		duration?: Duration;
	}

	/** The fields a clock shows; months and days count from `1`. */
	export interface WallClock {
		year: number;
		month: number;
		day: number;
		hour: number;
		minute: number;
		second: number;
	}

	/**
	 * A `DURATION`. Weeks and days are nominal (a day across a DST change lasts 23 or 25
	 * hours), and hours, minutes and seconds are exact.
	 */
	export interface Duration {
		negative?: boolean;
		weeks?: number;
		days?: number;
		hours?: number;
		minutes?: number;
		seconds?: number;
	}

	/**
	 * A `VEVENT`. A read event without `UID` has `uid: ""` and one without `DTSTAMP` has an
	 * invalid `dtstamp`; the writer omits both again, so the round trip keeps the event as it was.
	 */
	export interface Event {
		uid: string;
		dtstamp: Date;
		start: DateValue;
		/** Exclusive end; `end` wins when both it and `duration` are set. */
		end?: DateValue;
		duration?: Duration;
		summary?: string;
		description?: string;
		location?: string;
		url?: string;
		status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
		transparency?: "OPAQUE" | "TRANSPARENT";
		/** Increases with each significant revision, so clients replace their copy. */
		sequence?: number;
		created?: Date;
		lastModified?: Date;
		categories?: string[];
		recurrence?: RecurrenceRule;
		/** `RDATE`: extra starts, a period also carrying that occurrence's own length. */
		recurrenceDates?: (DateValue | Period)[];
		/** `EXDATE`: starts removed from the recurrence set. */
		exceptionDates?: DateValue[];
		recurrenceId?: DateValue;
		organizer?: CalendarUser;
		attendees?: Attendee[];
		alarms?: Alarm[];
		/** Event properties this interface does not name, kept verbatim. */
		properties: Property[];
	}

	/** A `RECUR` value, the body of an `RRULE`. */
	export interface RecurrenceRule {
		frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
		/** @default 1 */
		interval?: number;
		/** Mutually exclusive with `until`; `DTSTART` counts as the first occurrence. */
		count?: number;
		/** Inclusive last start, in UTC when the event's start is zoned. */
		until?: DateValue;
		bySecond?: number[];
		byMinute?: number[];
		byHour?: number[];
		/** An `ordinal` is valid with `MONTHLY` and `YEARLY` only; `-1` is the last. */
		byDay?: { weekday: Weekday; ordinal?: number }[];
		/** Negative days count from the month's end. */
		byMonthDay?: number[];
		byYearDay?: number[];
		byWeekNumber?: number[];
		byMonth?: number[];
		bySetPosition?: number[];
		/** @default "MO" */
		weekStart?: Weekday;
	}

	/** A weekday as `RRULE` spells it. */
	export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

	/** A `VALARM`. */
	export interface Alarm {
		/** Clients ignore actions they do not recognize, which a read alarm keeps as written. */
		action: "DISPLAY" | "AUDIO" | "EMAIL" | (string & {});
		/**
		 * When it fires: `before` the start (or end) by a duration, a negative one meaning
		 * after, or `at` an absolute instant.
		 */
		trigger: { before: Duration; related?: "START" | "END" } | { at: Date };
		description?: string;
		/** EMAIL only. */
		summary?: string;
		/** EMAIL only. */
		attendees?: CalendarUser[];
		repeat?: { count: number; every: Duration };
		/** Alarm properties this interface does not name, e.g. `ATTACH`, kept verbatim. */
		properties?: Property[];
	}

	/** An `ORGANIZER`, or the person an alarm emails. */
	export interface CalendarUser {
		/** A `mailto:` URI. */
		address: string;
		/** `CN`. */
		name?: string;
		/** Parameters the type does not name, e.g. `CUTYPE` or `DELEGATED-FROM`, decoded. */
		parameters?: Record<string, string[]>;
	}

	/** An `ATTENDEE`. */
	export interface Attendee extends CalendarUser {
		role?: "CHAIR" | "REQ-PARTICIPANT" | "OPT-PARTICIPANT" | "NON-PARTICIPANT";
		participation?: "NEEDS-ACTION" | "ACCEPTED" | "DECLINED" | "TENTATIVE" | "DELEGATED";
		rsvp?: boolean;
	}

	/** A `VTIMEZONE`: the offsets a `TZID` resolves to, as observances with onsets. */
	export interface TimeZone {
		tzid: string;
		observances: Observance[];
		/** Zone properties this interface does not name, e.g. `TZURL` or `X-LIC-LOCATION`. */
		properties?: Property[];
	}

	/**
	 * A `STANDARD` or `DAYLIGHT` observance. Its onsets are `start` plus the instances of
	 * `recurrence` and `recurrenceDates`, all local times read with `offsetFrom`.
	 */
	export interface Observance {
		kind: "STANDARD" | "DAYLIGHT";
		start: WallClock;
		/** Minutes east of UTC before the onset. */
		offsetFrom: number;
		/** Minutes east of UTC from the onset on. */
		offsetTo: number;
		name?: string;
		recurrence?: RecurrenceRule;
		recurrenceDates?: WallClock[];
		properties?: Property[];
	}

	/** Any component, untyped, e.g. a `VTODO`; the shape jCal maps one to one. */
	export interface Component {
		/** Upper-cased, e.g. `"VTODO"`. */
		name: string;
		properties: Property[];
		components: Component[];
	}

	/** Any property, untyped. */
	export interface Property {
		/** Upper-cased, e.g. `"X-WR-TIMEZONE"`. */
		name: string;
		/** Upper-cased names to their decoded values; quoting and RFC 6868 carets are undone. */
		parameters: Record<string, string[]>;
		/**
		 * The value as written, after unfolding. TEXT escapes stay in place, because the
		 * property's value type decides whether `\,` is an escape; `unescapeText` undoes them.
		 */
		value: string;
	}

	/** What `parse` returns for one calendar. */
	export interface Parsed {
		calendar: Calendar;
		/** Recoverable departures from the RFC, e.g. a `VEVENT` without `DTSTAMP`. */
		warnings: string[];
	}
}
