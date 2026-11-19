/**
 * A flexible-dates fare calendar: a month of departure days, or a scrolling strip of days around
 * the chosen one, each showing its lowest fare with the cheapest days tinted and named so. Every
 * day with flights is a link the caller builds, so choosing a date works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { mbe } from "@sdxc/u/size";

import type { Heading } from "../components/heading.js";

import { Calendar } from "../components/calendar.js";
import { dayTime, monthWeeks, weekdayTime } from "../utils/range-months.js";

/** The first weekday column when `weekStartsOn` is unset: Sunday. */
const DEFAULT_WEEK_STARTS_ON = 0;

/** A day cell's height: 48px, or the touch target on a coarse pointer when that is larger. */
const DAY_HEIGHT = "max(3rem, var(--ui-target-size, 0px))";

/** The previous and next links' size: 32px, or the touch target on a coarse pointer. */
const NAV_SIZE = "max(2rem, var(--ui-target-size, 0px))";

/** Prop types for {@link FareCalendar}. */
export namespace FareCalendar {
	/** How a day's fare compares with the others on view; `"low"` marks the cheapest. */
	export type Level = "low" | "mid" | "high";

	/** The lowest fare departing on one day. */
	export interface Fare {
		/** The fare, formatted by the caller, such as "$129". */
		amount: RemixNode;
		level: Level;
	}

	/** Words read to assistive technology, in the page's language. */
	export interface Labels {
		/** Name of the previous link, e.g. "Previous month" or "Earlier dates". */
		previous: string;
		/** Name of the next link, e.g. "Next month" or "Later dates". */
		next: string;
		/** Read after a cheapest day's fare, e.g. "cheapest". */
		cheapest: string;
		/** Read for a day without flights, e.g. "no flights". */
		noFlights: string;
	}

	/** Every native `<div>` attribute, plus the days, fares and links to draw. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** `"strip"` draws `days` as one scrolling row instead of a month grid. @default "month" */
		variant?: "month" | "strip";
		/** The month the grid shows, `YYYY-MM`; the strip ignores it. */
		month?: string;
		/** The days the strip shows, `YYYY-MM-DD`, usually a few either side of `selected`. */
		days?: string[];
		/** Each day's lowest fare by `YYYY-MM-DD`; a missing or `undefined` entry means no flights. */
		fares: Record<string, Fare | undefined>;
		/** The chosen day, `YYYY-MM-DD`, marked as the current page and scrolled into the strip's view. */
		selected?: string;
		/** Builds the URL a day links to. */
		href: (day: string) => string;
		/** The previous link's URL; the link is left out when unset. */
		prevHref?: string;
		/** The next link's URL; the link is left out when unset. */
		nextHref?: string;
		/** Today, `YYYY-MM-DD`, passed in so the server and the browser draw the same marker. */
		today?: string;
		/** First weekday column, 0 for Sunday through 6 for Saturday. @default 0 */
		weekStartsOn?: number;
		/** BCP 47 locale for the month, weekday and day names; server and browser must agree on it. */
		locale: string;
		/** Names the whole calendar, e.g. "Departure dates". */
		label: string;
		/** Level of the month's heading; resolved from the surrounding heading scope when unset. */
		headingLevel?: Heading.Level;
		labels: Labels;
	}
}

/** The formatters one render shares, built once for the caller's locale. */
interface Formats {
	/** The full spoken date, e.g. "Monday, March 2, 2026". */
	full: Intl.DateTimeFormat;
	/** The strip's weekday line, e.g. "Mon". */
	weekday: Intl.DateTimeFormat;
	/** The strip's date line, e.g. "Mar 2". */
	short: Intl.DateTimeFormat;
}

/**
 * Renders a month `<table>` with previous and next links, or, as `"strip"`, a `<nav>` named by
 * `label` around a scrolling row of day cards. A day with a fare links to `href(day)`, named by
 * its full date, fare and, at the `"low"` level, `labels.cheapest`; a day without one is text.
 *
 * @param handle Runtime handle carrying the calendar's props.
 * @returns The render function producing the calendar's markup.
 * @example
 * <FareCalendar
 * 	month="2026-03"
 * 	fares={fares}
 * 	selected="2026-03-14"
 * 	href={(day) => `?depart=${day}`}
 * 	prevHref="?month=2026-02"
 * 	nextHref="?month=2026-04"
 * 	locale="en-US"
 * 	label="Departure dates"
 * 	labels={{ previous: "Previous month", next: "Next month", cheapest: "cheapest", noFlights: "no flights" }}
 * />
 * @example
 * <FareCalendar variant="strip" days={week} fares={fares} selected={day} href={href} locale={locale} label="Nearby dates" labels={labels} />
 */
export function FareCalendar(handle: Handle<FareCalendar.Props>) {
	return () => {
		let {
			variant,
			month,
			days,
			fares,
			selected,
			href,
			prevHref,
			nextHref,
			today,
			weekStartsOn,
			locale,
			label,
			headingLevel,
			labels,
			mix,
			...rest
		} = handle.props;
		let formats: Formats = {
			full: new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }),
			weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }),
			short: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }),
		};

		/** One day's cell content, shared by the grid and the strip. */
		function day(date: string, strip: boolean) {
			return (
				<FareCalendarDay
					date={date}
					fare={fares[date]}
					strip={strip}
					href={href}
					selected={date === selected}
					today={date === today}
					formats={formats}
					labels={labels}
				/>
			);
		}

		if (variant === "strip") {
			return (
				<div
					data-slot="fare-calendar"
					data-variant="strip"
					{...rest}
					mix={mergeMix([raw({ minInlineSize: "0", fontVariantNumeric: "tabular-nums" })], mix)}
				>
					<nav
						aria-label={label}
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "auto minmax(0, 1fr) auto",
								alignItems: "center",
								gap: "0.25rem",
							}),
						]}
					>
						<FareCalendarNav href={prevHref} label={labels.previous} side="start" />
						<ul
							data-slot="fare-calendar-strip"
							mix={[
								raw({
									display: "flex",
									gap: "0.375rem",
									margin: "0",
									padding: "0.25rem",
									listStyle: "none",
									overflowX: "auto",
									overscrollBehaviorInline: "contain",
									scrollSnapType: "x proximity",
									scrollbarWidth: "thin",
								}),
							]}
						>
							{(days ?? []).map((date) => (
								<li
									key={date}
									data-selected={date === selected ? "" : undefined}
									mix={[
										raw({
											flex: "0 0 auto",
											minInlineSize: "4.75rem",
											scrollSnapAlign: "center",
											"&[data-selected]": { scrollInitialTarget: "nearest" },
										}),
									]}
								>
									{day(date, true)}
								</li>
							))}
						</ul>
						<FareCalendarNav href={nextHref} label={labels.next} side="end" />
					</nav>
				</div>
			);
		}

		let shown = month ?? (selected ?? today ?? "").slice(0, 7);
		let firstWeekday = weekStartsOn ?? DEFAULT_WEEK_STARTS_ON;
		let monthLabel = new Intl.DateTimeFormat(locale, {
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		}).format(dayTime(shown));
		let weekdays = Array.from({ length: 7 }, (_, index) =>
			formats.weekday.format(weekdayTime(firstWeekday, index)),
		);

		return (
			<div
				role="group"
				aria-label={label}
				data-slot="fare-calendar"
				data-variant="month"
				data-month={shown}
				{...rest}
				mix={mergeMix([raw({ minInlineSize: "0", fontVariantNumeric: "tabular-nums" })], mix)}
			>
				<Calendar.Header mix={[mbe(2), raw({ minBlockSize: NAV_SIZE })]}>
					<FareCalendarNav href={prevHref} label={labels.previous} side="start" />
					<Calendar.Heading level={headingLevel}>{monthLabel}</Calendar.Heading>
					<FareCalendarNav href={nextHref} label={labels.next} side="end" />
				</Calendar.Header>
				<Calendar.Grid
					aria-label={monthLabel}
					mix={[raw({ inlineSize: "100%", tableLayout: "fixed", borderSpacing: "0.125rem" })]}
				>
					<Calendar.GridHeader>
						<Calendar.Row>
							{weekdays.map((weekday) => (
								<Calendar.HeaderCell key={weekday}>{weekday}</Calendar.HeaderCell>
							))}
						</Calendar.Row>
					</Calendar.GridHeader>
					<Calendar.GridBody>
						{monthWeeks(shown, firstWeekday).map((week, row) => (
							<Calendar.Row key={`${shown}-${row}`}>
								{week.map((date, column) => (
									<td
										key={date ?? `${shown}-${row}-${column}`}
										data-slot={date === null ? "fare-calendar-blank" : "fare-calendar-cell"}
										mix={[raw({ padding: "0", verticalAlign: "top" })]}
									>
										{date === null ? null : day(date, false)}
									</td>
								))}
							</Calendar.Row>
						))}
					</Calendar.GridBody>
				</Calendar.Grid>
			</div>
		);
	};
}

/** Props of {@link FareCalendarNav}. */
interface FareCalendarNavProps {
	href?: string;
	label: string;
	side: "start" | "end";
}

/**
 * A previous or next link drawn as a round chevron button, mirrored for right-to-left pages.
 * An unset `href` keeps the slot empty, so the heading stays centred.
 */
function FareCalendarNav(handle: Handle<FareCalendarNavProps>) {
	return () => {
		let { href, label, side } = handle.props;
		if (href === undefined) {
			return <span aria-hidden="true" mix={[raw({ inlineSize: NAV_SIZE, flex: "none" })]} />;
		}
		return (
			<a
				href={href}
				aria-label={label}
				data-slot={side === "start" ? "fare-calendar-previous" : "fare-calendar-next"}
				mix={[
					raw({
						display: "grid",
						placeItems: "center",
						flex: "none",
						inlineSize: NAV_SIZE,
						blockSize: NAV_SIZE,
						borderRadius: "9999px",
						color: "var(--ui-neutral-fg)",
						"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
						"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" },
						"& svg": { inlineSize: "1rem", blockSize: "1rem" },
						"&:dir(rtl) svg": { scale: "-1 1" },
					}),
				]}
			>
				{side === "start" ? (
					<ChevronLeftIcon aria-hidden="true" />
				) : (
					<ChevronRightIcon aria-hidden="true" />
				)}
			</a>
		);
	};
}

/** Props of {@link FareCalendarDay}. */
interface FareCalendarDayProps {
	date: string;
	fare: FareCalendar.Fare | undefined;
	/** Draws the strip's card, with the weekday and short date, instead of the grid's number. */
	strip: boolean;
	href: (day: string) => string;
	selected: boolean;
	today: boolean;
	formats: Formats;
	labels: FareCalendar.Labels;
}

/**
 * One day: a link when it has a fare, plain text when it has none. The drawn date is hidden from
 * assistive technology, which hears the full date, the fare and "cheapest" instead.
 */
function FareCalendarDay(handle: Handle<FareCalendarDayProps>) {
	return () => {
		let { date, fare, strip, href, selected, today, formats, labels } = handle.props;
		let time = dayTime(date);
		let face = strip ? (
			<span aria-hidden="true" data-slot="fare-calendar-date" mix={[raw({ display: "grid" })]}>
				<span data-slot="fare-calendar-weekday">{formats.weekday.format(time)}</span>
				<span data-slot="fare-calendar-number">{formats.short.format(time)}</span>
			</span>
		) : (
			<span aria-hidden="true" data-slot="fare-calendar-number">
				{Number(date.slice(8, 10))}
			</span>
		);
		let spoken = formats.full.format(time);
		let common = {
			"data-slot": "fare-calendar-day",
			"data-date": date,
			"data-level": fare?.level,
			"data-today": today ? "" : undefined,
			"data-strip": strip ? "" : undefined,
		};

		if (fare === undefined) {
			return (
				<span {...common} data-empty="" mix={[dayStyle()]}>
					{face}
					<span aria-hidden="true" data-slot="fare-calendar-amount">
						–
					</span>
					<span mix={[visuallyHidden()]}>{`${spoken}, ${labels.noFlights}`}</span>
				</span>
			);
		}

		let cheapest = fare.level === "low";
		return (
			<a
				{...common}
				href={href(date)}
				aria-current={currentToken(selected, today)}
				mix={[dayStyle()]}
			>
				{face}
				<span mix={[visuallyHidden()]}>{`${spoken}, `}</span>
				<span data-slot="fare-calendar-amount">{fare.amount}</span>
				{cheapest ? (
					<>
						<span mix={[visuallyHidden()]}>{`, ${labels.cheapest}`}</span>
						<span aria-hidden="true" data-slot="fare-calendar-marker" />
					</>
				) : null}
			</a>
		);
	};
}

/**
 * The `aria-current` token of a day link: the chosen day is the page the link leads to, and
 * today is marked as the current date only when it is not also the chosen one.
 */
function currentToken(selected: boolean, today: boolean): "page" | "date" | undefined {
	if (selected) return "page";
	return today ? "date" : undefined;
}

/**
 * A day's look: the cheapest tinted in the success tone with a dot in the corner and a bold fare,
 * the dearest fare muted, the chosen day filled with the brand colour, and today underlined. A
 * strip card is a wider rounded tile carrying the weekday over the date.
 */
function dayStyle() {
	return raw({
		position: "relative",
		display: "grid",
		alignContent: "center",
		justifyItems: "center",
		gap: "0.125rem",
		minBlockSize: DAY_HEIGHT,
		paddingBlock: "0.25rem",
		paddingInline: "0.125rem",
		boxSizing: "border-box",
		border: "1px solid transparent",
		borderRadius: "0.5rem",
		color: "var(--ui-neutral-fg-emphasis)",
		fontSize: "0.875rem",
		lineHeight: "1.1",
		textAlign: "center",
		textDecoration: "none",
		"&[data-strip]": {
			minBlockSize: "max(4rem, var(--ui-target-size, 0px))",
			paddingInline: "0.5rem",
			borderColor: "var(--ui-neutral-border)",
			borderRadius: "0.75rem",
		},
		"& [data-slot=fare-calendar-amount]": {
			maxInlineSize: "100%",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			fontSize: "0.625rem",
			fontWeight: "500",
			color: "var(--ui-neutral-fg)",
		},
		"&[data-strip] [data-slot=fare-calendar-amount]": { fontSize: "0.75rem" },
		"& [data-slot=fare-calendar-weekday]": {
			fontSize: "0.6875rem",
			color: "var(--ui-neutral-fg-muted)",
		},
		"&:is(a):hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
		"&:is(a):focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" },
		"&[data-level=low]": {
			backgroundColor: "var(--ui-success-bg-tint)",
			borderColor: "var(--ui-success-border)",
		},
		"&[data-level=low]:hover": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
		"&[data-level=low] [data-slot=fare-calendar-amount]": {
			fontWeight: "700",
			color: "var(--ui-success-fg-emphasis)",
		},
		"&[data-level=high] [data-slot=fare-calendar-amount]": { color: "var(--ui-neutral-fg-muted)" },
		"& [data-slot=fare-calendar-marker]": {
			position: "absolute",
			insetBlockStart: "0.25rem",
			insetInlineEnd: "0.25rem",
			inlineSize: "0.375rem",
			blockSize: "0.375rem",
			borderRadius: "9999px",
			backgroundColor: "var(--ui-success-bg-solid)",
		},
		"&[data-empty]": { color: "var(--ui-neutral-fg-muted)" },
		"&[data-empty] [data-slot=fare-calendar-amount]": { color: "var(--ui-neutral-fg-muted)" },
		"&[data-today] [data-slot=fare-calendar-number]": {
			fontWeight: "700",
			textDecorationLine: "underline",
			textDecorationThickness: "2px",
			textUnderlineOffset: "3px",
		},
		"&[aria-current=page]": {
			backgroundColor: "var(--ui-brand-bg-solid)",
			borderColor: "var(--ui-brand-border-strong)",
			color: "var(--ui-brand-fg-on-solid)",
			boxShadow: "inset 0 0 0 1px var(--ui-brand-fg-on-solid)",
		},
		"&[aria-current=page] :is([data-slot=fare-calendar-amount], [data-slot=fare-calendar-weekday])":
			{
				color: "inherit",
			},
		"&[aria-current=page] [data-slot=fare-calendar-marker]": {
			backgroundColor: "var(--ui-brand-fg-on-solid)",
		},
	});
}
