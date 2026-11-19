/**
 * A strip of days in one sideways scroller: each day a column of its short weekday, its number
 * and an optional note (an event dot, a bill and its amount), as a link when it leads somewhere.
 * A phone's calendar reads it as its month, and it snaps day by day without widening the page.
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

import { dayStripScroll } from "./mixins/day-strip-scroll.js";

/** A cell's width when the consumer sets no `--ui-day-strip-cell`. */
const CELL = "var(--ui-day-strip-cell, 3rem)";

/** Prop types for {@link DayStrip}. */
export namespace DayStrip {
	/** One day on the strip. */
	export interface Day {
		/** The day, as `YYYY-MM-DD`. */
		date: string;
		/** Where the day leads; a day without one is a plain cell. */
		href?: string;
		/** The day the page shows; sets `aria-current="date"` and keeps it in view. */
		current?: boolean;
		/** Drawn under the number, such as event dots or an amount; two short lines at most. */
		note?: RemixNode;
		/** What the note means for a screen reader, such as "3 events". */
		label?: string;
	}

	/** Props accepted by {@link DayStrip}. */
	export interface Props extends Omit<TagProps<"nav">, "children"> {
		/** The landmark's name, such as "November 2026". */
		label: string;
		days: Day[];
		/** Today, as `YYYY-MM-DD`, drawn with a ring. */
		today?: string;
		/** Formats the weekday names and the days' accessible names. @default "en" */
		locale?: string;
	}
}

/**
 * Client island: keeps the current day in view once the strip is laid out, so a phone opens on
 * the day it shows. Loads from `@sdxc/ui/app/day-strip#DayStripScroll`.
 */
export const DayStripScroll: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/app/day-strip#DayStripScroll",
	function DayStripScroll() {
		return () => <span hidden data-slot="day-strip-scroll" mix={[dayStripScroll()]} />;
	},
);

/** A `YYYY-MM-DD` day as a UTC instant, so its weekday and number never shift with a zone. */
function utcDay(date: string): Date {
	return new Date(`${date.slice(0, 10)}T00:00:00Z`);
}

/**
 * Renders the strip: a list of day cells in a scroller that snaps to each one. The current day
 * fills with the brand colour, today wears a ring, and weekends dim their weekday name.
 *
 * @example
 * <DayStrip label="November 2026" today="2026-11-18" days={[
 * 	{ date: "2026-11-18", href: "?day=2026-11-18", current: true, note: <Dot />, label: "2 events" },
 * ]} />
 */
export function DayStrip(handle: Handle<DayStrip.Props>) {
	return () => {
		let { label, days, today, locale = "en", mix, ...rest } = handle.props;
		let weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
		let number = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });
		let full = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });

		return (
			<nav
				{...rest}
				aria-label={label}
				data-slot="day-strip"
				mix={mergeMix(
					[
						raw({
							position: "relative",
							minInlineSize: "0",
							overflowX: "auto",
							overscrollBehaviorInline: "contain",
							scrollSnapType: "x proximity",
							scrollPaddingInline: "0.5rem",
							scrollbarWidth: "none",
							"&::-webkit-scrollbar": { display: "none" },
						}),
					],
					mix,
				)}
			>
				<ol
					data-slot="day-strip-days"
					mix={[
						raw({
							display: "flex",
							gap: "0.25rem",
							margin: "0",
							padding: "0.25rem 0.5rem",
							listStyle: "none",
							inlineSize: "max-content",
						}),
					]}
				>
					{days.map((day) => {
						let instant = utcDay(day.date);
						let weekend = [0, 6].includes(instant.getUTCDay());
						let content = (
							<>
								<span
									data-slot="day-strip-weekday"
									aria-hidden="true"
									mix={[
										raw({
											fontSize: "0.6875rem",
											lineHeight: "1rem",
											fontWeight: "500",
											textTransform: "uppercase",
											letterSpacing: "0.04em",
											color: "var(--ui-neutral-fg-muted)",
										}),
										when("[data-weekend] > &", raw({ opacity: "0.7" })),
										when("[aria-current='date'] > &", raw({ color: "inherit", opacity: "0.85" })),
									]}
								>
									{weekday.format(instant)}
								</span>
								<span
									data-slot="day-strip-number"
									aria-hidden="true"
									mix={[
										raw({
											display: "grid",
											placeItems: "center",
											inlineSize: "2rem",
											blockSize: "2rem",
											borderRadius: "999px",
											fontSize: "0.9375rem",
											fontWeight: "600",
											fontVariantNumeric: "tabular-nums",
										}),
										when(
											"[data-today]:not([aria-current='date']) > &",
											raw({
												color: "var(--ui-brand-fg)",
												boxShadow: "inset 0 0 0 1.5px currentColor",
											}),
										),
									]}
								>
									{number.format(instant)}
								</span>
								{day.note === undefined ? null : (
									<span
										data-slot="day-strip-note"
										aria-hidden="true"
										mix={[
											raw({
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												gap: "0.125rem",
												minBlockSize: "0.875rem",
												maxInlineSize: "100%",
												fontSize: "0.6875rem",
												lineHeight: "0.875rem",
												fontVariantNumeric: "tabular-nums",
												overflow: "hidden",
												textAlign: "center",
											}),
										]}
									>
										{day.note}
									</span>
								)}
								<span mix={[visuallyHidden()]}>
									{full.format(instant)}
									{day.label === undefined ? "" : `, ${day.label}`}
								</span>
							</>
						);
						let cell = [
							raw({
								position: "relative",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "0.125rem",
								boxSizing: "border-box",
								inlineSize: CELL,
								minBlockSize: "3.5rem",
								paddingBlock: "0.375rem",
								borderRadius: "0.75rem",
								color: "var(--ui-neutral-fg)",
								textDecoration: "none",
								outline: "none",
								transition: "background-color 120ms",
								WebkitTapHighlightColor: "transparent",
							}),
							when("&[href]:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
							when(
								"&[aria-current='date']",
								raw({
									backgroundColor: "var(--ui-brand-bg-solid)",
									color: "var(--ui-brand-fg-on-solid, white)",
								}),
							),
							when("&:focus-visible", raw({ boxShadow: "0 0 0 2px var(--ui-brand-ring)" })),
							motionReduce(raw({ transition: "none" })),
						];
						let attributes = {
							"data-slot": "day-strip-day",
							"data-date": day.date,
							"data-today": day.date === today ? "" : undefined,
							"data-weekend": weekend ? "" : undefined,
							"aria-current": day.current ? ("date" as const) : undefined,
						};
						return (
							<li mix={[raw({ scrollSnapAlign: "center" })]}>
								{day.href === undefined ? (
									<span {...attributes} mix={cell}>
										{content}
									</span>
								) : (
									<a {...attributes} href={day.href} mix={cell}>
										{content}
									</a>
								)}
							</li>
						);
					})}
				</ol>
				<DayStripScroll />
			</nav>
		);
	};
}
