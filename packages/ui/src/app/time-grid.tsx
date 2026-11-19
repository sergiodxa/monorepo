/**
 * A calendar's time grid: one column per day under a header of dates and a lane of all-day and
 * multi-day spans, hours down the side in one or more time zones, timed events placed by their
 * minutes with overlapping ones side by side, and a line at the present minute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { Popover } from "../components/popover.js";

import { timeGridDrag } from "./mixins/time-grid-drag.js";
import { layoutSpanItems, layoutTimedItems } from "./utils/time-grid-layout.js";

/** One hour's height, which every offset and length multiplies. */
const HOUR = "var(--ui-time-grid-hour, 3rem)";

/** The width of one time zone's column of hour labels. */
const GUTTER = "var(--ui-time-grid-gutter, 3.5rem)";

/** Minutes in a day, the column's full height. */
const DAY_MINUTES = 1440;

/** The snap every drag and keyboard move rounds to when `edit.step` is unset. */
const DEFAULT_STEP = 15;

/** Prop types for {@link TimeGrid}. */
export namespace TimeGrid {
	/** Every string the grid shows or announces; `{…}` marks where a value goes. */
	export interface Labels {
		/** The all-day lane's name, such as "All day". */
		allDay: string;
		/** The present-minute line's name, such as "Now". */
		now: string;
		/** What a move announces, such as "{title} moved to {time}". */
		moved: string;
		/** What a resize announces, such as "{title} now ends at {time}". */
		resized: string;
	}

	/** One day column. */
	export interface Day {
		/** The day, as `YYYY-MM-DD`. */
		date: string;
		/** The day's own view, which its header links to. */
		href?: string;
		/** Tints the column, such as a weekend or a holiday. */
		muted?: boolean;
	}

	/** One column of hour labels: the viewer's zone first, then any second zone. */
	export interface Zone {
		/** The zone's short name over its column, such as "EST". */
		label: string;
		/** The label beside each hour of the grid's days, 24 of them, such as "9 AM". */
		hours: string[];
	}

	/** A timed event, or the part of one that falls on a single day. */
	export interface Event {
		/** Unique on the grid; a move posts it. */
		id: string;
		/** The day it falls on, as `YYYY-MM-DD`. */
		date: string;
		/** Minutes from the day's start. */
		start: number;
		/** Minutes from the day's start; up to 1440. */
		end: number;
		title: string;
		/** Its times as the reader reads them, such as "9:00 – 10:30 AM". */
		time?: string;
		/** A line under the title, such as the place. */
		detail?: RemixNode;
		/** Any CSS colour; the block tints itself from it. */
		color?: string;
		/** Opens in a popover anchored to the block; without it, `href` makes the block a link. */
		popover?: RemixNode;
		href?: string;
		/** Lets a drag or the keyboard move and resize it. */
		editable?: boolean;
		/** Draws it hatched, for an invitation not yet answered. */
		tentative?: boolean;
		/** Dims it, for an event already over. */
		past?: boolean;
	}

	/** An all-day or multi-day event in the top lane. */
	export interface Span {
		id: string;
		/** Its first day, as `YYYY-MM-DD`; it may start before the grid's first day. */
		start: string;
		/** Its last day, inclusive, as `YYYY-MM-DD`. */
		end: string;
		title: string;
		color?: string;
		popover?: RemixNode;
		href?: string;
	}

	/** A form a drag or a key press posts: where, into which frame, with which fields. */
	export interface Form {
		action: string;
		/** `get` for a create that opens a form rather than saving. @default "post" */
		method?: "get" | "post";
		/** The named frame the answer loads into. */
		target?: string;
		/** Hidden fields sent with every submission, such as the page to return to. */
		fields?: Record<string, string>;
	}

	/**
	 * What dragging and the keyboard can change. Each submission adds `date` (`YYYY-MM-DD`),
	 * `start` and `end` (minutes from the day's start), and a move or resize adds `id`.
	 */
	export interface Edit {
		/** Posted when a drag across empty time ends. */
		create?: Form;
		/** Posted when an editable event is dragged, resized, or moved by key. */
		move?: Form;
		/** The minutes every change snaps to. @default 15 */
		step?: number;
	}

	/** Props accepted by {@link TimeGrid}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The grid's accessible name, such as "Week of November 16". */
		label: string;
		/** Unique on the page; prefixes every event's popover id. */
		id: string;
		days: Day[];
		events: Event[];
		spans?: Span[];
		/** The viewer's zone, then any second zone, as columns of hour labels. */
		zones: Zone[];
		/** Today, as `YYYY-MM-DD`; its header is marked. */
		today?: string;
		/**
		 * The present: the day, its minute, and the instant it was read, so the line moves on as
		 * time passes and a cached page still draws it where the clock is.
		 */
		now?: { date: string; minute: number; at: number };
		/** The minutes outside it are shaded, such as `{ start: 540, end: 1080 }`. */
		workday?: { start: number; end: number };
		/** The minute the grid opens scrolled to. @default 480 */
		scrollTo?: number;
		/** Formats the day headers and the times a change announces. @default "en" */
		locale?: string;
		edit?: Edit;
		labels: Labels;
	}
}

/**
 * Client island: an invisible marker carrying the grid's opening scroll, its moving now line
 * and, when the grid can be edited, its drags and keyboard moves. Loads from
 * `@sdxc/ui/app/time-grid#TimeGridBehavior`.
 */
export const TimeGridBehavior: EntryComponent<TimeGridBehaviorProps> = clientEntry(
	"@sdxc/ui/app/time-grid#TimeGridBehavior",
	function TimeGridBehavior(handle) {
		return () => (
			<span
				hidden
				data-slot="time-grid-behavior"
				mix={[timeGridDrag({ moved: handle.props.moved, resized: handle.props.resized })]}
			/>
		);
	},
);

/**
 * Props {@link TimeGridBehavior} serializes into the page, which is why they are a `type`:
 * `SerializableProps` rejects an interface.
 */
export type TimeGridBehaviorProps = {
	/** What a keyboard move announces. */
	moved: string;
	/** What a keyboard resize announces. */
	resized: string;
};

/** Days between two `YYYY-MM-DD` dates, read as UTC so no zone shifts a day. */
function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** A length in minutes as a CSS length on the grid's hour scale. */
function minutes(value: number): string {
	return `calc(${HOUR} * ${value / 60})`;
}

/** The colour token an event or span tints itself from. */
function tint(color: string | undefined): string {
	return `--ui-time-grid-color: ${color ?? "var(--ui-brand-bg-solid)"}`;
}

/** An event's or span's look: a soft fill of its colour, an edge of it, and readable ink. */
const BLOCK = raw({
	boxSizing: "border-box",
	borderRadius: "0.375rem",
	backgroundColor: "color-mix(in oklch, var(--ui-time-grid-color) 20%, var(--ui-bg, Canvas))",
	color:
		"color-mix(in oklch, var(--ui-time-grid-color) 55%, var(--ui-neutral-fg-emphasis, CanvasText))",
	boxShadow: "inset 3px 0 0 var(--ui-time-grid-color), 0 0 0 1px var(--ui-bg, Canvas)",
	"&[data-tentative]": {
		backgroundImage:
			"repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in oklch, var(--ui-time-grid-color) 14%, transparent) 5px 10px)",
		backgroundColor: "var(--ui-bg, Canvas)",
	},
	"&[data-past]": { opacity: "0.62" },
});

/** The clickable face of an event or span: the button opening its popover, or its link. */
function Trigger(
	handle: Handle<{
		id: string;
		popoverId?: string;
		href?: string;
		label: string;
		children: RemixNode;
	}>,
) {
	return () => {
		let { id, popoverId, href, label, children } = handle.props;
		let mix = [
			raw({
				all: "unset",
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				gap: "0.0625rem",
				inlineSize: "100%",
				blockSize: "100%",
				paddingBlock: "0.1875rem",
				paddingInline: "0.5rem 0.375rem",
				overflow: "hidden",
				cursor: "pointer",
				borderRadius: "inherit",
				fontSize: "0.75rem",
				lineHeight: "1rem",
				textAlign: "start",
				color: "inherit",
				textDecoration: "none",
				"&:focus-visible": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
			}),
		];
		if (popoverId !== undefined)
			return (
				<button
					type="button"
					id={id}
					popovertarget={popoverId}
					aria-label={label}
					data-slot="time-grid-trigger"
					mix={mix}
				>
					{children}
				</button>
			);
		if (href !== undefined)
			return (
				<a id={id} href={href} aria-label={label} data-slot="time-grid-trigger" mix={mix}>
					{children}
				</a>
			);
		return (
			<span id={id} aria-label={label} role="img" data-slot="time-grid-trigger" mix={mix}>
				{children}
			</span>
		);
	};
}

/**
 * Renders the grid: a header of day links over the all-day lane, then one scroller holding the
 * hour labels and the day columns. Each event is placed from its minutes, side by side with
 * those it overlaps; an editable one also takes a resize edge, and the forms `edit` names.
 *
 * @example
 * <TimeGrid id="week" label="Week of November 16" days={days} zones={zones} labels={labels}
 * 	events={[{ id: "e1", date: "2026-11-18", start: 540, end: 600, title: "Standup" }]} />
 */
export function TimeGrid(handle: Handle<TimeGrid.Props>) {
	return () => {
		let {
			id,
			label,
			days,
			events,
			spans = [],
			zones,
			today,
			now,
			workday,
			scrollTo = 480,
			locale = "en",
			edit,
			labels,
			mix,
			...rest
		} = handle.props;
		let step = edit?.step ?? DEFAULT_STEP;
		let columns = `repeat(${zones.length}, ${GUTTER}) repeat(${days.length}, minmax(0, 1fr))`;
		let weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
		let dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });
		let fullDay = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
		let first = days[0]?.date ?? "";
		let visibleSpans = spans
			.map((span) => ({
				span,
				first: Math.max(0, daysBetween(first, span.start)),
				last: Math.min(days.length - 1, daysBetween(first, span.end)),
			}))
			.filter((entry) => entry.first <= entry.last && entry.last >= 0);
		let lane = layoutSpanItems(
			visibleSpans.map((entry) => ({ id: entry.span.id, first: entry.first, last: entry.last })),
		);

		return (
			<div
				{...rest}
				id={id}
				role="group"
				aria-label={label}
				data-slot="time-grid"
				data-locale={locale}
				data-step={step}
				data-scroll-to={scrollTo}
				style={`--ui-time-grid-columns: ${columns}`}
				mix={mergeMix(
					[
						raw({
							display: "flex",
							flexDirection: "column",
							minInlineSize: "0",
							minBlockSize: "0",
							fontVariantNumeric: "tabular-nums",
							"&[data-dragging]": { userSelect: "none", cursor: "grabbing" },
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="time-grid-head"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "var(--ui-time-grid-columns)",
							overflow: "hidden",
							scrollbarGutter: "stable",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							flexShrink: "0",
						}),
					]}
				>
					{zones.map((zone, index) => (
						<span
							data-slot="time-grid-zone"
							mix={[
								raw({
									gridRow: "1",
									gridColumn: `${index + 1}`,
									alignSelf: "end",
									paddingInlineEnd: "0.5rem",
									paddingBlockEnd: "0.25rem",
									fontSize: "0.625rem",
									fontWeight: "600",
									letterSpacing: "0.04em",
									textAlign: "end",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{zone.label}
						</span>
					))}
					{days.map((day, index) => {
						let instant = new Date(`${day.date}T00:00:00Z`);
						let isToday = day.date === today;
						let content = (
							<>
								<span
									aria-hidden="true"
									mix={[
										raw({
											fontSize: "0.6875rem",
											fontWeight: "600",
											letterSpacing: "0.05em",
											textTransform: "uppercase",
											color: "var(--ui-neutral-fg-muted)",
										}),
										when("[data-today] > &", raw({ color: "var(--ui-brand-fg)" })),
									]}
								>
									{weekday.format(instant)}
								</span>
								<span
									aria-hidden="true"
									mix={[
										raw({
											display: "grid",
											placeItems: "center",
											minInlineSize: "2rem",
											blockSize: "2rem",
											paddingInline: "0.25rem",
											boxSizing: "border-box",
											borderRadius: "999px",
											fontSize: "1.125rem",
											fontWeight: "600",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
										when(
											"[data-today] > &",
											raw({
												backgroundColor: "var(--ui-brand-bg-solid)",
												color: "var(--ui-brand-fg-on-solid, white)",
											}),
										),
									]}
								>
									{dayNumber.format(instant)}
								</span>
								<span mix={[visuallyHidden()]}>{fullDay.format(instant)}</span>
							</>
						);
						let headMix = [
							raw({
								gridRow: "1",
								gridColumn: `${zones.length + index + 1}`,
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "0.125rem",
								paddingBlock: "0.375rem",
								borderRadius: "0.5rem",
								color: "inherit",
								textDecoration: "none",
								outline: "none",
							}),
							when("&[href]:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
							when("&:focus-visible", raw({ boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" })),
						];
						return day.href === undefined ? (
							<span
								data-slot="time-grid-day"
								data-today={isToday ? "" : undefined}
								aria-current={isToday ? "date" : undefined}
								mix={headMix}
							>
								{content}
							</span>
						) : (
							<a
								href={day.href}
								data-slot="time-grid-day"
								data-today={isToday ? "" : undefined}
								aria-current={isToday ? "date" : undefined}
								mix={headMix}
							>
								{content}
							</a>
						);
					})}
					<span
						data-slot="time-grid-lane-label"
						mix={[
							raw({
								gridRow: `2 / span ${Math.max(1, lane.count)}`,
								gridColumn: `1 / span ${zones.length}`,
								alignSelf: "start",
								paddingInlineEnd: "0.5rem",
								paddingBlock: "0.3125rem",
								fontSize: "0.625rem",
								fontWeight: "500",
								textAlign: "end",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{labels.allDay}
					</span>
					<span
						aria-hidden="true"
						mix={[
							raw({
								gridRow: `2 / span ${Math.max(1, lane.count)}`,
								gridColumn: `${zones.length + 1} / -1`,
								minBlockSize: "1.625rem",
								paddingBlockEnd: "0.25rem",
							}),
						]}
					/>
					{visibleSpans.map(({ span, first: from, last }) => {
						let popoverId =
							span.popover === undefined ? undefined : `${id}-span-${span.id}-popover`;
						let row = (lane.rows.get(span.id) ?? 0) + 2;
						return (
							<div
								data-slot="time-grid-span"
								data-id={span.id}
								data-continues-before={daysBetween(first, span.start) < 0 ? "" : undefined}
								style={tint(span.color)}
								mix={[
									BLOCK,
									raw({
										gridRow: `${row}`,
										gridColumn: `${zones.length + from + 1} / ${zones.length + last + 2}`,
										marginInline: "0.125rem",
										marginBlockEnd: "0.125rem",
										blockSize: "1.375rem",
										"&[data-continues-before]": {
											borderStartStartRadius: "0",
											borderEndStartRadius: "0",
										},
									}),
								]}
							>
								<Trigger
									id={`${id}-span-${span.id}`}
									popoverId={popoverId}
									href={span.href}
									label={span.title}
								>
									<span
										mix={[
											raw({
												fontWeight: "600",
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}),
										]}
									>
										{span.title}
									</span>
								</Trigger>
								{popoverId === undefined ? null : (
									<Popover id={popoverId} placement="bottom-start">
										{span.popover}
									</Popover>
								)}
							</div>
						);
					})}
				</div>
				<div
					data-slot="time-grid-body"
					mix={[
						raw({
							position: "relative",
							flex: "1 1 auto",
							minBlockSize: "0",
							overflowY: "auto",
							overflowX: "hidden",
							overscrollBehavior: "contain",
							scrollbarGutter: "stable",
						}),
					]}
				>
					<div
						data-slot="time-grid-canvas"
						mix={[
							raw({
								position: "relative",
								display: "grid",
								gridTemplateColumns: "var(--ui-time-grid-columns)",
								blockSize: `calc(${HOUR} * 24)`,
								paddingBlockStart: "0.5rem",
								boxSizing: "content-box",
							}),
						]}
					>
						{zones.map((zone, index) => (
							<div
								aria-hidden="true"
								data-slot="time-grid-hours"
								mix={[
									raw({
										position: "relative",
										gridColumn: `${index + 1}`,
										gridRow: "1",
										color: "var(--ui-neutral-fg-muted)",
									}),
									when("&:not(:first-child)", raw({ opacity: "0.72" })),
								]}
							>
								{zone.hours.map((hour, at) =>
									at === 0 ? null : (
										<span
											style={`top: ${minutes(at * 60)}`}
											mix={[
												raw({
													position: "absolute",
													insetInlineEnd: "0.5rem",
													transform: "translateY(-50%)",
													fontSize: "0.6875rem",
													lineHeight: "1",
													whiteSpace: "nowrap",
												}),
											]}
										>
											{hour}
										</span>
									),
								)}
							</div>
						))}
						{days.map((day, index) => {
							let dayEvents = events.filter((event) => event.date === day.date);
							let placements = layoutTimedItems(dayEvents);
							let nowHere = now !== undefined && now.date === day.date ? now : undefined;
							return (
								<section
									aria-label={fullDay.format(new Date(`${day.date}T00:00:00Z`))}
									data-slot="time-grid-column"
									data-date={day.date}
									data-muted={day.muted ? "" : undefined}
									style={
										workday === undefined
											? undefined
											: `--ui-time-grid-work-start: ${minutes(workday.start)}; --ui-time-grid-work-end: ${minutes(workday.end)}`
									}
									mix={[
										raw({
											position: "relative",
											gridColumn: `${zones.length + index + 1}`,
											gridRow: "1",
											borderInlineStart: "1px solid var(--ui-neutral-border)",
											backgroundImage: `repeating-linear-gradient(to bottom, var(--ui-neutral-border) 0 1px, transparent 1px ${HOUR})`,
											"&[data-muted]": {
												backgroundColor:
													"color-mix(in oklch, var(--ui-neutral-bg-tint) 55%, transparent)",
											},
											"--ui-time-grid-off-hours":
												"color-mix(in oklch, var(--ui-color-neutral-950, black) 6%, transparent)",
											"&[style*='work-start']::before": {
												content: "''",
												position: "absolute",
												inset: "0",
												pointerEvents: "none",
												background:
													"linear-gradient(to bottom, var(--ui-time-grid-off-hours) var(--ui-time-grid-work-start), transparent var(--ui-time-grid-work-start) var(--ui-time-grid-work-end), var(--ui-time-grid-off-hours) var(--ui-time-grid-work-end))",
											},
										}),
									]}
								>
									{dayEvents.map((event) => (
										<EventBlock
											id={id}
											event={event}
											place={placements.get(event.id) ?? { column: 0, columns: 1, span: 1 }}
											movable={edit?.move !== undefined}
										/>
									))}
									{nowHere === undefined ? null : (
										<div
											role="img"
											aria-label={labels.now}
											data-slot="time-grid-now"
											data-minute={nowHere.minute}
											data-at={nowHere.at}
											style={`top: ${minutes(nowHere.minute)}`}
											mix={[
												raw({
													position: "absolute",
													insetInline: "0",
													zIndex: "4",
													blockSize: "2px",
													marginBlockStart: "-1px",
													pointerEvents: "none",
													backgroundColor:
														"var(--ui-time-grid-now, var(--ui-danger-bg-solid, crimson))",
													"&::before": {
														content: "''",
														position: "absolute",
														insetInlineStart: "-0.3125rem",
														insetBlockStart: "-0.25rem",
														inlineSize: "0.625rem",
														blockSize: "0.625rem",
														borderRadius: "999px",
														backgroundColor: "inherit",
													},
												}),
											]}
										/>
									)}
								</section>
							);
						})}
					</div>
				</div>
				{edit?.create ? <EditForm kind="create" form={edit.create} /> : null}
				{edit?.move ? <EditForm kind="move" form={edit.move} /> : null}
				<span
					role="status"
					aria-live="polite"
					data-slot="time-grid-status"
					mix={[visuallyHidden()]}
				/>
				<TimeGridBehavior moved={labels.moved} resized={labels.resized} />
			</div>
		);
	};
}

/** One timed event on its day column, placed from its minutes and its overlap columns. */
function EventBlock(
	handle: Handle<{
		/** The grid's id, which prefixes the block's trigger and popover ids. */
		id: string;
		event: TimeGrid.Event;
		place: { column: number; columns: number; span: number };
		/** Whether the grid has a move form, without which no block is editable. */
		movable: boolean;
	}>,
) {
	return () => {
		let { id, event, place, movable } = handle.props;
		let short = event.end - event.start < 45;
		let popoverId = event.popover === undefined ? undefined : `${id}-event-${event.id}-popover`;
		let left = (place.column / place.columns) * 100;
		let width = (place.span / place.columns) * 100;
		return (
			<div
				data-slot="time-grid-event"
				data-id={event.id}
				data-start={event.start}
				data-end={event.end}
				data-title={event.title}
				data-editable={event.editable && movable ? "" : undefined}
				data-tentative={event.tentative ? "" : undefined}
				data-past={event.past ? "" : undefined}
				data-short={short ? "" : undefined}
				style={`${tint(event.color)}; top: ${minutes(event.start)}; height: max(1.25rem, ${minutes(Math.min(DAY_MINUTES, event.end) - event.start)}); left: calc(${left}% + 1px); width: calc(${width}% - 3px)`}
				mix={[
					BLOCK,
					raw({
						position: "absolute",
						zIndex: "1",
						transition: "box-shadow 120ms, opacity 120ms",
						"&:hover": {
							backgroundColor:
								"color-mix(in oklch, var(--ui-time-grid-color) 28%, var(--ui-bg, Canvas))",
						},
						"&[data-editable]": { touchAction: "pan-y" },
						"&[data-dragging]": {
							opacity: "0.35",
						},
						"&[data-preview]": {
							zIndex: "3",
							opacity: "1",
							boxShadow:
								"inset 3px 0 0 var(--ui-time-grid-color), 0 8px 24px -8px color-mix(in oklch, var(--ui-time-grid-color) 50%, transparent)",
						},
						"&:has(:popover-open)": { zIndex: "2" },
					}),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				<Trigger
					id={`${id}-event-${event.id}`}
					popoverId={popoverId}
					href={event.href}
					label={[event.title, event.time].filter(Boolean).join(", ")}
				>
					<span
						aria-hidden="true"
						data-slot="time-grid-title"
						mix={[
							raw({
								fontWeight: "600",
								overflow: "hidden",
								textOverflow: "ellipsis",
								"[data-short] &": { whiteSpace: "nowrap" },
							}),
						]}
					>
						{event.title}
						{short && event.time !== undefined ? (
							<span mix={[raw({ fontWeight: "400", opacity: "0.8" })]}>{`, ${event.time}`}</span>
						) : null}
					</span>
					{short || event.time === undefined ? null : (
						<span
							aria-hidden="true"
							data-slot="time-grid-time"
							mix={[raw({ opacity: "0.8", whiteSpace: "nowrap" })]}
						>
							{event.time}
						</span>
					)}
					{short || event.detail === undefined ? null : (
						<span
							aria-hidden="true"
							mix={[
								raw({
									opacity: "0.8",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}),
							]}
						>
							{event.detail}
						</span>
					)}
				</Trigger>
				{event.editable && movable ? (
					<span
						aria-hidden="true"
						data-slot="time-grid-resize"
						mix={[
							raw({
								position: "absolute",
								insetInline: "0.25rem",
								insetBlockEnd: "0",
								blockSize: "0.5rem",
								cursor: "ns-resize",
								touchAction: "none",
								"&::after": {
									content: "''",
									position: "absolute",
									insetInlineStart: "50%",
									insetBlockEnd: "0.125rem",
									inlineSize: "1rem",
									blockSize: "0.1875rem",
									marginInlineStart: "-0.5rem",
									borderRadius: "999px",
									backgroundColor: "currentColor",
									opacity: "0",
									transition: "opacity 120ms",
								},
								"[data-slot='time-grid-event']:hover > &::after": { opacity: "0.45" },
							}),
						]}
					/>
				) : null}
				{popoverId === undefined ? null : (
					<Popover id={popoverId} placement="right-start">
						{event.popover}
					</Popover>
				)}
			</div>
		);
	};
}

/** A hidden form a drag fills in and submits, carrying the consumer's own fields. */
function EditForm(handle: Handle<{ kind: "create" | "move"; form: TimeGrid.Form }>) {
	return () => {
		let { kind, form } = handle.props;
		return (
			<form
				hidden
				method={form.method ?? "post"}
				action={form.action}
				data-time-grid-form={kind}
				data-rmx-target={form.target}
			>
				{Object.entries(form.fields ?? {}).map(([name, value]) => (
					<input type="hidden" name={name} value={value} />
				))}
			</form>
		);
	};
}
