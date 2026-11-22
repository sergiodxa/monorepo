/**
 * Hollyhock Bakery's opening hours: the regular week, the days that break it, and the
 * plain-words status the page shows ("Open now · closes at 6 pm"), all reckoned in the
 * bakery's own time zone so a visitor in any zone reads the bakery's clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The bakery's clock: every hour on the page is a time on Alder Street. */
export const TIME_ZONE = "America/Chicago";

/** One stretch of a day the doors are open, in minutes after local midnight. */
export interface Opening {
	opens: number;
	closes: number;
}

/** A regular weekday: its name and its opening, or `null` when the bakery stays shut. */
export interface Weekday {
	name: string;
	opening: Opening | null;
}

/** A date whose hours differ from the regular week, and the reason in plain words. */
export interface Exception {
	/** The local date, `YYYY-MM-DD`. */
	date: string;
	reason: string;
	opening: Opening | null;
}

/** Turns "7:30" into minutes after midnight, so the tables below read as a shop sign. */
function at(time: string): number {
	let [hours = "0", minutes = "0"] = time.split(":");
	return Number(hours) * 60 + Number(minutes);
}

/** The regular week, Sunday first to match `Date#getUTCDay`. */
export const WEEK: readonly Weekday[] = [
	{ name: "Sunday", opening: { opens: at("8:00"), closes: at("14:00") } },
	{ name: "Monday", opening: null },
	{ name: "Tuesday", opening: { opens: at("7:00"), closes: at("18:00") } },
	{ name: "Wednesday", opening: { opens: at("7:00"), closes: at("18:00") } },
	{ name: "Thursday", opening: { opens: at("7:00"), closes: at("18:00") } },
	{ name: "Friday", opening: { opens: at("7:00"), closes: at("18:00") } },
	{ name: "Saturday", opening: { opens: at("7:00"), closes: at("16:00") } },
];

/** Holidays and the busy days around them, in date order. */
export const EXCEPTIONS: readonly Exception[] = [
	{
		date: "2026-11-25",
		reason: "Pie pickup night",
		opening: { opens: at("7:00"), closes: at("20:00") },
	},
	{ date: "2026-11-26", reason: "Thanksgiving", opening: null },
	{
		date: "2026-11-27",
		reason: "Late start after Thanksgiving",
		opening: { opens: at("9:00"), closes: at("15:00") },
	},
	{
		date: "2026-12-24",
		reason: "Christmas Eve",
		opening: { opens: at("7:00"), closes: at("14:00") },
	},
	{ date: "2026-12-25", reason: "Christmas Day", opening: null },
	{ date: "2026-12-26", reason: "Boxing Day rest", opening: null },
	{
		date: "2026-12-31",
		reason: "New Year's Eve",
		opening: { opens: at("7:00"), closes: at("15:00") },
	},
	{ date: "2027-01-01", reason: "New Year's Day", opening: null },
];

/** How close to closing time the status turns from "Open now" to "Closing soon". */
const CLOSING_SOON_MINUTES = 30;

/** How far ahead the page looks for the next opening and the next special days. */
const LOOKAHEAD_DAYS = 14;

/** One local calendar day as the bakery sees it. */
export interface LocalDay {
	/** `YYYY-MM-DD`. */
	date: string;
	/** 0 is Sunday. */
	weekday: number;
	/** The day's hours after any exception is applied. */
	opening: Opening | null;
	/** Why the day differs from the regular week, when it does. */
	exception: Exception | null;
}

/** What the sign on the door says at one instant. */
export interface Status {
	state: "open" | "closing-soon" | "closed";
	/** The short word on the badge: "Open now", "Closing soon", "Closed". */
	label: string;
	/** The rest of the sentence: "closes at 6 pm", "opens Tuesday at 7 am". */
	detail: string;
	/** Today, as the bakery's calendar has it. */
	today: LocalDay;
}

/** Reads a date's local calendar day and the minutes past local midnight. */
export function localClock(now: Date): { date: string; minutes: number } {
	let parts = new Intl.DateTimeFormat("en-US", {
		timeZone: TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now);
	let part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((entry) => entry.type === type)?.value ?? "0";
	return {
		date: `${part("year")}-${part("month")}-${part("day")}`,
		minutes: Number(part("hour")) * 60 + Number(part("minute")),
	};
}

/**
 * The local day `offset` days after `date`, with its hours. Calendar arithmetic runs on UTC
 * midnights, which never cross a daylight-saving change.
 */
export function dayAfter(date: string, offset: number): LocalDay {
	let [year, month, day] = date.split("-").map(Number);
	let moment = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + offset));
	let iso = moment.toISOString().slice(0, 10);
	let weekday = moment.getUTCDay();
	let exception = EXCEPTIONS.find((entry) => entry.date === iso) ?? null;
	let opening = exception ? exception.opening : (WEEK[weekday]?.opening ?? null);
	return { date: iso, weekday, opening, exception };
}

/** A time of day the way the sign writes it: "7 am", "6 pm", "7:30 am", "noon". */
export function formatTime(minutes: number): string {
	if (minutes === 12 * 60) return "noon";
	let hours = Math.floor(minutes / 60);
	let rest = minutes % 60;
	let suffix = hours < 12 ? "am" : "pm";
	let clock = hours % 12 === 0 ? 12 : hours % 12;
	return rest === 0 ? `${clock} ${suffix}` : `${clock}:${String(rest).padStart(2, "0")} ${suffix}`;
}

/** An opening as one range: "7 am – 6 pm". */
export function formatOpening(opening: Opening): string {
	return `${formatTime(opening.opens)} – ${formatTime(opening.closes)}`;
}

/** A local date as the page names it: "Thursday, November 26". */
export function formatDate(day: LocalDay): string {
	let [, month, date] = day.date.split("-").map(Number);
	let monthName = new Date(Date.UTC(2000, (month ?? 1) - 1, 1)).toLocaleString("en-US", {
		month: "long",
		timeZone: "UTC",
	});
	return `${WEEK[day.weekday]?.name ?? ""}, ${monthName} ${date}`;
}

/**
 * The next day the doors open after `today`, named the way a neighbour would say it:
 * "tomorrow" for the next day, the weekday within the week, the date beyond that.
 */
function nextOpening(today: LocalDay): string {
	for (let offset = 1; offset <= LOOKAHEAD_DAYS; offset++) {
		let day = dayAfter(today.date, offset);
		if (day.opening === null) continue;
		let when = offset === 1 ? "tomorrow" : (WEEK[day.weekday]?.name ?? "");
		if (offset >= 7) when = formatDate(day);
		return `opens ${when} at ${formatTime(day.opening.opens)}`;
	}
	return "back soon";
}

/**
 * What the door says at `now`: open with its closing time, closing within half an hour, or
 * closed with the next time it opens, which may be later today or days away for a holiday.
 */
export function openingStatus(now: Date): Status {
	let clock = localClock(now);
	let today = dayAfter(clock.date, 0);
	let opening = today.opening;

	if (opening && clock.minutes >= opening.opens && clock.minutes < opening.closes) {
		let soon = opening.closes - clock.minutes <= CLOSING_SOON_MINUTES;
		return {
			state: soon ? "closing-soon" : "open",
			label: soon ? "Closing soon" : "Open now",
			detail: `closes at ${formatTime(opening.closes)}`,
			today,
		};
	}

	if (opening && clock.minutes < opening.opens) {
		return {
			state: "closed",
			label: "Closed",
			detail: `opens today at ${formatTime(opening.opens)}`,
			today,
		};
	}

	let reason = today.exception && today.opening === null ? ` for ${today.exception.reason}` : "";
	return { state: "closed", label: `Closed${reason}`, detail: nextOpening(today), today };
}

/**
 * The exceptions still ahead of `now` (today included), soonest first, so the hours band
 * warns about the holiday next week and forgets last month's.
 */
export function upcomingExceptions(now: Date, limit = 4): LocalDay[] {
	let { date } = localClock(now);
	return EXCEPTIONS.filter((entry) => entry.date >= date)
		.slice(0, limit)
		.map((entry) => {
			let [year, month, day] = entry.date.split("-").map(Number);
			let weekday = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
			return { date: entry.date, weekday, opening: entry.opening, exception: entry };
		});
}

/**
 * The next `count` days the bakery opens, starting tomorrow, for the pickup-day picker:
 * an order is baked overnight, so today is never offered.
 */
export function pickupDays(now: Date, count = 5): LocalDay[] {
	let { date } = localClock(now);
	let days: LocalDay[] = [];
	for (let offset = 1; offset <= LOOKAHEAD_DAYS && days.length < count; offset++) {
		let day = dayAfter(date, offset);
		if (day.opening !== null) days.push(day);
	}
	return days;
}

/** The four seasons by the bakery's calendar, which sets what the specials board offers. */
export type Season = "winter" | "spring" | "summer" | "autumn";

/** The season a local date falls in: December to February is winter, and so on. */
export function seasonOf(date: string): Season {
	let month = Number(date.slice(5, 7));
	if (month === 12 || month <= 2) return "winter";
	if (month <= 5) return "spring";
	if (month <= 8) return "summer";
	return "autumn";
}
