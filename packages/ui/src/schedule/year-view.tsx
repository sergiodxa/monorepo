/**
 * A calendar's year: twelve small months in a grid that reflows from four columns to one, each
 * day a link with a dot whose weight follows how busy the day is, today ringed and the chosen day
 * filled, so a year reads at a glance and any day is one tap away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/** Milliseconds in a day, for walking a month's dates. */
const DAY_MS = 86_400_000;

/** Container the view names, so the months reflow to the width it is given. */
const YEAR_CONTAINER = "ui-year-view";

/** Prop types for {@link YearView}. */
export namespace YearView {
	/** Every string the view announces; `{…}` marks where a value goes. */
	export interface Labels {
		/** A day's count for a screen reader, such as "{count} events". */
		count: string;
	}

	/** Props accepted by {@link YearView}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		year: number;
		/** Events per day, keyed `YYYY-MM-DD`; a day missing from it is free. */
		counts?: Record<string, number>;
		/** Today, as `YYYY-MM-DD`, ringed. */
		today?: string;
		/** The chosen day, as `YYYY-MM-DD`, filled. */
		selected?: string;
		/** Where a day leads, such as its day view. */
		dayHref: (date: string) => string;
		/** Where a month's name leads, such as its month view; plain text without it. */
		monthHref?: (month: string) => string;
		/** 0 for Sunday, 1 for Monday. @default 0 */
		weekStartsOn?: 0 | 1;
		/** @default "en" */
		locale?: string;
		labels: Labels;
	}
}

/** A month's days in weeks, `null` filling the cells before the 1st and after the last day. */
function monthCells(year: number, month: number, weekStartsOn: 0 | 1): Array<string | null> {
	let first = Date.UTC(year, month, 1);
	let days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	let lead = (new Date(first).getUTCDay() - weekStartsOn + 7) % 7;
	let cells: Array<string | null> = Array.from({ length: lead }, () => null);
	for (let day = 0; day < days; day += 1) {
		cells.push(new Date(first + day * DAY_MS).toISOString().slice(0, 10));
	}
	while (cells.length % 7 !== 0) cells.push(null);
	return cells;
}

/** How heavy a day's dot is: none, one event, a few, or a full day. */
function weight(count: number): "0" | "1" | "2" | "3" {
	if (count <= 0) return "0";
	if (count === 1) return "1";
	return count <= 3 ? "2" : "3";
}

/**
 * Renders the year: a heading per month (a link when `monthHref` is set) over its weekday
 * initials and day links. Dots grow and darken with a day's count, so busy stretches show as
 * texture across the year.
 *
 * @example
 * <YearView year={2026} today="2026-11-18" counts={{ "2026-11-18": 4 }} dayHref={(date) => `/day/${date}`}
 * 	labels={{ count: "{count} events" }} />
 */
export function YearView(handle: Handle<YearView.Props>) {
	return () => {
		let {
			year,
			counts = {},
			today,
			selected,
			dayHref,
			monthHref,
			weekStartsOn = 0,
			locale = "en",
			labels,
			mix,
			...rest
		} = handle.props;
		let monthName = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
		let narrow = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
		let full = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
		let weekdays = Array.from({ length: 7 }, (_, index) =>
			narrow.format(Date.UTC(2023, 0, 1 + ((index + weekStartsOn) % 7))),
		);

		return (
			<div
				{...rest}
				data-slot="year-view"
				mix={mergeMix(
					[
						raw({
							container: `${YEAR_CONTAINER} / inline-size`,
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(min(14rem, 100%), 1fr))",
							gap: "1.5rem 1.25rem",
							fontVariantNumeric: "tabular-nums",
						}),
					],
					mix,
				)}
			>
				{Array.from({ length: 12 }, (_, month) => {
					let key = `${year}-${String(month + 1).padStart(2, "0")}`;
					let name = monthName.format(Date.UTC(year, month, 1));
					let current = today?.startsWith(key) ?? false;
					return (
						<section aria-label={`${name} ${year}`} data-slot="year-view-month" data-month={key}>
							<h3
								mix={[
									raw({
										margin: "0 0 0.5rem",
										paddingInline: "0.25rem",
										fontSize: "0.9375rem",
										fontWeight: "650",
										color: current ? "var(--ui-brand-fg)" : "var(--ui-neutral-fg-emphasis)",
									}),
								]}
							>
								{monthHref ? (
									<a
										href={monthHref(key)}
										mix={[
											raw({
												color: "inherit",
												textDecoration: "none",
												borderRadius: "0.25rem",
												"&:hover": { textDecoration: "underline" },
												"&:focus-visible": {
													outline: "2px solid var(--ui-brand-ring)",
													outlineOffset: "2px",
												},
											}),
										]}
									>
										{name}
									</a>
								) : (
									name
								)}
							</h3>
							<div
								aria-hidden="true"
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
										fontSize: "0.625rem",
										fontWeight: "600",
										textAlign: "center",
										color: "var(--ui-neutral-fg-muted)",
										marginBlockEnd: "0.125rem",
									}),
								]}
							>
								{weekdays.map((day) => (
									<span>{day}</span>
								))}
							</div>
							<div
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
										rowGap: "0.125rem",
									}),
								]}
							>
								{monthCells(year, month, weekStartsOn).map((date) => {
									if (date === null) return <span aria-hidden="true" />;
									let count = counts[date] ?? 0;
									return (
										<a
											href={dayHref(date)}
											data-slot="year-view-day"
											data-date={date}
											data-weight={weight(count)}
											data-today={date === today ? "" : undefined}
											aria-current={date === selected ? "date" : undefined}
											mix={[
												raw({
													position: "relative",
													display: "grid",
													placeItems: "center",
													blockSize: "1.75rem",
													minInlineSize: "0",
													borderRadius: "999px",
													fontSize: "0.75rem",
													color: "var(--ui-neutral-fg)",
													textDecoration: "none",
													outline: "none",
													"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
													"&:focus-visible": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
													"&[data-today]": { color: "var(--ui-brand-fg)", fontWeight: "700" },
													"&[aria-current='date']": {
														backgroundColor: "var(--ui-brand-bg-solid)",
														color: "var(--ui-brand-fg-on-solid, white)",
													},
													"&::after": {
														content: "''",
														position: "absolute",
														insetBlockEnd: "8%",
														insetInlineStart: "50%",
														inlineSize: "0.25rem",
														blockSize: "0.25rem",
														marginInlineStart: "-0.125rem",
														borderRadius: "999px",
														backgroundColor: "currentColor",
														opacity: "0",
													},
													"&[data-weight='1']::after": { opacity: "0.35" },
													"&[data-weight='2']::after": { opacity: "0.6" },
													"&[data-weight='3']::after": {
														opacity: "0.9",
														inlineSize: "0.3125rem",
														blockSize: "0.3125rem",
														marginInlineStart: "-0.15625rem",
													},
												}),
												when(
													`@container ${YEAR_CONTAINER} (width < 30rem)`,
													raw({ fontSize: "0.8125rem", blockSize: "2.25rem" }),
												),
											]}
										>
											<span aria-hidden="true">{Number(date.slice(8))}</span>
											<span mix={[visuallyHidden()]}>
												{full.format(Date.parse(`${date}T00:00:00Z`))}
												{count > 0 ? `, ${labels.count.replace("{count}", String(count))}` : ""}
											</span>
										</a>
									);
								})}
							</div>
						</section>
					);
				})}
			</div>
		);
	};
}
