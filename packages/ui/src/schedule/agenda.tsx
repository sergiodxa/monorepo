/**
 * A calendar's schedule view: upcoming events grouped under a heading per day, each row a colour
 * dot, its times in a fixed column, then its title and a detail line. Rows link, open a popover,
 * or stay plain; the date gutter sits beside the day's events and stacks above them when narrow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { Popover } from "../components/popover.js";

/** The container the rows and gutters query to decide between side by side and stacked. */
const CONTAINER = "ui-agenda";

/** The container width under which the date gutter stacks above its day's events. */
const STACK_WIDTH = "30rem";

/** The date gutter's width beside the events. */
const GUTTER = "var(--ui-agenda-gutter, 5.5rem)";

/** The time column's width, wide enough for a range such as "10:30 – 11:45 AM". */
const TIME = "var(--ui-agenda-time, 7.5rem)";

/** The locale the dates are formatted in when none is given. */
const DEFAULT_LOCALE = "en";

/** Prop types for {@link Agenda}. */
export namespace Agenda {
	/** One event on a day. */
	export interface Event {
		/** Unique on the agenda; prefixes the event's popover id. */
		id: string;
		title: string;
		/** Its times as the reader reads them, such as "9:00 – 10:00 AM" or "All day". */
		time: string;
		/** Any CSS colour for the dot. @default the brand colour */
		color?: string;
		/** A muted line under the title, such as the place or the guests. */
		detail?: RemixNode;
		/** Makes the row a link; `popover` takes precedence over it. */
		href?: string;
		/** Opens in a popover anchored to the row. */
		popover?: RemixNode;
		/** Draws the dot hollow and hatched, for an invitation not yet answered. */
		tentative?: boolean;
		/** Dims the row, for an event already over. */
		past?: boolean;
	}

	/** One day and its events, in the order they are listed. */
	export interface Day {
		/** The day, as `YYYY-MM-DD`. */
		date: string;
		/** The day's own view, which its heading links to. */
		href?: string;
		events: Event[];
	}

	/** Props accepted by {@link Agenda}. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		/** The region's accessible name, such as "Upcoming events". */
		label: string;
		/** Unique on the page; prefixes every event's popover id. */
		id: string;
		days: Day[];
		/** Today, as `YYYY-MM-DD`; its heading takes the brand colour. */
		today?: string;
		/** Formats the day headings. @default "en" */
		locale?: string;
		/** Shown in place of the list when `days` is empty, such as "Nothing scheduled". */
		empty?: RemixNode;
	}
}

/** A `YYYY-MM-DD` day as a UTC instant, so its weekday and number never shift with a zone. */
function utcDay(date: string): Date {
	return new Date(`${date.slice(0, 10)}T00:00:00Z`);
}

/**
 * Renders the agenda: an ordered list of days, each a sticky date heading beside an ordered list
 * of its events. Today's heading carries `aria-current="date"`, and an empty `days` shows `empty`.
 *
 * @example
 * <Agenda id="upcoming" label="Upcoming" today="2026-11-18" days={[{ date: "2026-11-18",
 * 	events: [{ id: "e1", title: "Standup", time: "9:00 – 9:15 AM", href: "/events/e1" }] }]} />
 */
export function Agenda(handle: Handle<Agenda.Props>) {
	return () => {
		let { id, label, days, today, locale, empty, mix, ...rest } = handle.props;
		let resolved = locale ?? DEFAULT_LOCALE;
		let number = new Intl.DateTimeFormat(resolved, { day: "numeric", timeZone: "UTC" });
		let weekday = new Intl.DateTimeFormat(resolved, { weekday: "short", timeZone: "UTC" });
		let month = new Intl.DateTimeFormat(resolved, { month: "short", timeZone: "UTC" });
		let full = new Intl.DateTimeFormat(resolved, {
			weekday: "long",
			month: "long",
			day: "numeric",
			timeZone: "UTC",
		});

		return (
			<section
				{...rest}
				id={id}
				aria-label={label}
				data-slot="agenda"
				mix={mergeMix(
					[
						raw({
							containerName: CONTAINER,
							containerType: "inline-size",
							minInlineSize: "0",
							fontVariantNumeric: "tabular-nums",
						}),
					],
					mix,
				)}
			>
				{days.length === 0 ? (
					<div
						data-slot="agenda-empty"
						mix={[
							raw({
								paddingBlock: "2rem",
								paddingInline: "1rem",
								textAlign: "center",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{empty}
					</div>
				) : (
					<ol data-slot="agenda-days" mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
						{days.map((day) => {
							let instant = utcDay(day.date);
							let isToday = day.date === today;
							let content = (
								<>
									<span
										aria-hidden="true"
										data-slot="agenda-day-number"
										mix={[
											raw({
												fontSize: "1.5rem",
												lineHeight: "1",
												fontWeight: "600",
												letterSpacing: "-0.02em",
												color: "var(--ui-neutral-fg-emphasis)",
											}),
											when("[data-today] &", raw({ color: "var(--ui-brand-fg)" })),
										]}
									>
										{number.format(instant)}
									</span>
									<span
										aria-hidden="true"
										mix={[
											raw({
												display: "flex",
												flexDirection: "column",
												fontSize: "0.6875rem",
												lineHeight: "0.875rem",
												fontWeight: "600",
												letterSpacing: "0.04em",
												textTransform: "uppercase",
												color: "var(--ui-neutral-fg-muted)",
											}),
											when("[data-today] &", raw({ color: "var(--ui-brand-fg)" })),
										]}
									>
										<span>{weekday.format(instant)}</span>
										<span mix={[raw({ fontWeight: "500" })]}>{month.format(instant)}</span>
									</span>
									<span mix={[visuallyHidden()]}>{full.format(instant)}</span>
								</>
							);
							let dateMix = [
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									paddingBlock: "0.25rem",
									paddingInline: "0.375rem",
									marginInline: "-0.375rem",
									borderRadius: "0.5rem",
									color: "inherit",
									textDecoration: "none",
									outline: "none",
								}),
								when("&[href]:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
								when("&:focus-visible", raw({ boxShadow: "0 0 0 2px var(--ui-brand-ring)" })),
							];
							return (
								<li
									data-slot="agenda-day"
									data-date={day.date}
									data-today={isToday ? "" : undefined}
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: `${GUTTER} minmax(0, 1fr)`,
											columnGap: "0.75rem",
											paddingBlock: "0.75rem",
											borderBlockStart: "1px solid var(--ui-neutral-border)",
											"&:first-child": { borderBlockStart: "none" },
											[`@container ${CONTAINER} (max-width: ${STACK_WIDTH})`]: {
												gridTemplateColumns: "minmax(0, 1fr)",
												paddingBlockStart: "0",
											},
										}),
									]}
								>
									<h3
										data-slot="agenda-date"
										mix={[
											raw({
												position: "sticky",
												insetBlockStart: "0",
												zIndex: "1",
												alignSelf: "start",
												margin: "0",
												paddingBlock: "0.25rem",
												fontSize: "inherit",
												fontWeight: "inherit",
												backgroundColor: "var(--ui-bg, Canvas)",
												[`@container ${CONTAINER} (max-width: ${STACK_WIDTH})`]: {
													paddingBlock: "0.5rem 0.25rem",
													borderBlockEnd: "1px solid var(--ui-neutral-border)",
													marginBlockEnd: "0.25rem",
												},
											}),
										]}
									>
										{day.href === undefined ? (
											<span aria-current={isToday ? "date" : undefined} mix={dateMix}>
												{content}
											</span>
										) : (
											<a href={day.href} aria-current={isToday ? "date" : undefined} mix={dateMix}>
												{content}
											</a>
										)}
									</h3>
									<ol
										data-slot="agenda-events"
										mix={[
											raw({
												display: "flex",
												flexDirection: "column",
												gap: "0.125rem",
												minInlineSize: "0",
												margin: "0",
												padding: "0",
												listStyle: "none",
											}),
										]}
									>
										{day.events.map((event) => (
											<AgendaRow event={event} popoverId={`${id}-event-${event.id}-popover`} />
										))}
									</ol>
								</li>
							);
						})}
					</ol>
				)}
			</section>
		);
	};
}

/**
 * One event's row: a button opening its popover when it has one, a link when it has an address,
 * and plain text otherwise. The dot takes the event's colour through `--ui-agenda-color`.
 */
function AgendaRow(handle: Handle<{ event: Agenda.Event; popoverId: string }>) {
	return () => {
		let { event, popoverId } = handle.props;
		let content = (
			<>
				<span
					aria-hidden="true"
					data-slot="agenda-dot"
					mix={[
						raw({
							alignSelf: "start",
							marginBlockStart: "0.3125rem",
							boxSizing: "border-box",
							inlineSize: "0.625rem",
							blockSize: "0.625rem",
							borderRadius: "999px",
							backgroundColor: "var(--ui-agenda-color)",
							"[data-tentative] &": {
								backgroundColor: "var(--ui-bg, Canvas)",
								backgroundImage:
									"repeating-linear-gradient(135deg, transparent 0 1.5px, var(--ui-agenda-color) 1.5px 3px)",
								boxShadow: "inset 0 0 0 1.5px var(--ui-agenda-color)",
							},
						}),
					]}
				/>
				<span
					data-slot="agenda-time"
					mix={[
						raw({
							fontSize: "0.8125rem",
							color: "var(--ui-neutral-fg-muted)",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					{event.time}
				</span>
				<span
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							minInlineSize: "0",
							overflowWrap: "anywhere",
						}),
					]}
				>
					<span
						data-slot="agenda-title"
						mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}
					>
						{event.title}
					</span>
					{event.detail === undefined ? null : (
						<span
							data-slot="agenda-detail"
							mix={[
								raw({
									fontSize: "0.8125rem",
									lineHeight: "1.125rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{event.detail}
						</span>
					)}
				</span>
			</>
		);
		return (
			<li
				data-slot="agenda-event"
				data-id={event.id}
				data-tentative={event.tentative ? "" : undefined}
				data-past={event.past ? "" : undefined}
				style={`--ui-agenda-color: ${event.color ?? "var(--ui-brand-bg-solid)"}`}
			>
				<RowFace popoverId={event.popover === undefined ? undefined : popoverId} href={event.href}>
					{content}
				</RowFace>
				{event.popover === undefined ? null : (
					<Popover id={popoverId} placement="bottom-start">
						{event.popover}
					</Popover>
				)}
			</li>
		);
	};
}

/** A row's face: the button opening its popover, its link, or a plain block. */
function RowFace(
	handle: Handle<{
		popoverId?: string;
		href?: string;
		children: RemixNode;
	}>,
) {
	return () => {
		let { popoverId, href, children } = handle.props;
		let mix = [
			raw({
				all: "unset",
				boxSizing: "border-box",
				display: "grid",
				gridTemplateColumns: `0.625rem ${TIME} minmax(0, 1fr)`,
				alignItems: "baseline",
				columnGap: "0.625rem",
				inlineSize: "100%",
				paddingBlock: "0.375rem",
				paddingInline: "0.5rem",
				borderRadius: "0.5rem",
				fontSize: "0.875rem",
				lineHeight: "1.25rem",
				textAlign: "start",
				color: "var(--ui-neutral-fg)",
				textDecoration: "none",
				transition: "background-color 120ms",
				"&:is(a, button)": { cursor: "pointer" },
				"&:is(a, button):hover": { backgroundColor: "var(--ui-neutral-bg-tint)" },
				"&:focus-visible": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
				"[data-past] > &": { opacity: "0.6" },
			}),
			motionReduce(raw({ transition: "none" })),
		];
		if (popoverId !== undefined)
			return (
				<button type="button" popovertarget={popoverId} data-slot="agenda-row" mix={mix}>
					{children}
				</button>
			);
		if (href !== undefined)
			return (
				<a href={href} data-slot="agenda-row" mix={mix}>
					{children}
				</a>
			);
		return (
			<div data-slot="agenda-row" mix={mix}>
				{children}
			</div>
		);
	};
}
