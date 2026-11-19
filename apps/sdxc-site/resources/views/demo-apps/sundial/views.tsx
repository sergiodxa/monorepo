/**
 * Sundial's calendar screens: a week (with a phone's three days under a strip of dates), three
 * days, one day, a month and an agenda. Each draws the visitor's events on their own clock and
 * gives every block its popover card, and the grids post drags and Alt+arrow moves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { Agenda } from "@sdxc/ui/schedule/agenda";
import { DayStrip } from "@sdxc/ui/schedule/day-strip";
import { MonthView } from "@sdxc/ui/schedule/month-view";
import { TimeGrid } from "@sdxc/ui/schedule/time-grid";
import { YearView } from "@sdxc/ui/schedule/year-view";

import type { Entry } from "./model";
import type { Instance } from "./time";

import { LOCALE, actionHref, href, mondayOf, shiftDate } from "./data";
import { EventCard } from "./event";
import { eventColor, isEditable, locationOf, rsvpOf } from "./model";
import {
	clockAt,
	formatDay,
	formatTimes,
	hourLabels,
	inLane,
	instancesIn,
	laneDays,
	segmentsOf,
	zoneName,
} from "./time";

/** The calendar screens, by the path each lives at. */
export type ViewId = "week" | "days" | "day" | "month" | "year" | "agenda";

/** Every screen with a day in its address: the calendar views, Find a time, and Import and export. */
export type Screen = ViewId | "find" | "import";

/** Each view's path under the app; the week is the home screen. */
export const VIEW_PATHS: Record<ViewId, string> = {
	week: "",
	days: "days",
	day: "day",
	month: "month",
	year: "year",
	agenda: "agenda",
};

/** What every screen reads: who is looking, when, at which day, and their visible events. */
export interface ViewContext {
	view: Screen;
	/** The day the screen is set around, `YYYY-MM-DD` on the viewer's clock. */
	anchor: string;
	today: string;
	now: { date: string; minute: number; at: number };
	zone: string;
	second: string | null;
	/** The visitor's events on the calendars they show. */
	events: Entry[];
	/** The screen's own address, with its query, for forms to come back to. */
	back: string;
}

/** A screen's path under the app. */
function pathOf(view: Screen): string {
	return view === "find" || view === "import" ? view : VIEW_PATHS[view];
}

/** The address of a view at a day, with any extra query. */
export function viewHref(view: Screen, anchor: string, extra = ""): string {
	let path = pathOf(view);
	return href(`${path}?d=${anchor}${extra === "" ? "" : `&${extra}`}`);
}

/** The page path and query of a view, as a post's `back` field carries it. */
export function viewPage(view: Screen, anchor: string, extra = ""): string {
	let path = pathOf(view);
	return `${path}?d=${anchor}${extra === "" ? "" : `&${extra}`}`;
}

/** The days a view shows and how far its arrows move it. */
export function viewSpan(
	view: ViewId,
	anchor: string,
): { first: string; days: number; step: number } {
	if (view === "week") return { first: mondayOf(anchor), days: 7, step: 7 };
	if (view === "days") return { first: anchor, days: 3, step: 3 };
	if (view === "day") return { first: anchor, days: 1, step: 1 };
	if (view === "agenda") return { first: anchor, days: 14, step: 14 };
	if (view === "year") {
		let year = Number(anchor.slice(0, 4));
		let days = Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000);
		return { first: `${year}-01-01`, days, step: 0 };
	}
	let first = mondayOf(`${anchor.slice(0, 7)}-01`);
	return { first: shiftDate(first, -1), days: 42, step: 0 };
}

/** The strings every grid shows and announces. */
const GRID_LABELS: TimeGrid.Labels = {
	allDay: "All day",
	now: "Now",
	moved: "{title} moved to {time}",
	resized: "{title} now ends at {time}",
};

/** The address of the dialog editing an occurrence, from the screen it opens over. */
function editHref(context: ViewContext, instance: Instance): string {
	return href(`${context.back}&edit=${encodeURIComponent(instance.key)}`);
}

/** The card a block opens. */
function card(context: ViewContext, instance: Instance): RemixNode {
	return (
		<EventCard
			instance={instance}
			zone={context.zone}
			editHref={editHref(context, instance)}
			back={context.back}
		/>
	);
}

/** The hour columns: the viewer's zone, then the second one, each read on a reference day. */
function zoneColumns(context: ViewContext, days: string[], single: boolean): TimeGrid.Zone[] {
	let reference = days.includes(context.today) ? context.today : (days[0] ?? context.today);
	let zones = [context.zone, ...(context.second === null || single ? [] : [context.second])];
	return zones.map((zone) => ({
		label: zoneName(zone, reference),
		hours: hourLabels(reference, context.zone, zone),
	}));
}

namespace Grid {
	export interface Props {
		id: string;
		context: ViewContext;
		/** The first day and how many. */
		first: string;
		count: number;
		label: string;
		/** The view whose path a drag's create reloads. */
		view: ViewId;
		/** Leaves out the second zone, for a phone's narrow grid. */
		single?: boolean;
		/** Where a swipe left and right lead: the previous and next range. */
		pages: { previous: string; next: string };
	}
}

/** A time grid over some days: the lane of all-day events, the timed ones, and the now line. */
function Grid(handle: Handle<Grid.Props>) {
	return () => {
		let { id, context, first, count, label, view, single = false, pages } = handle.props;
		let days = Array.from({ length: count }, (_, index) => shiftDate(first, index));
		let instances = instancesIn(context.events, first, count, context.zone);
		let spans: TimeGrid.Span[] = instances.filter(inLane).map((instance) => {
			let range = laneDays(instance, context.zone);
			return {
				id: instance.key,
				start: range.first,
				end: range.last,
				title: instance.event.title ?? "",
				color: eventColor(instance),
				popover: card(context, instance),
			};
		});
		let events: TimeGrid.Event[] = instances
			.filter((instance) => !inLane(instance))
			.flatMap((instance) =>
				segmentsOf(instance, context.zone).map((segment) => ({ instance, segment })),
			)
			.filter(({ segment }) => days.includes(segment.date))
			.map(({ instance, segment }) => ({
				id: segment.id,
				date: segment.date,
				start: segment.start,
				end: segment.end,
				title: instance.event.title ?? "",
				time: formatTimes(instance, context.zone),
				detail: locationOf(instance.event),
				color: eventColor(instance),
				popover: card(context, instance),
				editable: isEditable(instance.calendar) && !segment.cut,
				tentative: rsvpOf(instance.event) === "pending" || rsvpOf(instance.event) === "maybe",
				past: instance.end.getTime() < context.now.at,
			}));
		return (
			<TimeGrid
				id={id}
				label={label}
				locale={LOCALE}
				days={days.map((date) => {
					let weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
					return { date, href: viewHref("day", date), muted: weekday === 0 || weekday === 6 };
				})}
				events={events}
				spans={spans}
				zones={zoneColumns(context, days, single)}
				today={context.today}
				now={context.now}
				workday={{ start: 540, end: 1080 }}
				scrollTo={450}
				edit={{
					create: { action: href(VIEW_PATHS[view]), method: "get", fields: { d: context.anchor } },
					move: { action: actionHref("move"), fields: { back: context.back } },
				}}
				pages={pages}
				labels={GRID_LABELS}
				mix={[raw({ flex: "1 1 auto", minBlockSize: "0" })]}
			/>
		);
	};
}

/** Days with something on them, for the strip's dots. */
function busyDays(context: ViewContext, first: string, count: number): Map<string, number> {
	let counts = new Map<string, number>();
	for (let instance of instancesIn(context.events, first, count, context.zone)) {
		let date = instance.days?.first ?? clockAt(instance.start.getTime(), context.zone).date;
		counts.set(date, (counts.get(date) ?? 0) + 1);
	}
	return counts;
}

/** A phone's strip of three weeks around the anchor, each day leading to that view. */
function Strip(handle: Handle<{ context: ViewContext; view: ViewId }>) {
	return () => {
		let { context, view } = handle.props;
		let first = shiftDate(mondayOf(context.anchor), -7);
		let counts = busyDays(context, first, 21);
		return (
			<DayStrip
				label={new Intl.DateTimeFormat(LOCALE, {
					month: "long",
					year: "numeric",
					timeZone: "UTC",
				}).format(Date.parse(`${context.anchor}T00:00:00Z`))}
				locale={LOCALE}
				today={context.today}
				mix={[raw({ flex: "none", borderBlockEnd: "1px solid var(--ui-neutral-border)" })]}
				days={Array.from({ length: 21 }, (_, index) => {
					let date = shiftDate(first, index);
					let count = counts.get(date) ?? 0;
					return {
						date,
						href: viewHref(view === "week" ? "days" : view, date),
						current: date === context.anchor,
						note:
							count === 0 ? undefined : (
								<span aria-hidden="true" mix={[raw({ display: "flex", gap: "2px" })]}>
									{Array.from({ length: Math.min(count, 3) }, () => (
										<span
											mix={[
												raw({
													inlineSize: "4px",
													blockSize: "4px",
													borderRadius: "999px",
													backgroundColor: "currentColor",
													opacity: "0.7",
												}),
											]}
										/>
									))}
								</span>
							),
						label: count === 0 ? undefined : `${count} ${count === 1 ? "event" : "events"}`,
					};
				})}
			/>
		);
	};
}

/** Fills the height the shell leaves, so the grid scrolls inside itself. */
const FILL = raw({
	display: "flex",
	flexDirection: "column",
	flex: "1 1 auto",
	minBlockSize: "0",
});

/**
 * The week: seven columns from Monday on a wide screen, and on a phone three days from the
 * anchor under a strip of dates, so the same address reads well at any width.
 */
export function WeekView(handle: Handle<{ context: ViewContext }>) {
	return () => {
		let { context } = handle.props;
		let monday = mondayOf(context.anchor);
		return (
			<>
				<div
					data-sundial-wide=""
					mix={[FILL, media("(max-width: 40rem)", raw({ display: "none" }))]}
				>
					<Grid
						id="sundial-week"
						context={context}
						first={monday}
						count={7}
						label={`Week of ${formatDay(monday)}`}
						view="week"
						pages={{
							previous: viewHref("week", shiftDate(context.anchor, -7)),
							next: viewHref("week", shiftDate(context.anchor, 7)),
						}}
					/>
				</div>
				<div
					data-sundial-phone=""
					mix={[raw({ display: "none" }), media("(max-width: 40rem)", FILL)]}
				>
					<Strip context={context} view="week" />
					<Grid
						id="sundial-phone"
						context={context}
						first={context.anchor}
						count={3}
						label={`Three days from ${formatDay(context.anchor)}`}
						view="days"
						single
						pages={{
							previous: viewHref("week", shiftDate(context.anchor, -3)),
							next: viewHref("week", shiftDate(context.anchor, 3)),
						}}
					/>
				</div>
			</>
		);
	};
}

/** Three days or one, with the strip above them on a phone. */
export function DaysView(handle: Handle<{ context: ViewContext; count: 1 | 3 }>) {
	return () => {
		let { context, count } = handle.props;
		let view: ViewId = count === 1 ? "day" : "days";
		return (
			<div mix={[FILL]}>
				<div
					mix={[raw({ display: "none" }), media("(max-width: 40rem)", raw({ display: "block" }))]}
				>
					<Strip context={context} view={view} />
				</div>
				<Grid
					id={`sundial-${view}`}
					context={context}
					first={context.anchor}
					count={count}
					label={
						count === 1 ? formatDay(context.anchor) : `Three days from ${formatDay(context.anchor)}`
					}
					view={view}
					pages={{
						previous: viewHref(view, shiftDate(context.anchor, -count)),
						next: viewHref(view, shiftDate(context.anchor, count)),
					}}
				/>
			</div>
		);
	};
}

/** A short start time for a month cell, such as "9:30a". */
function shortTime(instance: Instance, zone: string): string {
	return new Intl.DateTimeFormat(LOCALE, { hour: "numeric", minute: "2-digit", timeZone: zone })
		.format(instance.start)
		.replace(":00", "")
		.replace(" AM", "a")
		.replace(" PM", "p");
}

/** The month that starts `count` months after the one holding `date`, as `YYYY-MM`. */
function monthAfter(date: string, count: number): string {
	let [year = 2026, month = 1] = date.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1 + count, 1)).toISOString().slice(0, 7);
}

/** One month's events, as `MonthView` draws them. */
function monthEvents(context: ViewContext, month: string): MonthView.Event[] {
	let span = viewSpan("month", `${month}-01`);
	return instancesIn(context.events, span.first, span.days, context.zone).map((instance) => {
		let lane = inLane(instance);
		let range = lane ? laneDays(instance, context.zone) : null;
		return {
			id: instance.key,
			start: range?.first ?? clockAt(instance.start.getTime(), context.zone).date,
			end: range?.last,
			allDay: lane,
			title: instance.event.title ?? "",
			time: lane ? undefined : shortTime(instance, context.zone),
			color: eventColor(instance),
			popover: card(context, instance),
			past: instance.end.getTime() < context.now.at,
		};
	});
}

/** How many months the month screen scrolls through: the anchor's, then the ones after it. */
const MONTHS_SHOWN = 3;

/**
 * The month: the anchor's month and the two after it in one continuous scroll, each under a
 * sticky name, beside the chosen day's events. Picking a day selects it in place; on a phone the
 * following months fold away and the chosen day's list sits under the grid.
 */
export function MonthScreen(handle: Handle<{ context: ViewContext }>) {
	return () => {
		let { context } = handle.props;
		let monthName = new Intl.DateTimeFormat(LOCALE, {
			month: "long",
			year: "numeric",
			timeZone: "UTC",
		});
		let chosen = instancesIn(context.events, context.anchor, 1, context.zone);
		return (
			<div
				data-slot="sundial-month"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr) 19rem",
						flex: "1 1 auto",
						minBlockSize: "0",
					}),
					media(
						"(max-width: 64rem)",
						raw({
							gridTemplateColumns: "minmax(0, 1fr)",
							alignContent: "start",
							overflowY: "auto",
						}),
					),
				]}
			>
				<div
					data-slot="sundial-months"
					mix={[
						raw({ overflowY: "auto", minBlockSize: "0", scrollSnapType: "y proximity" }),
						media("(max-width: 64rem)", raw({ overflowY: "visible", minBlockSize: "auto" })),
					]}
				>
					{Array.from({ length: MONTHS_SHOWN }, (_, index) => {
						let month = monthAfter(context.anchor, index);
						let name = monthName.format(Date.parse(`${month}-01T00:00:00Z`));
						return (
							<section
								aria-label={name}
								data-month={month}
								mix={[
									raw({ scrollSnapAlign: "start" }),
									index === 0 ? raw({}) : media("(max-width: 64rem)", raw({ display: "none" })),
								]}
							>
								<h2
									mix={[
										raw({
											position: "sticky",
											insetBlockStart: "0",
											zIndex: "2",
											margin: "0",
											padding: "0.625rem 0.75rem 0.375rem",
											fontSize: "0.9375rem",
											fontWeight: "650",
											color: "var(--ui-neutral-fg-emphasis)",
											backgroundColor: "var(--ui-bg, Canvas)",
										}),
									]}
								>
									{name}
								</h2>
								<MonthView
									id={`sundial-month-${month}`}
									month={month}
									weekStartsOn={1}
									locale={LOCALE}
									today={context.today}
									selected={context.anchor}
									events={monthEvents(context, month)}
									dayHref={(date) => viewHref("month", date)}
									max={4}
									labels={{ more: "+{count} more", count: "{count} events" }}
								/>
							</section>
						);
					})}
				</div>
				<aside
					aria-label={`Events on ${formatDay(context.anchor)}`}
					mix={[
						raw({
							overflowY: "auto",
							minBlockSize: "0",
							paddingInline: "0.5rem",
							borderInlineStart: "1px solid var(--ui-neutral-border)",
						}),
						media(
							"(max-width: 64rem)",
							raw({
								borderInlineStart: "none",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
								overflowY: "visible",
								minBlockSize: "auto",
							}),
						),
					]}
				>
					<Agenda
						id="sundial-month-day"
						label={`Events on ${formatDay(context.anchor)}`}
						days={[
							{
								date: context.anchor,
								href: viewHref("day", context.anchor),
								events: chosen.map((instance) => ({
									id: instance.key,
									title: instance.event.title ?? "",
									time: formatTimes(instance, context.zone),
									color: eventColor(instance),
									detail: locationOf(instance.event),
									popover: card(context, instance),
									past: instance.end.getTime() < context.now.at,
								})),
							},
						]}
						today={context.today}
						locale={LOCALE}
					/>
					{chosen.length === 0 ? (
						<p
							mix={[
								raw({
									margin: "0.5rem 0.75rem",
									fontSize: "0.875rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Nothing planned. Pick another day, or press C to add an event.
						</p>
					) : null}
				</aside>
			</div>
		);
	};
}

/** The year: twelve months whose dots weigh how busy each day is. */
export function YearScreen(handle: Handle<{ context: ViewContext }>) {
	return () => {
		let { context } = handle.props;
		let span = viewSpan("year", context.anchor);
		let counts: Record<string, number> = {};
		for (let instance of instancesIn(context.events, span.first, span.days, context.zone)) {
			if (instance.days) continue;
			let date = clockAt(instance.start.getTime(), context.zone).date;
			counts[date] = (counts[date] ?? 0) + 1;
		}
		return (
			<div
				mix={[
					raw({ flex: "1 1 auto", minBlockSize: "0", overflowY: "auto", padding: "1rem 1.25rem" }),
				]}
			>
				<YearView
					year={Number(context.anchor.slice(0, 4))}
					counts={counts}
					today={context.today}
					selected={context.anchor}
					weekStartsOn={1}
					locale={LOCALE}
					dayHref={(date) => viewHref("day", date)}
					monthHref={(month) => viewHref("month", `${month}-01`)}
					labels={{ count: "{count} events" }}
				/>
			</div>
		);
	};
}

/** Two weeks from the anchor, day by day, skipping the empty days. */
export function AgendaScreen(handle: Handle<{ context: ViewContext }>) {
	return () => {
		let { context } = handle.props;
		let instances = instancesIn(context.events, context.anchor, 14, context.zone);
		let byDay = new Map<string, Instance[]>();
		for (let instance of instances) {
			let first = instance.days?.first ?? clockAt(instance.start.getTime(), context.zone).date;
			let date = first < context.anchor ? context.anchor : first;
			byDay.set(date, [...(byDay.get(date) ?? []), instance]);
		}
		let days: Agenda.Day[] = [...byDay.keys()].sort().map((date) => ({
			date,
			href: viewHref("day", date),
			events: (byDay.get(date) ?? []).map((instance) => ({
				id: instance.key,
				title: instance.event.title ?? "",
				time: formatTimes(instance, context.zone),
				color: eventColor(instance),
				detail: locationOf(instance.event),
				popover: card(context, instance),
				tentative: rsvpOf(instance.event) === "pending" || rsvpOf(instance.event) === "maybe",
				past: instance.end.getTime() < context.now.at,
			})),
		}));
		return (
			<div
				mix={[
					raw({ flex: "1 1 auto", overflowY: "auto", minBlockSize: "0", paddingInline: "0.5rem" }),
				]}
			>
				<Agenda
					id="sundial-agenda"
					label={`Agenda from ${formatDay(context.anchor)}`}
					days={days}
					today={context.today}
					locale={LOCALE}
					empty={<p>Nothing planned for the next two weeks.</p>}
				/>
			</div>
		);
	};
}
