/**
 * A calendar's month: weeks of day cells, all-day and multi-day events as bars across the days
 * they cover, timed events as a dot, a time and a title, and a "+N more" link where a day holds
 * more than fits. On a narrow container each day shows a row of dots instead of titles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import { Popover } from "../components/popover.js";

import { layoutSpanItems } from "./utils/time-grid-layout.js";

/** Milliseconds in a day, for walking the grid's dates. */
const DAY_MS = 86_400_000;

/** Container the view names, so its cells switch to dots when the view is narrow. */
const MONTH_CONTAINER = "ui-month-view";

/** Below this width each day shows dots rather than titles. */
const NARROW = `@container ${MONTH_CONTAINER} (width < 36rem)`;

/** How many entries a day shows before "+N more" when `max` is unset. */
const DEFAULT_MAX = 3;

/** Prop types for {@link MonthView}. */
export namespace MonthView {
	/** Every string the view shows; `{…}` marks where a value goes. */
	export interface Labels {
		/** The link to a day's hidden entries, such as "+{count} more". */
		more: string;
		/** A day's count for a screen reader, such as "{count} events". */
		count: string;
	}

	/** An event on the month. */
	export interface Event {
		id: string;
		/** Its first day, as `YYYY-MM-DD`. */
		start: string;
		/** Its last day, inclusive; a multi-day or all-day event draws as a bar. */
		end?: string;
		/** Draws it as a bar even on one day. */
		allDay?: boolean;
		title: string;
		/** Its start as the reader reads it, such as "9 AM"; shown before a timed event's title. */
		time?: string;
		/** Any CSS colour. */
		color?: string;
		href?: string;
		popover?: RemixNode;
		past?: boolean;
	}

	/** Props accepted by {@link MonthView}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Unique on the page; prefixes every popover id. */
		id: string;
		/** The month, as `YYYY-MM`. */
		month: string;
		events: Event[];
		/** Today, as `YYYY-MM-DD`. */
		today?: string;
		/** The day the page focuses on, as `YYYY-MM-DD`. */
		selected?: string;
		/** 0 for Sunday, 1 for Monday. @default 0 */
		weekStartsOn?: 0 | 1;
		/** Where a day's number and its "+N more" lead, such as its day view. */
		dayHref?: (date: string) => string;
		/** Entries a day shows before "+N more". @default 3 */
		max?: number;
		/** @default "en" */
		locale?: string;
		labels: Labels;
	}
}

/** A `YYYY-MM-DD` date as its UTC instant. */
function instantOf(date: string): number {
	return Date.parse(`${date}T00:00:00Z`);
}

/** A UTC instant as its `YYYY-MM-DD` date. */
function dateOf(instant: number): string {
	return new Date(instant).toISOString().slice(0, 10);
}

/** Every date the month's grid shows: whole weeks from the one holding the 1st to the last's. */
function gridWeeks(month: string, weekStartsOn: 0 | 1): string[][] {
	let first = instantOf(`${month}-01`);
	let year = Number(month.slice(0, 4));
	let index = Number(month.slice(5, 7));
	let last = Date.UTC(year, index, 0);
	let start = first - ((new Date(first).getUTCDay() - weekStartsOn + 7) % 7) * DAY_MS;
	let weeks: string[][] = [];
	for (let cursor = start; cursor <= last; cursor += 7 * DAY_MS) {
		weeks.push(Array.from({ length: 7 }, (_, day) => dateOf(cursor + day * DAY_MS)));
	}
	return weeks;
}

/** Whether an event draws as a bar rather than a dotted line. */
function isBar(event: MonthView.Event): boolean {
	return event.allDay === true || (event.end !== undefined && event.end > event.start);
}

/** The face of an entry: a popover button, a link, or plain text. */
function Entry(
	handle: Handle<{ id: string; event: MonthView.Event; bar: boolean; label: string }>,
) {
	return () => {
		let { id, event, bar, label } = handle.props;
		let popoverId = event.popover === undefined ? undefined : `${id}-popover`;
		let style = `--ui-month-view-color: ${event.color ?? "var(--ui-brand-bg-solid)"}`;
		let past = event.past ? "" : undefined;
		let content = bar ? (
			<span
				mix={[
					raw({
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						fontWeight: "600",
					}),
				]}
			>
				{event.title}
			</span>
		) : (
			<>
				<span
					aria-hidden="true"
					mix={[
						raw({
							flex: "none",
							inlineSize: "0.4375rem",
							blockSize: "0.4375rem",
							borderRadius: "999px",
							backgroundColor: "var(--ui-month-view-color)",
						}),
					]}
				/>
				{event.time === undefined ? null : (
					<span
						mix={[
							raw({ flex: "none", color: "var(--ui-neutral-fg-muted)" }),
							when(NARROW, raw({ display: "none" })),
						]}
					>
						{event.time}
					</span>
				)}
				<span
					mix={[
						raw({
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							fontWeight: "500",
						}),
						when(NARROW, visuallyHidden()),
					]}
				>
					{event.title}
				</span>
			</>
		);
		let mix = [
			raw({
				all: "unset",
				boxSizing: "border-box",
				display: "flex",
				alignItems: "center",
				gap: "0.3125rem",
				inlineSize: "100%",
				minInlineSize: "0",
				blockSize: "1.375rem",
				paddingInline: "0.375rem",
				borderRadius: "0.3125rem",
				fontSize: "0.75rem",
				lineHeight: "1rem",
				cursor: "pointer",
				color: "var(--ui-neutral-fg-emphasis)",
				"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint)" },
				"&:focus-visible": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
				"&[data-past]": { opacity: "0.62" },
			}),
			bar
				? raw({
						backgroundColor:
							"color-mix(in oklch, var(--ui-month-view-color) 16%, var(--ui-bg, Canvas))",
						color:
							"color-mix(in oklch, var(--ui-month-view-color) 45%, var(--ui-neutral-fg-emphasis, CanvasText))",
						boxShadow: "inset 3px 0 0 var(--ui-month-view-color)",
						"&:hover": {
							backgroundColor:
								"color-mix(in oklch, var(--ui-month-view-color) 24%, var(--ui-bg, Canvas))",
						},
					})
				: when(NARROW, raw({ inlineSize: "auto", paddingInline: "0.125rem" })),
		];
		if (popoverId !== undefined)
			return (
				<>
					<button
						type="button"
						popovertarget={popoverId}
						aria-label={label}
						style={style}
						data-past={past}
						data-slot="month-view-entry"
						mix={mix}
					>
						{content}
					</button>
					<Popover id={popoverId} placement="right-start">
						{event.popover}
					</Popover>
				</>
			);
		if (event.href !== undefined)
			return (
				<a
					href={event.href}
					aria-label={label}
					style={style}
					data-past={past}
					data-slot="month-view-entry"
					mix={mix}
				>
					{content}
				</a>
			);
		return (
			<span
				aria-label={label}
				role="img"
				style={style}
				data-past={past}
				data-slot="month-view-entry"
				mix={mix}
			>
				{content}
			</span>
		);
	};
}

/**
 * Renders the month: a header of weekday names over one grid per week. Bars take the week's top
 * rows, stacked so none overlap, and each day lists its timed events under them until `max`,
 * where a "+N more" link to the day takes over.
 *
 * @example
 * <MonthView id="nov" month="2026-11" today="2026-11-18" labels={{ more: "+{count} more", count: "{count} events" }}
 * 	events={[{ id: "e1", start: "2026-11-18", time: "9 AM", title: "Standup" }]} />
 */
export function MonthView(handle: Handle<MonthView.Props>) {
	return () => {
		let {
			id,
			month,
			events,
			today,
			selected,
			weekStartsOn = 0,
			dayHref,
			max = DEFAULT_MAX,
			locale = "en",
			labels,
			mix,
			...rest
		} = handle.props;
		let weeks = gridWeeks(month, weekStartsOn);
		let weekdayShort = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
		let weekdayNarrow = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
		let fullDay = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
		let monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
		let time = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

		return (
			<div
				{...rest}
				id={id}
				data-slot="month-view"
				mix={mergeMix(
					[
						raw({
							container: `${MONTH_CONTAINER} / inline-size`,
							display: "flex",
							flexDirection: "column",
							minInlineSize: "0",
							minBlockSize: "0",
							fontVariantNumeric: "tabular-nums",
						}),
					],
					mix,
				)}
			>
				<div
					aria-hidden="true"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					{(weeks[0] ?? []).map((date) => (
						<span
							mix={[
								raw({
									paddingBlock: "0.375rem",
									fontSize: "0.6875rem",
									fontWeight: "600",
									letterSpacing: "0.05em",
									textTransform: "uppercase",
									textAlign: "center",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							<span mix={[when(NARROW, raw({ display: "none" }))]}>
								{weekdayShort.format(new Date(instantOf(date)))}
							</span>
							<span mix={[raw({ display: "none" }), when(NARROW, raw({ display: "inline" }))]}>
								{weekdayNarrow.format(new Date(instantOf(date)))}
							</span>
						</span>
					))}
				</div>
				<ol
					data-slot="month-view-weeks"
					mix={[
						raw({
							flex: "1 1 auto",
							display: "grid",
							gridAutoRows: "minmax(6.5rem, 1fr)",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
						when(NARROW, raw({ gridAutoRows: "minmax(3.25rem, 1fr)" })),
					]}
				>
					{weeks.map((week) => {
						let weekStart = week[0]!;
						let weekEnd = week[6]!;
						let bars = events
							.filter(
								(event) =>
									isBar(event) && event.start <= weekEnd && (event.end ?? event.start) >= weekStart,
							)
							.map((event) => ({
								event,
								first: Math.max(0, week.indexOf(event.start)),
								last: week.includes(event.end ?? event.start)
									? week.indexOf(event.end ?? event.start)
									: 6,
							}))
							.map((entry) => ({
								...entry,
								first: entry.event.start < weekStart ? 0 : entry.first,
							}));
						let lane = layoutSpanItems(
							bars.map((entry) => ({ id: entry.event.id, first: entry.first, last: entry.last })),
						);
						let shownRows = Math.min(lane.count, max);
						return (
							<li
								data-slot="month-view-week"
								mix={[
									raw({
										position: "relative",
										display: "grid",
										gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
										gridTemplateRows:
											shownRows === 0 ? "auto 1fr" : `auto repeat(${shownRows}, auto) 1fr`,
										alignContent: "start",
										rowGap: "0.125rem",
										paddingBlockEnd: "0.25rem",
										borderBlockEnd: "1px solid var(--ui-neutral-border)",
										minBlockSize: "0",
									}),
								]}
							>
								{week.map((date, column) => {
									let outside = !date.startsWith(month);
									let isToday = date === today;
									let dayBars = bars.filter(
										(entry) => column >= entry.first && column <= entry.last,
									);
									let hiddenBars = dayBars.filter(
										(entry) => (lane.rows.get(entry.event.id) ?? 0) >= shownRows,
									);
									let timed = events
										.filter((event) => !isBar(event) && event.start === date)
										.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
									let room = Math.max(0, max - Math.min(dayBars.length, shownRows));
									let visible =
										timed.length + hiddenBars.length > room
											? timed.slice(0, Math.max(0, room - 1))
											: timed;
									let more = timed.length - visible.length + hiddenBars.length;
									let total = dayBars.length + timed.length;
									let first = new Date(instantOf(date)).getUTCDate() === 1;
									let number = new Date(instantOf(date)).getUTCDate();
									return (
										<>
											<span
												data-slot="month-view-day"
												data-date={date}
												data-outside={outside ? "" : undefined}
												data-today={isToday ? "" : undefined}
												data-selected={date === selected ? "" : undefined}
												mix={[
													raw({
														gridColumn: `${column + 1}`,
														gridRow: "1 / -1",
														borderInlineStart:
															column === 0 ? "none" : "1px solid var(--ui-neutral-border)",
														"&[data-outside]": {
															backgroundColor:
																"color-mix(in oklch, var(--ui-neutral-bg-tint) 60%, transparent)",
														},
														"&[data-selected]": {
															backgroundColor:
																"color-mix(in oklch, var(--ui-brand-bg-solid) 7%, transparent)",
														},
													}),
												]}
											/>
											<a
												href={dayHref?.(date)}
												aria-current={isToday ? "date" : undefined}
												data-slot="month-view-number"
												mix={[
													raw({
														gridColumn: `${column + 1}`,
														gridRow: "1",
														position: "relative",
														justifySelf: "start",
														display: "inline-flex",
														alignItems: "center",
														justifyContent: "center",
														minInlineSize: "1.625rem",
														blockSize: "1.625rem",
														margin: "0.25rem",
														paddingInline: "0.3125rem",
														boxSizing: "border-box",
														borderRadius: "999px",
														fontSize: "0.75rem",
														fontWeight: "600",
														color: "var(--ui-neutral-fg-emphasis)",
														textDecoration: "none",
														outline: "none",
														"[data-outside] + &": { color: "var(--ui-neutral-fg-muted)" },
														"&[href]:hover": { backgroundColor: "var(--ui-neutral-bg-tint)" },
														"&[aria-current='date']": {
															backgroundColor: "var(--ui-brand-bg-solid)",
															color: "var(--ui-brand-fg-on-solid, white)",
														},
														"&:focus-visible": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
													}),
													when(NARROW, raw({ justifySelf: "center", fontSize: "0.6875rem" })),
												]}
											>
												<span aria-hidden="true">
													{first
														? `${monthName.format(new Date(instantOf(date)))} ${number}`
														: number}
												</span>
												<span mix={[visuallyHidden()]}>
													{fullDay.format(new Date(instantOf(date)))}
													{total > 0 ? `, ${labels.count.replace("{count}", String(total))}` : ""}
												</span>
											</a>
											<div
												data-slot="month-view-entries"
												mix={[
													raw({
														gridColumn: `${column + 1}`,
														gridRow: `${shownRows + 2}`,
														display: "flex",
														flexDirection: "column",
														gap: "0.125rem",
														minInlineSize: "0",
														paddingInline: "0.25rem",
													}),
													when(
														NARROW,
														raw({
															flexDirection: "row",
															flexWrap: "wrap",
															justifyContent: "center",
															gap: "0",
														}),
													),
												]}
											>
												{visible.map((event) => (
													<Entry
														id={`${id}-${event.id}`}
														event={event}
														bar={false}
														label={[event.time, event.title].filter(Boolean).join(" ")}
													/>
												))}
												{more > 0 ? (
													<a
														href={dayHref?.(date)}
														data-slot="month-view-more"
														mix={[
															raw({
																alignSelf: "start",
																paddingInline: "0.375rem",
																fontSize: "0.75rem",
																fontWeight: "600",
																color: "var(--ui-neutral-fg-muted)",
																textDecoration: "none",
																borderRadius: "0.3125rem",
																"&:hover": {
																	color: "var(--ui-neutral-fg-emphasis)",
																	backgroundColor: "var(--ui-neutral-bg-tint)",
																},
															}),
															when(
																NARROW,
																raw({ fontSize: "0.625rem", paddingInline: "0.125rem" }),
															),
														]}
													>
														{labels.more.replace("{count}", String(more))}
													</a>
												) : null}
											</div>
										</>
									);
								})}
								{bars
									.filter((entry) => (lane.rows.get(entry.event.id) ?? 0) < shownRows)
									.map((entry) => (
										<div
											data-slot="month-view-bar"
											data-id={entry.event.id}
											data-past={entry.event.past ? "" : undefined}
											style={`--ui-month-view-color: ${entry.event.color ?? "var(--ui-brand-bg-solid)"}`}
											mix={[
												raw({
													gridColumn: `${entry.first + 1} / ${entry.last + 2}`,
													gridRow: `${(lane.rows.get(entry.event.id) ?? 0) + 2}`,
													position: "relative",
													minInlineSize: "0",
													paddingInline: "0.25rem",
													"&[data-past]": { opacity: "0.62" },
												}),
												when(
													NARROW,
													raw({ paddingInline: "0.0625rem", "& span": { fontSize: "0.625rem" } }),
												),
											]}
										>
											<Entry
												id={`${id}-${entry.event.id}-${weekStart}`}
												event={entry.event}
												bar
												label={`${entry.event.title}, ${time.format(new Date(instantOf(entry.event.start)))} – ${time.format(new Date(instantOf(entry.event.end ?? entry.event.start)))}`}
											/>
										</div>
									))}
							</li>
						);
					})}
				</ol>
			</div>
		);
	};
}
