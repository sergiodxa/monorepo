/**
 * Tempo's reference pages: arithmetic, comparison, formatting and ranges, each a run of
 * small function sections with a signature, parameters, return value and an example whose
 * result is written beside the call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoDocsHref } from "~/resources/views/demo-docs";
import { DATE_PARAM, referencePage } from "~/resources/views/demo-docs/tempo/function-docs";

/** The addresses of Tempo's pages. */
const href = demoDocsHref("tempo");

/** The `amount` parameter the add functions take. */
const AMOUNT_PARAM = {
	name: "amount",
	type: "number",
	required: true,
	description: "How many units to add; negative values move backwards.",
};

/** The two-date parameters the comparison functions take. */
const PAIR_PARAMS = [
	{ ...DATE_PARAM, name: "a", description: "The moment being tested." },
	{ ...DATE_PARAM, name: "b", description: "The moment it is compared against." },
];

/** The unit names every function taking a `unit` accepts. */
const UNIT_TYPE = '"second" | "minute" | "hour" | "day" | "week" | "month" | "year"';

/** Adding, subtracting and measuring time, calendar-aware. */
export const ARITHMETIC = referencePage({
	title: "Arithmetic",
	description:
		"Move a date forwards or backwards by calendar units, measure the distance between two dates, and keep a date inside a range.",
	updated: "2026-10-26",
	intro: (
		<>
			Every function here returns a new <code>Date</code> and leaves its input untouched. Units are
			calendar units: adding a day across a daylight saving change keeps the wall-clock time.
		</>
	),
	functions: [
		{
			name: "addDays",
			signature: "addDays(date, amount)",
			returns: "Date",
			summary: "Moves a date by whole calendar days, keeping its time of day.",
			params: [DATE_PARAM, AMOUNT_PARAM],
			returnsText: "A new date the given number of days away.",
			example:
				'import { addDays } from "@tempo/core";\n\naddDays("2026-03-28T09:00", 2);\n// 2026-03-30T09:00, across the DST change',
		},
		{
			name: "addMonths",
			signature: "addMonths(date, amount)",
			returns: "Date",
			summary: "Moves a date by calendar months, clamping to the target month’s last day.",
			params: [DATE_PARAM, AMOUNT_PARAM],
			returnsText:
				"A new date in the target month; the 31st becomes the 30th, or the 28th in February.",
			example:
				'import { addMonths } from "@tempo/core";\n\naddMonths("2026-01-31", 1);\n// 2026-02-28',
		},
		{
			name: "addBusinessDays",
			signature: "addBusinessDays(date, amount, options?)",
			returns: "Date",
			summary: "Moves a date by working days, skipping weekends and the holidays you list.",
			params: [
				DATE_PARAM,
				AMOUNT_PARAM,
				{ name: "options", type: "BusinessDayOptions", description: "Which days count as work." },
			],
			returnsText: "A new date that falls on a working day.",
			options: {
				title: "BusinessDayOptions",
				rows: [
					{
						name: "weekend",
						type: "number[]",
						default: "[0, 6]",
						description: "The weekdays to skip, Sunday as 0.",
					},
					{
						name: "holidays",
						type: "Array<Date | string>",
						default: "[]",
						description: "Dates to skip besides the weekend.",
					},
				],
			},
			example:
				'import { addBusinessDays } from "@tempo/core";\n\naddBusinessDays("2026-12-24", 1, { holidays: ["2026-12-25"] });\n// 2026-12-28, a Monday',
		},
		{
			name: "subtract",
			signature: "subtract(date, duration)",
			returns: "Date",
			summary: "Moves a date backwards by a duration holding any mix of units.",
			params: [
				DATE_PARAM,
				{
					name: "duration",
					type: "Duration",
					required: true,
					description: "The units to subtract, largest first.",
					children: [
						{ name: "years", type: "number", default: "0" },
						{ name: "months", type: "number", default: "0" },
						{ name: "days", type: "number", default: "0" },
						{ name: "hours", type: "number", default: "0" },
						{ name: "minutes", type: "number", default: "0" },
					],
				},
			],
			returnsText: "A new date, with the largest units applied first.",
			example:
				'import { subtract } from "@tempo/core";\n\nsubtract("2026-10-31T12:00", { months: 1, hours: 3 });\n// 2026-09-30T09:00',
		},
		{
			name: "difference",
			signature: "difference(a, b, unit)",
			returns: "number",
			summary: "Counts the whole units between two dates.",
			params: [
				...PAIR_PARAMS,
				{ name: "unit", type: UNIT_TYPE, required: true, description: "What to count." },
			],
			returnsText: (
				<>
					A whole number, negative when <code>a</code> is before <code>b</code>; partial units round
					toward zero.
				</>
			),
			example:
				'import { difference } from "@tempo/core";\n\ndifference("2026-12-25", "2026-10-31", "day");\n// 55',
		},
		{
			name: "clamp",
			signature: "clamp(date, range)",
			returns: "Date",
			summary: "Keeps a date inside a range, moving it to the nearest end when it falls outside.",
			params: [
				DATE_PARAM,
				{
					name: "range",
					type: "Range",
					required: true,
					description: "The earliest and latest dates allowed.",
					children: [
						{ name: "start", type: "Date | string", required: true },
						{ name: "end", type: "Date | string", required: true },
					],
				},
			],
			returnsText: (
				<>
					The date itself when inside the range, else <code>start</code> or <code>end</code>.
				</>
			),
			example:
				'import { clamp } from "@tempo/core";\n\nclamp("2027-02-01", { start: "2026-01-01", end: "2026-12-31" });\n// 2026-12-31',
		},
	],
	next: [
		{
			title: "Comparison",
			href: href("reference/comparison"),
			description: "Check the order of the dates you just computed.",
		},
		{
			title: "Time zones",
			href: href("overview/time-zones"),
			description: "Why adding a day isn’t always adding 24 hours.",
		},
	],
});

/** Ordering and equality, at any precision. */
export const COMPARISON = referencePage({
	title: "Comparison",
	description:
		"Order two dates, test whether they share a day or month, check a date against a range, and pick the earliest or latest of many.",
	updated: "2026-10-22",
	intro: (
		<>
			Comparisons read their inputs as instants. Pass a <code>unit</code> to compare at a coarser
			precision, such as “the same day” rather than “the same millisecond”.
		</>
	),
	functions: [
		{
			name: "isBefore",
			signature: "isBefore(a, b, unit?)",
			returns: "boolean",
			summary: "Whether the first date comes before the second.",
			params: [
				...PAIR_PARAMS,
				{
					name: "unit",
					type: UNIT_TYPE,
					default: '"millisecond"',
					description: "The precision to compare at.",
				},
			],
			returnsText: (
				<>
					<code>true</code> when <code>a</code> is strictly earlier than <code>b</code> at that
					precision.
				</>
			),
			example:
				'import { isBefore } from "@tempo/core";\n\nisBefore("2026-10-31T23:00", "2026-10-31T01:00", "day");\n// false, the same day',
		},
		{
			name: "isAfter",
			signature: "isAfter(a, b, unit?)",
			returns: "boolean",
			summary: "Whether the first date comes after the second.",
			params: [
				...PAIR_PARAMS,
				{ name: "unit", type: UNIT_TYPE, default: '"millisecond"', description: "The precision." },
			],
			returnsText: (
				<>
					<code>true</code> when <code>a</code> is strictly later than <code>b</code> at that
					precision.
				</>
			),
			example:
				'import { isAfter } from "@tempo/core";\n\nisAfter("2026-11-01", "2026-10-31");\n// true',
		},
		{
			name: "isSame",
			signature: "isSame(a, b, unit)",
			returns: "boolean",
			summary: "Whether two dates fall in the same unit, such as the same week.",
			params: [
				...PAIR_PARAMS,
				{ name: "unit", type: UNIT_TYPE, required: true, description: "The unit both must share." },
			],
			returnsText: (
				<>
					<code>true</code> when both dates fall in the same calendar unit.
				</>
			),
			example:
				'import { isSame } from "@tempo/core";\n\nisSame("2026-10-26", "2026-11-01", "week");\n// true, weeks start on Monday',
		},
		{
			name: "isWithin",
			signature: "isWithin(date, range)",
			returns: "boolean",
			summary: "Whether a date falls inside a range, both ends included.",
			params: [
				DATE_PARAM,
				{
					name: "range",
					type: "Range",
					required: true,
					description: "The range to test against.",
					children: [
						{ name: "start", type: "Date | string", required: true },
						{ name: "end", type: "Date | string", required: true },
					],
				},
			],
			returnsText: (
				<>
					<code>true</code> when <code>{"start <= date <= end"}</code>.
				</>
			),
			example:
				'import { isWithin } from "@tempo/core";\n\nisWithin("2026-12-31", { start: "2026-12-01", end: "2026-12-31" });\n// true',
		},
		{
			name: "max",
			signature: "max(...dates)",
			returns: "Date",
			summary: "The latest of any number of dates.",
			params: [
				{
					name: "dates",
					type: "Array<Date | number | string>",
					required: true,
					description: "At least one date.",
				},
			],
			returnsText: (
				<>
					The latest date, as a <code>Date</code>.
				</>
			),
			example:
				'import { max } from "@tempo/core";\n\nmax("2026-01-05", "2026-03-01", "2025-12-31");\n// 2026-03-01',
		},
		{
			name: "min",
			signature: "min(...dates)",
			returns: "Date",
			summary: "The earliest of any number of dates.",
			params: [
				{
					name: "dates",
					type: "Array<Date | number | string>",
					required: true,
					description: "At least one date.",
				},
			],
			returnsText: (
				<>
					The earliest date, as a <code>Date</code>.
				</>
			),
			example:
				'import { min } from "@tempo/core";\n\nmin("2026-01-05", "2026-03-01", "2025-12-31");\n// 2025-12-31',
		},
	],
	next: [
		{
			title: "Ranges",
			href: href("reference/ranges"),
			description: "Walk every day between two dates instead of testing one.",
		},
		{
			title: "Formatting",
			href: href("reference/formatting"),
			description: "Show the dates you compared to a reader.",
		},
	],
});

/** Turning dates into text for a reader and back again. */
export const FORMATTING = referencePage({
	title: "Formatting",
	description:
		"Write a date for a reader in their locale, say how long ago something happened, spell out a duration, and read a date back from text.",
	updated: "2026-10-30",
	intro: (
		<>
			Formatting runs on <code>Intl</code>, so it costs no locale data in your bundle. Every
			function takes a <code>locale</code>; leave it out to use the runtime’s.
		</>
	),
	functions: [
		{
			name: "format",
			signature: "format(date, pattern, options?)",
			returns: "string",
			summary: "Writes a date with a named pattern, in the reader’s locale and time zone.",
			params: [
				DATE_PARAM,
				{
					name: "pattern",
					type: '"date" | "time" | "datetime" | "month" | "weekday"',
					required: true,
					description: "Which parts to write.",
				},
				{ name: "options", type: "FormatOptions", description: "Locale, zone and length." },
			],
			returnsText: "The formatted string.",
			options: {
				title: "FormatOptions",
				rows: [
					{
						name: "locale",
						type: "string",
						description: (
							<>
								A BCP 47 tag, such as <code>es-AR</code>.
							</>
						),
					},
					{
						name: "timeZone",
						type: "string",
						description: (
							<>
								An IANA zone, such as <code>Europe/Madrid</code>.
							</>
						),
					},
					{
						name: "length",
						type: '"short" | "medium" | "long"',
						default: '"medium"',
						description: "How much to spell out.",
					},
				],
			},
			example:
				'import { format } from "@tempo/core";\n\nformat("2026-10-31T18:30Z", "datetime", { locale: "es-AR", timeZone: "America/Buenos_Aires" });\n// "31 oct 2026, 15:30"',
		},
		{
			name: "formatRelative",
			signature: "formatRelative(date, base?, options?)",
			returns: "string",
			summary: "Says how far a date is from now, the way a person would.",
			params: [
				DATE_PARAM,
				{
					...DATE_PARAM,
					name: "base",
					required: false,
					default: "now",
					description: "The moment to measure from.",
				},
				{ name: "options", type: "{ locale?: string }", description: "The locale to write in." },
			],
			returnsText: "A phrase such as “in 3 days” or “yesterday”, using the largest whole unit.",
			example:
				'import { formatRelative } from "@tempo/core";\n\nformatRelative("2026-10-30", "2026-10-31");\n// "yesterday"',
		},
		{
			name: "formatDuration",
			signature: "formatDuration(duration, options?)",
			returns: "string",
			summary: "Spells out a duration, leaving out the units that are zero.",
			params: [
				{
					name: "duration",
					type: "Duration",
					required: true,
					description: "The units to write.",
					children: [
						{ name: "hours", type: "number", default: "0" },
						{ name: "minutes", type: "number", default: "0" },
						{ name: "seconds", type: "number", default: "0" },
					],
				},
				{ name: "options", type: '{ locale?: string; style?: "long" | "narrow" }' },
			],
			returnsText: "The duration as a list of units.",
			example:
				'import { formatDuration } from "@tempo/core";\n\nformatDuration({ hours: 1, minutes: 5 }, { style: "narrow" });\n// "1h 5m"',
		},
		{
			name: "parse",
			signature: "parse(text, options?)",
			returns: "Date | null",
			summary: "Reads a date from text a person typed, in their locale’s order.",
			params: [
				{ name: "text", type: "string", required: true, description: "What the reader typed." },
				{ name: "options", type: "{ locale?: string; timeZone?: string }" },
			],
			returnsText: (
				<>
					The date, or <code>null</code> when the text doesn’t name a real day.
				</>
			),
			example:
				'import { parse } from "@tempo/core";\n\nparse("31/10/2026", { locale: "en-GB" });\n// 2026-10-31\nparse("31/02/2026", { locale: "en-GB" });\n// null',
		},
	],
	next: [
		{
			title: "Time zones",
			href: href("overview/time-zones"),
			description: "Which zone a formatted date is written in, and why.",
		},
		{
			title: "Arithmetic",
			href: href("reference/arithmetic"),
			description: "Compute the dates before you format them.",
		},
	],
});

/** Sequences of days and weeks, and overlap between ranges. */
export const RANGES = referencePage({
	title: "Ranges",
	description:
		"List every day or week between two dates, and test whether two ranges overlap, for calendars and booking forms.",
	updated: "2026-10-19",
	intro: (
		<>
			A range is a <code>{"{ start, end }"}</code> pair with both ends included. The list functions
			are generators, so a range of years costs nothing until you read it.
		</>
	),
	functions: [
		{
			name: "eachDay",
			signature: "eachDay(range)",
			returns: "Iterable<Date>",
			summary: "Yields every calendar day in a range, at midnight local time.",
			params: [
				{
					name: "range",
					type: "Range",
					required: true,
					description: "The days to walk.",
					children: [
						{ name: "start", type: "Date | string", required: true },
						{ name: "end", type: "Date | string", required: true },
					],
				},
			],
			returnsText: (
				<>
					An iterable of dates; empty when <code>end</code> is before <code>start</code>.
				</>
			),
			example:
				'import { eachDay } from "@tempo/core";\n\n[...eachDay({ start: "2026-10-30", end: "2026-11-01" })];\n// [Oct 30, Oct 31, Nov 1]',
		},
		{
			name: "eachWeek",
			signature: "eachWeek(range, options?)",
			returns: "Iterable<Date>",
			summary: "Yields the first day of every week a range touches.",
			params: [
				{ name: "range", type: "Range", required: true, description: "The weeks to walk." },
				{
					name: "options",
					type: "{ weekStartsOn?: number }",
					description: "The first weekday, Monday as 1 by default.",
				},
			],
			returnsText: (
				<>
					An iterable of week starts, the first on or before <code>start</code>.
				</>
			),
			example:
				'import { eachWeek } from "@tempo/core";\n\n[...eachWeek({ start: "2026-10-01", end: "2026-10-14" })];\n// [Sep 28, Oct 5, Oct 12]',
		},
		{
			name: "overlaps",
			signature: "overlaps(a, b)",
			returns: "boolean",
			summary: "Whether two ranges share at least one moment.",
			params: [
				{ name: "a", type: "Range", required: true, description: "The first range." },
				{ name: "b", type: "Range", required: true, description: "The second range." },
			],
			returnsText: (
				<>
					<code>true</code> when the ranges share a moment; touching ends count as overlap.
				</>
			),
			example:
				'import { overlaps } from "@tempo/core";\n\noverlaps(\n\t{ start: "2026-11-02", end: "2026-11-06" },\n\t{ start: "2026-11-06", end: "2026-11-09" },\n);\n// true, both include Nov 6',
		},
	],
	next: [
		{
			title: "Comparison",
			href: href("reference/comparison"),
			description: "Test one date against a range with isWithin.",
		},
		{
			title: "Installation",
			href: href("overview/installation"),
			description: "Import only the range helpers to keep your bundle small.",
		},
	],
});
