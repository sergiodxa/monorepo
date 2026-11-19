/**
 * Sundial's invented world: the person signed in, their teammates across five time zones, the
 * calendars they keep, and a seed week of meetings, repeats, trips and holidays. Every seed date
 * is set from the visitor's current week, so the calendar always opens on a lived-in week.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** The demo's folder name and address segment. */
export const SLUG = "sundial";

/** The address of a Sundial screen. */
export const href = demoAppHref(SLUG);

/** The address a Sundial form posts to. */
export const actionHref = demoAppActionHref(SLUG);

/** The locale every date and time is written in. */
export const LOCALE = "en-US";

/** The zones a visitor can view the calendar in, and add as a second column. */
export const ZONES = [
	{ id: "America/New_York", label: "New York" },
	{ id: "America/Los_Angeles", label: "Los Angeles" },
	{ id: "America/Mexico_City", label: "Mexico City" },
	{ id: "Europe/London", label: "London" },
	{ id: "Europe/Lisbon", label: "Lisbon" },
	{ id: "Europe/Stockholm", label: "Stockholm" },
	{ id: "Asia/Kolkata", label: "Bengaluru" },
	{ id: "Asia/Tokyo", label: "Tokyo" },
	{ id: "Australia/Sydney", label: "Sydney" },
] as const;

/** The zone the calendar opens in. */
export const DEFAULT_ZONE = "America/New_York";

/** The second zone column it opens with. */
export const DEFAULT_SECOND_ZONE = "Europe/London";

/** The colours an event or calendar can take, each an oklch hue that reads on light and dark. */
export const COLORS = [
	{ id: "dial", name: "Dial blue", value: "oklch(0.56 0.13 245)" },
	{ id: "fern", name: "Fern", value: "oklch(0.58 0.12 150)" },
	{ id: "marigold", name: "Marigold", value: "oklch(0.72 0.15 75)" },
	{ id: "clay", name: "Clay", value: "oklch(0.6 0.14 40)" },
	{ id: "plum", name: "Plum", value: "oklch(0.52 0.13 320)" },
	{ id: "slate", name: "Slate", value: "oklch(0.55 0.03 250)" },
	{ id: "rose", name: "Rose", value: "oklch(0.62 0.16 10)" },
	{ id: "lagoon", name: "Lagoon", value: "oklch(0.62 0.1 200)" },
] as const;

/** A colour's id. */
export type ColorId = (typeof COLORS)[number]["id"];

/** One calendar in the sidebar. */
export interface Calendar {
	id: string;
	name: string;
	color: ColorId;
	/** Under "Other calendars": subscribed rather than owned, so its events are read-only. */
	subscribed?: boolean;
}

/** Every calendar, owned first. */
export const CALENDARS: Calendar[] = [
	{ id: "work", name: "Work", color: "dial" },
	{ id: "team", name: "Product team", color: "plum" },
	{ id: "personal", name: "Personal", color: "fern" },
	{ id: "fitness", name: "Training", color: "clay" },
	{ id: "holidays", name: "US holidays", color: "lagoon", subscribed: true },
	{ id: "birthdays", name: "Birthdays", color: "marigold", subscribed: true },
];

/** One person: the visitor or a teammate. */
export interface Person {
	id: string;
	name: string;
	/** A short role, such as "Design lead". */
	role: string;
	zone: string;
	/** Where they work from, shown beside their local time. */
	city: string;
	/** Their working hours, in minutes of their own day. */
	hours: { start: number; end: number };
	/** The hue their avatar is tinted with. */
	hue: number;
}

/** The person signed in. */
export const ME = "noor";

/** Everyone on the team, the visitor first. */
export const PEOPLE: Person[] = [
	{
		id: "noor",
		name: "Noor Haddad",
		role: "Product manager",
		zone: "America/New_York",
		city: "New York",
		hours: { start: 540, end: 1080 },
		hue: 245,
	},
	{
		id: "mara",
		name: "Mara Lindqvist",
		role: "Design lead",
		zone: "Europe/London",
		city: "London",
		hours: { start: 540, end: 1050 },
		hue: 320,
	},
	{
		id: "tomas",
		name: "Tomás Reyes",
		role: "Engineering lead",
		zone: "America/Mexico_City",
		city: "Mexico City",
		hours: { start: 540, end: 1080 },
		hue: 150,
	},
	{
		id: "priya",
		name: "Priya Raman",
		role: "Data scientist",
		zone: "Asia/Kolkata",
		city: "Bengaluru",
		hours: { start: 600, end: 1110 },
		hue: 40,
	},
	{
		id: "jonah",
		name: "Jonah Brooks",
		role: "Support lead",
		zone: "America/Los_Angeles",
		city: "Los Angeles",
		hours: { start: 480, end: 1020 },
		hue: 200,
	},
	{
		id: "aiko",
		name: "Aiko Sato",
		role: "Mobile engineer",
		zone: "Asia/Tokyo",
		city: "Tokyo",
		hours: { start: 570, end: 1110 },
		hue: 75,
	},
];

/** How an event repeats, as the edit dialog offers it. */
export type RepeatId = "none" | "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly";

/** The repeat choices, in the order the dialog lists them. */
export const REPEATS: Array<{ id: RepeatId; name: string }> = [
	{ id: "none", name: "Does not repeat" },
	{ id: "daily", name: "Every day" },
	{ id: "weekdays", name: "Every weekday" },
	{ id: "weekly", name: "Every week" },
	{ id: "biweekly", name: "Every two weeks" },
	{ id: "monthly", name: "Every month" },
	{ id: "yearly", name: "Every year" },
];

/** A visitor's answer to an invitation. */
export type Rsvp = "yes" | "maybe" | "no" | "pending";

/** One event, stored in the zone it was planned in, as a seed or as the visitor changed it. */
export interface CalendarEvent {
	id: string;
	calendar: string;
	title: string;
	/** The first day, as `YYYY-MM-DD` in {@link zone}. */
	date: string;
	/** Minutes from the start of {@link date}; `null` for an all-day event. */
	start: number | null;
	/** Minutes long for a timed event, days long for an all-day one. */
	length: number;
	/** The zone its wall-clock time belongs to, which keeps a repeat at that time across DST. */
	zone: string;
	repeat: RepeatId;
	/** Days of a repeat that were skipped or moved, as `YYYY-MM-DD` in {@link zone}. */
	exceptions?: string[];
	/** Guests' person ids, the visitor included when invited. */
	guests: string[];
	organizer?: string;
	location?: string;
	notes?: string;
	/** Overrides the calendar's colour. */
	color?: ColorId;
	/** The visitor's answer, for an event someone else organises. */
	rsvp?: Rsvp;
}

/** A `YYYY-MM-DD` day moved by whole days. */
export function shiftDate(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** The Monday on or before a day. */
export function mondayOf(date: string): string {
	let weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
	return shiftDate(date, -((weekday + 6) % 7));
}

/** Minutes from a `HH:MM` clock. */
function at(clock: string): number {
	let [hour = "0", minute = "0"] = clock.split(":");
	return Number(hour) * 60 + Number(minute);
}

/**
 * The seed calendar for the week holding `today`: repeats that began weeks ago, this week's
 * one-offs and next week's trip, so the previous, current and next weeks all read as real.
 *
 * @param today The visitor's today, as `YYYY-MM-DD` in their zone.
 */
export function seedEvents(today: string): CalendarEvent[] {
	let monday = mondayOf(today);
	let day = (offset: number) => shiftDate(monday, offset);
	let year = Number(today.slice(0, 4));
	let ny = "America/New_York";
	let timed = (
		id: string,
		calendar: string,
		title: string,
		offset: number,
		start: string,
		length: number,
		extra: Partial<CalendarEvent> = {},
	): CalendarEvent => ({
		id,
		calendar,
		title,
		date: day(offset),
		start: at(start),
		length,
		zone: ny,
		repeat: "none",
		guests: [ME],
		organizer: ME,
		...extra,
	});
	let allDay = (
		id: string,
		calendar: string,
		title: string,
		date: string,
		days: number,
		extra: Partial<CalendarEvent> = {},
	): CalendarEvent => ({
		id,
		calendar,
		title,
		date,
		start: null,
		length: days,
		zone: ny,
		repeat: "none",
		guests: [],
		...extra,
	});
	return [
		timed("standup", "team", "Standup", -56, "09:30", 15, {
			repeat: "weekdays",
			guests: ["noor", "mara", "tomas", "jonah"],
			location: "Huddle · #product",
			notes: "Yesterday, today, blockers. Fifteen minutes, then we stop.",
		}),
		timed("london-sync", "work", "Design sync with London", -55, "15:00", 45, {
			zone: "Europe/London",
			repeat: "weekly",
			guests: ["noor", "mara", "aiko"],
			organizer: "mara",
			location: "Room Meridian · video link in notes",
			notes:
				"Set at 3 PM London time, so it moves an hour on a New York clock for the weeks when only one side has changed its clocks.",
			rsvp: "yes",
		}),
		timed("one-on-one", "work", "1:1 Noor / Tomás", -60, "11:00", 30, {
			repeat: "biweekly",
			guests: ["noor", "tomas"],
			location: "Video call",
		}),
		timed("gym", "fitness", "Strength", -63, "07:00", 60, {
			repeat: "weekly",
			guests: [ME],
			location: "Riverside gym",
		}),
		timed("gym-thu", "fitness", "Easy run", -60, "07:00", 45, {
			repeat: "weekly",
			guests: [ME],
			location: "Hudson River path",
		}),
		timed("review", "work", "Roadmap review", 0, "13:00", 90, {
			guests: ["noor", "mara", "tomas", "priya"],
			location: "Room Gnomon",
			notes: "Bring the Q1 bets. Each gets ten minutes and one decision.",
		}),
		timed("review-prep", "work", "Prep: roadmap review", 0, "11:30", 60, {
			location: "Focus time",
		}),
		timed("research", "work", "Customer interview: Halden Co.", 0, "12:00", 45, {
			guests: ["noor", "jonah"],
			organizer: "jonah",
			location: "Video call",
			rsvp: "maybe",
		}),
		timed("lunch", "personal", "Lunch with Sam", 1, "12:30", 60, {
			location: "Ferro, 22nd St",
		}),
		timed("metrics", "team", "Metrics walkthrough", 1, "10:00", 60, {
			guests: ["noor", "priya", "tomas"],
			organizer: "priya",
			location: "Video call",
			rsvp: "pending",
		}),
		timed("metrics-overlap", "work", "Hiring debrief", 1, "10:30", 30, {
			guests: ["noor", "tomas"],
			location: "Room Gnomon",
		}),
		timed("design-crit", "team", "Design crit", 2, "14:00", 60, {
			guests: ["noor", "mara", "aiko"],
			organizer: "mara",
			location: "Video call",
			rsvp: "yes",
		}),
		timed("focus", "work", "Focus: write the brief", 2, "09:45", 120, {
			location: "Do not book",
		}),
		timed("vendor", "work", "Vendor call: Lumen Maps", 2, "16:00", 30, {
			guests: ["noor"],
			location: "Phone",
		}),
		timed("retro", "team", "Sprint retro", 3, "15:30", 60, {
			guests: ["noor", "mara", "tomas", "jonah", "aiko"],
			organizer: "tomas",
			location: "Room Meridian",
			rsvp: "yes",
		}),
		timed("dentist", "personal", "Dentist", 3, "08:00", 45, {
			location: "Dr. Ilves, 5th Ave",
		}),
		timed("launch", "work", "Launch go/no-go", 4, "10:00", 30, {
			guests: ["noor", "tomas", "jonah", "priya"],
			location: "Video call",
		}),
		timed("drinks", "personal", "Team drinks", 4, "17:30", 120, {
			guests: ["noor", "mara", "tomas", "jonah"],
			location: "The Copper Still",
		}),
		timed("tokyo-handoff", "work", "Handoff with Tokyo", 4, "19:00", 30, {
			guests: ["noor", "aiko"],
			organizer: "aiko",
			location: "Video call",
			rsvp: "yes",
		}),
		timed("market", "personal", "Farmers market", 5, "10:00", 90, {
			location: "Union Square",
		}),
		timed("flight", "personal", "Flight to Lisbon · TP 202", 8, "21:40", 420, {
			location: "JFK Terminal 1",
			notes: "Lands in Lisbon at 9:40 AM local time.",
		}),
		allDay("offsite", "work", "Product offsite, Lisbon", day(9), 3, {
			location: "Lisbon",
			guests: ["noor", "mara", "tomas", "priya", "jonah", "aiko"],
		}),
		allDay("ooo-mara", "team", "Mara out of office", day(-3), 5, {
			guests: ["mara"],
		}),
		allDay("planning-week", "team", "Planning week", day(0), 5, {
			notes: "No new commitments until Friday's go/no-go.",
		}),
		allDay("payday", "personal", "Rent due", `${today.slice(0, 7)}-01`, 1, {
			repeat: "monthly",
		}),
		allDay("birthday-mara", "birthdays", "Mara's birthday", day(3), 1, { repeat: "yearly" }),
		allDay("birthday-tomas", "birthdays", "Tomás's birthday", `${year - 1}-01-14`, 1, {
			repeat: "yearly",
		}),
		...HOLIDAYS.flatMap(([month, dayOfMonth, title]) =>
			[year - 1, year, year + 1].map((holidayYear) =>
				allDay(
					`holiday-${holidayYear}-${month}`,
					"holidays",
					title,
					`${holidayYear}-${month}-${dayOfMonth}`,
					1,
				),
			),
		),
		...THANKSGIVING.map(([date, title]) => allDay(`holiday-${date}`, "holidays", title, date, 1)),
	];
}

/** Fixed-date holidays: month, day and name. */
const HOLIDAYS: Array<[string, string, string]> = [
	["01", "01", "New Year's Day"],
	["06", "19", "Juneteenth"],
	["07", "04", "Independence Day"],
	["11", "11", "Veterans Day"],
	["12", "25", "Christmas Day"],
];

/** Holidays that fall on a weekday rule, written out for the years the demo reaches. */
const THANKSGIVING: Array<[string, string]> = [
	["2025-11-27", "Thanksgiving"],
	["2026-11-26", "Thanksgiving"],
	["2027-11-25", "Thanksgiving"],
	["2026-09-07", "Labor Day"],
	["2027-09-06", "Labor Day"],
	["2026-05-25", "Memorial Day"],
	["2027-05-31", "Memorial Day"],
];

/** A calendar by id. */
export function findCalendar(id: string): Calendar | undefined {
	return CALENDARS.find((calendar) => calendar.id === id);
}

/** A person by id. */
export function findPerson(id: string): Person | undefined {
	return PEOPLE.find((person) => person.id === id);
}

/** A colour's CSS value, falling back to the first. */
export function colorValue(id: string | undefined): string {
	return (COLORS.find((color) => color.id === id) ?? COLORS[0]).value;
}

/** The colour an event draws in: its own, else its calendar's. */
export function eventColor(event: CalendarEvent): string {
	return colorValue(event.color ?? findCalendar(event.calendar)?.color);
}
