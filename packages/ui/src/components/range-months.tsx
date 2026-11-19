/**
 * A server-rendered run of consecutive month grids for picking a stay's check-in and check-out,
 * or a single date. Every selectable day is a link the caller builds, so picking works without
 * script; a CSS-only band previews the range under the pointer once a start is chosen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { borderSpacing } from "@sdxc/u/layout";

import type { DaySelection, RangePosition } from "../utils/range-months.js";

import { CALENDAR_DAY_DATE_ATTRIBUTE } from "../mixins/calendar-keys.js";
import {
	dayTime,
	firstUnavailableAfter,
	monthWeeks,
	nextSelection,
	rangePosition,
	shiftMonth,
	weekdayTime,
} from "../utils/range-months.js";

import { Calendar } from "./calendar.js";
import { Heading } from "./heading.js";

/** How many months show when `months` is unset: a stay's two ends usually fit across two. */
const DEFAULT_MONTHS = 2;

/** The first weekday column when `weekStartsOn` is unset: Sunday. */
const DEFAULT_WEEK_STARTS_ON = 0;

/** The custom property every day cell sizes from: 40px, or the 44px touch target on a coarse pointer. */
const CELL = "var(--ui-range-months-cell)";

/** The previous and next links' size: 32px, or the touch target on a coarse pointer. */
const NAV = "max(2rem, var(--ui-target-size, 0px))";

/** The band colour for the days between the two ends of a chosen or previewed range. */
const BAND = "var(--ui-brand-bg-tint-hover)";

/** The lighter band a pending range previews toward the hovered or focused day. */
const PREVIEW = "var(--ui-brand-bg-tint)";

/** Matches a day cell the pointer or keyboard focus is on. */
const ACTIVE = ":is(:hover, :focus-within)";

/** Prop types for {@link RangeMonths}. */
export namespace RangeMonths {
	/** What a link asks the page to show next: the selection it makes and the first month on view. */
	export interface Next {
		/** First day of the range, or the picked day in single mode, `YYYY-MM-DD`. */
		start?: string;
		/** Last day of the range, `YYYY-MM-DD`; absent while only a start is chosen. */
		end?: string;
		/** First month on view, `YYYY-MM`. */
		month: string;
	}

	/** Words read to assistive technology, in the page's language. */
	export interface Labels {
		/** Name of the previous-month link, e.g. "Previous month". */
		previous: string;
		/** Name of the next-month link, e.g. "Next month". */
		next: string;
		/** Appended to the start day's name, e.g. "check-in". */
		start?: string;
		/** Appended to the end day's name, e.g. "check-out". */
		end?: string;
		/** Appended to the picked day's name in single mode. */
		selected?: string;
	}

	/** Every native `<div>` attribute, plus the months, selection and links to draw. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** First month shown, `YYYY-MM`. */
		month: string;
		/** How many consecutive months to show, side by side while they fit and one per row below. Defaults to {@link DEFAULT_MONTHS}. */
		months?: number;
		/** Chosen start day (the picked day in single mode), `YYYY-MM-DD`. */
		start?: string;
		/** Chosen end day, `YYYY-MM-DD`; read in range mode only. */
		end?: string;
		/** Picks one day: a day link carries `start` alone and no band is drawn. */
		single?: boolean;
		/** Today, `YYYY-MM-DD`, passed in so the server and the browser draw the same marker. */
		today?: string;
		/** Earliest selectable day, `YYYY-MM-DD`; also hides the previous link before its month. */
		min?: string;
		/** Latest selectable day, `YYYY-MM-DD`; also hides the next link from its month on. */
		max?: string;
		/** Days already taken: drawn struck through, never a link, and never crossed by a range. */
		isUnavailable?: (date: string) => boolean;
		/** Builds the URL of every day and month link from what that link selects. */
		href: (next: Next) => string;
		/** A small line under each day's number, such as the nightly price or event dots. */
		dayNote?: (date: string) => RemixNode;
		/** First weekday column, 0 for Sunday through 6 for Saturday. Defaults to {@link DEFAULT_WEEK_STARTS_ON}. */
		weekStartsOn?: number;
		/** BCP 47 locale for the month, weekday and day names; pass it so server and browser agree. */
		locale?: string;
		/** Names the whole calendar, e.g. "Stay dates". */
		label: string;
		/** Level of each month's heading; resolved from the surrounding heading scope when unset. */
		headingLevel?: Heading.Level;
		/** Words read to assistive technology. */
		labels: Labels;
	}
}

/**
 * Renders `months` month grids from `month`, each day a link to `href`'s URL for the selection
 * a click makes: with no start, or both ends set, the day becomes a new start; with only a start,
 * a later day becomes the end and an earlier or equal one the new start. Single mode links each day
 * as `{ start: day }`. Unavailable days, days outside `min`–`max`, and, while a start waits for its
 * end, days past the first unavailable day after it render as plain text.
 *
 * @example
 * <RangeMonths
 * 	label={t("stay.dates")}
 * 	labels={{ previous: t("calendar.previous"), next: t("calendar.next"), start: t("stay.checkIn"), end: t("stay.checkOut") }}
 * 	locale={locale}
 * 	month="2026-03"
 * 	start={query.checkIn}
 * 	end={query.checkOut}
 * 	today="2026-03-02"
 * 	min="2026-03-02"
 * 	isUnavailable={(date) => booked.has(date)}
 * 	dayNote={(date) => `$${prices[date]}`}
 * 	href={(next) => `?${new URLSearchParams({ ...next })}`}
 * />
 * @example
 * <RangeMonths single months={1} label={t("jump")} labels={labels} month="2026-03" start={day} today={today} href={({ start, month }) => `/day/${start ?? month}`} />
 */
export function RangeMonths(handle: Handle<RangeMonths.Props>) {
	return () => {
		let {
			month,
			months,
			start,
			end,
			single = false,
			today,
			min,
			max,
			isUnavailable,
			href,
			dayNote,
			weekStartsOn,
			locale,
			label,
			headingLevel,
			labels,
			mix,
			...rest
		} = handle.props;
		let firstWeekday = weekStartsOn ?? DEFAULT_WEEK_STARTS_ON;
		let shown = Array.from({ length: Math.max(1, months ?? DEFAULT_MONTHS) }, (_, index) =>
			shiftMonth(month, index),
		);
		let lastShown = shown[shown.length - 1] ?? month;
		let selection: DaySelection = { start, end: single ? undefined : end, single };
		let block =
			!single && start !== undefined && end === undefined
				? firstUnavailableAfter(start, `${lastShown}-31`, isUnavailable)
				: undefined;
		let previousMonth = shiftMonth(month, -1);
		let showPrevious = min === undefined || previousMonth >= min.slice(0, 7);
		let showNext = max === undefined || lastShown < max.slice(0, 7);
		let monthName = new Intl.DateTimeFormat(locale, {
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		});
		let dayName = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
		let weekdayName = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
		let weekdays = Array.from({ length: 7 }, (_, index) =>
			weekdayName.format(weekdayTime(firstWeekday, index)),
		);

		/** The URL a day link points at, following the click rules in {@link RangeMonths}. */
		function dayHref(date: string): string {
			return href(withMonth(nextSelection(date, selection), month));
		}

		/** Whether a click on `date` may produce a selection at all. */
		function isSelectable(date: string): boolean {
			if (min !== undefined && date < min) return false;
			if (max !== undefined && date > max) return false;
			if (isUnavailable?.(date)) return false;
			return block === undefined || date < block;
		}

		return (
			<div
				role="group"
				aria-label={label}
				{...rest}
				data-slot="range-months"
				mix={mergeMix(
					[
						raw({
							"--ui-range-months-cell": "max(2.5rem, var(--ui-target-size, 0px))",
							position: "relative",
							fontVariantNumeric: "tabular-nums",
							[`& [data-pending]${ACTIVE}, & td[data-pending]:has(~ td[data-pending]${ACTIVE}), & tr:has(~ tr td[data-pending]${ACTIVE}) td[data-pending], & [data-slot=range-months-month]:has(~ [data-slot=range-months-month] td[data-pending]${ACTIVE}) td[data-pending]`]:
								{ backgroundColor: PREVIEW },
							[`&:has(td[data-pending]${ACTIVE}) td[data-range=only]:not(:last-child)`]: {
								background: `linear-gradient(to right, transparent 50%, ${PREVIEW} 50%)`,
							},
							[`&:has(td[data-pending]${ACTIVE}) td[data-range=only]:not(:last-child):dir(rtl)`]: {
								background: `linear-gradient(to left, transparent 50%, ${PREVIEW} 50%)`,
							},
						}),
					],
					mix,
				)}
			>
				{showPrevious ? (
					<a
						href={href(withMonth({ start, end: selection.end }, previousMonth))}
						aria-label={labels.previous}
						data-slot="range-months-previous"
						mix={[navLinkStyle("start")]}
					>
						<ChevronLeftIcon aria-hidden="true" />
					</a>
				) : null}
				{showNext ? (
					<a
						href={href(withMonth({ start, end: selection.end }, shiftMonth(month, 1)))}
						aria-label={labels.next}
						data-slot="range-months-next"
						mix={[navLinkStyle("end")]}
					>
						<ChevronRightIcon aria-hidden="true" />
					</a>
				) : null}
				<div
					data-slot="range-months-months"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, calc(7 * ${CELL})), calc(7 * ${CELL})))`,
							justifyContent: "start",
							columnGap: "2rem",
							rowGap: "1.5rem",
						}),
					]}
				>
					{shown.map((key) => {
						let monthLabel = monthName.format(dayTime(key));
						return (
							<section key={key} data-slot="range-months-month" data-month={key}>
								<Calendar.Header
									mix={[raw({ minBlockSize: NAV, marginBlockEnd: "0.5rem", paddingInline: NAV })]}
								>
									<Calendar.Heading level={headingLevel}>{monthLabel}</Calendar.Heading>
								</Calendar.Header>
								<Calendar.Grid
									aria-label={monthLabel}
									mix={[borderSpacing("0"), raw({ inlineSize: "100%", tableLayout: "fixed" })]}
								>
									<Calendar.GridHeader>
										<Calendar.Row>
											{weekdays.map((weekday) => (
												<Calendar.HeaderCell key={weekday}>{weekday}</Calendar.HeaderCell>
											))}
										</Calendar.Row>
									</Calendar.GridHeader>
									<Calendar.GridBody>
										{monthWeeks(key, firstWeekday).map((week, row) => (
											<Calendar.Row key={`${key}-${row}`}>
												{week.map((date, column) => {
													if (date === null) {
														return (
															<td key={`${key}-${row}-${column}`} data-slot="range-months-blank" />
														);
													}
													let position = rangePosition(date, selection);
													let unavailable = isUnavailable?.(date) ?? false;
													let selectable = isSelectable(date);
													let pending =
														selectable &&
														!single &&
														start !== undefined &&
														end === undefined &&
														date > start;
													let note = dayNote === undefined ? undefined : dayNote(date);
													let stateLabel = dayStateLabel(position, single, labels);
													return (
														<td
															key={date}
															data-slot="range-months-day"
															data-range={position}
															data-pending={pending ? "" : undefined}
															data-unavailable={unavailable ? "" : undefined}
															aria-disabled={selectable ? undefined : "true"}
															mix={[dayCellStyle()]}
														>
															<RangeMonthsDay
																date={date}
																href={selectable ? dayHref(date) : undefined}
																label={
																	stateLabel === undefined
																		? dayName.format(dayTime(date))
																		: `${dayName.format(dayTime(date))}, ${stateLabel}`
																}
																today={date === today}
																note={note}
																hasNotes={dayNote !== undefined}
															/>
														</td>
													);
												})}
											</Calendar.Row>
										))}
									</Calendar.GridBody>
								</Calendar.Grid>
							</section>
						);
					})}
				</div>
			</div>
		);
	};
}

/** Props of {@link RangeMonthsDay}. */
interface RangeMonthsDayProps {
	/** The day, `YYYY-MM-DD`; exposed on the focusable element for `calendarKeys()`. */
	date: string;
	/** Where a click goes; absent for a day that cannot be picked. */
	href?: string;
	/** The day's full spoken name, with its selection state. */
	label: string;
	/** Marks the day with `aria-current="date"`. */
	today: boolean;
	/** The caller's note under the number. */
	note: RemixNode;
	/** Reserves the note line on every day, so rows keep one height. */
	hasNotes: boolean;
}

/**
 * One day's content: a link when it can be picked, otherwise plain text, each holding the day
 * number and, when the calendar carries notes, the note line under it.
 */
function RangeMonthsDay(handle: Handle<RangeMonthsDayProps>) {
	return () => {
		let { date, href, label, today, note, hasNotes } = handle.props;
		let content = (
			<>
				<span data-slot="range-months-number">{Number(date.slice(8, 10))}</span>
				{hasNotes ? (
					<span
						data-slot="range-months-note"
						mix={[
							raw({
								minBlockSize: "1em",
								fontSize: "0.625rem",
								lineHeight: "1",
								color: "var(--ui-neutral-fg-muted)",
								"[data-range=start] &, [data-range=end] &, [data-range=only] &": {
									color: "inherit",
									opacity: "0.85",
								},
							}),
						]}
					>
						{note}
					</span>
				) : null}
			</>
		);
		let attributes = {
			[CALENDAR_DAY_DATE_ATTRIBUTE]: date,
			"aria-current": today ? ("date" as const) : undefined,
			"data-today": today ? "" : undefined,
		};
		if (href === undefined) {
			return (
				<span {...attributes} data-slot="range-months-day-text" mix={[dayContentStyle()]}>
					{content}
				</span>
			);
		}
		return (
			<a {...attributes} href={href} aria-label={label} mix={[dayContentStyle()]}>
				{content}
			</a>
		);
	};
}

/** Adds the first month on view to a selection, leaving out the ends that are unset. */
function withMonth(selection: Omit<RangeMonths.Next, "month">, month: string): RangeMonths.Next {
	let next: RangeMonths.Next = { month };
	if (selection.start !== undefined) next.start = selection.start;
	if (selection.end !== undefined) next.end = selection.end;
	return next;
}

/** The selection state appended to a day's spoken name, when the caller supplied its word. */
function dayStateLabel(
	position: RangePosition | undefined,
	single: boolean,
	words: RangeMonths.Labels,
): string | undefined {
	if (position === "only") return single ? words.selected : words.start;
	if (position === "start") return words.start;
	if (position === "end") return words.end;
	return undefined;
}

/**
 * A day's `<td>`: the band behind a chosen range, squared where it runs on and rounded where it
 * meets a week's edge, with the two ends' cells half-filled toward the days between.
 */
function dayCellStyle() {
	return raw({
		padding: "0",
		textAlign: "center",
		verticalAlign: "middle",
		"&[data-range=middle]": { backgroundColor: BAND },
		"&[data-range=middle]:first-child": {
			borderStartStartRadius: "9999px",
			borderEndStartRadius: "9999px",
		},
		"&[data-range=middle]:last-child": {
			borderStartEndRadius: "9999px",
			borderEndEndRadius: "9999px",
		},
		"&[data-range=start]:not(:last-child)": {
			background: `linear-gradient(to right, transparent 50%, ${BAND} 50%)`,
		},
		"&[data-range=end]:not(:first-child)": {
			background: `linear-gradient(to left, transparent 50%, ${BAND} 50%)`,
		},
		"&[data-range=start]:not(:last-child):dir(rtl)": {
			background: `linear-gradient(to left, transparent 50%, ${BAND} 50%)`,
		},
		"&[data-range=end]:not(:first-child):dir(rtl)": {
			background: `linear-gradient(to right, transparent 50%, ${BAND} 50%)`,
		},
	});
}

/**
 * A day's link or text: a round target at least {@link CELL} tall, solid at either end of the
 * range, muted and struck through when taken, faded when outside `min`–`max`, underlined for today.
 */
function dayContentStyle() {
	return raw({
		display: "grid",
		placeContent: "center",
		justifyItems: "center",
		gap: "0.125rem",
		inlineSize: "100%",
		minBlockSize: CELL,
		paddingBlock: "0.25rem",
		borderRadius: "9999px",
		color: "var(--ui-neutral-fg-emphasis)",
		fontSize: "0.875rem",
		lineHeight: "1.1",
		textDecoration: "none",
		outlineOffset: "-2px",
		"&:is(a):hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
		"&:is(a):focus-visible": { outline: "2px solid var(--ui-brand-ring)" },
		"[data-range=middle] &": { color: "var(--ui-brand-fg-emphasis)" },
		"[data-range=middle] &:is(a):hover, [data-pending] &:is(a):hover": {
			backgroundColor: "var(--ui-brand-bg-tint-pressed)",
		},
		"[data-range=start] &:is(a), [data-range=end] &:is(a), [data-range=only] &:is(a), [data-range=only] &":
			{
				backgroundColor: "var(--ui-brand-bg-solid)",
				color: "var(--ui-brand-fg-on-solid)",
			},
		"[aria-disabled=true] &": { color: "var(--ui-neutral-fg-muted)", opacity: "0.45" },
		"[data-unavailable] &": { opacity: "1" },
		"[data-unavailable] & [data-slot=range-months-number]": { textDecoration: "line-through" },
		"&[data-today] [data-slot=range-months-number]": {
			fontWeight: "700",
			textDecorationLine: "underline",
			textDecorationThickness: "2px",
			textUnderlineOffset: "3px",
		},
		"[data-unavailable] &[data-today] [data-slot=range-months-number]": {
			textDecorationLine: "underline line-through",
		},
	});
}

/**
 * A previous or next link: a round chevron button pinned to the heading row's `side`, so the
 * pair flanks the first month's heading however the months wrap.
 */
function navLinkStyle(side: "start" | "end") {
	return raw({
		position: "absolute",
		insetBlockStart: "0",
		insetInlineStart: side === "start" ? "0" : "auto",
		insetInlineEnd: side === "end" ? "0" : "auto",
		zIndex: "1",
		display: "grid",
		placeItems: "center",
		inlineSize: NAV,
		blockSize: NAV,
		borderRadius: "9999px",
		color: "var(--ui-neutral-fg)",
		"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
		"&:focus-visible": { outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" },
		"& svg": { inlineSize: "1rem", blockSize: "1rem" },
		"&:dir(rtl) svg": { scale: "-1 1" },
	});
}
