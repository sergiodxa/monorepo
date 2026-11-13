/**
 * A year of per-day counts at a glance, as a real `<table role="grid">`: weeks are columns, weekdays
 * rows, and each day is tinted one of five levels drawn from the accent, so each app's theme recolours
 * it. Every day names its count; an optional island adds one shared tooltip and arrow-key navigation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { flex, gap, items, justify } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";
import { nowrap, tabularNums, text, weight } from "@sdxc/u/typography";
import { attrs, clientEntry } from "remix/component";

import { contributionGraphKeys } from "./mixins/contribution-graph-keys.js";

/** Lower bound of each level, 0 through 4, when `levels` is unset. */
const DEFAULT_LEVELS: readonly number[] = [0, 1, 4, 8, 12];

/** Milliseconds in one day; dates are counted in UTC, so every day is exactly this long. */
const DAY_MS = 86_400_000;

/** Weekdays whose row header shows (Mon, Wed, Fri, as 0 = Sunday); the others stay for screen readers. */
const SHOWN_WEEKDAYS = new Set([1, 3, 5]);

/** The levels a day can take, lowest first. */
const LEVELS = [0, 1, 2, 3, 4] as const;

/**
 * Share of the accent each level mixes into the empty level's tint, so level 4 is the accent
 * itself and the steps between read evenly on a light or a dark surface.
 */
const LEVEL_SHARE: Record<number, number> = { 1: 30, 2: 55, 3: 80 };

/**
 * Prop types for {@link ContributionGraph}.
 */
export namespace ContributionGraph {
	/** One day's count; days missing from `days` count zero. */
	export interface Day {
		/** The day as `YYYY-MM-DD`. */
		date: string;
		/** Picks the day's level against `levels`; repeated dates add up. */
		count: number;
	}

	/** Every string the graph shows, so an app translates each one. */
	export interface Labels {
		/** The table's caption, the graph's summary ("4,015 contributions in the last year"). */
		caption: string;
		/**
		 * A day's name, plural on its count, from the date the graph formats in `locale`:
		 * `(12, "Tuesday, Nov 3") => "12 contributions on Tuesday, Nov 3"`.
		 */
		day: (count: number, date: string) => string;
		/** The legend's low end ("Less"). */
		less: string;
		/** The legend's high end ("More"). */
		more: string;
	}

	/** Props accepted by {@link ContributionGraph}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The counts to plot, in any order; only days between `start` and `end` are drawn. */
		days: readonly Day[];
		/** The first day drawn, as `YYYY-MM-DD`. */
		start: string;
		/** The last day drawn, as `YYYY-MM-DD`; its week is kept in view on a phone. */
		end: string;
		/** Lower bound of levels 0 to 4: a day takes the highest level its count reaches. @default [0, 1, 4, 8, 12] */
		levels?: readonly number[];
		/** Where a day leads, such as that day's activity; days are links when set. */
		href?: (date: string) => string;
		/** Locale for month and weekday names, and for the first day of the week. */
		locale?: string;
		/** First day of the week, 0 = Sunday; defaults to the locale's. */
		weekStart?: number;
		/** Every string the graph shows, so it reads in any language. */
		labels: Labels;
	}

	/** Props {@link ContributionGraphTooltip} serializes for hydration, which is why they are a `type`. */
	export type TooltipProps = {
		/** The CSS anchor name the tooltip positions against, unique to its graph. */
		anchor: string;
	};
}

/**
 * Parses `YYYY-MM-DD` as a UTC day number, so the grid never shifts with the server's time zone.
 *
 * @param date The day as `YYYY-MM-DD`.
 * @returns Days since the Unix epoch.
 */
function dayNumber(date: string): number {
	let [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
	return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/**
 * Writes a UTC day number back as `YYYY-MM-DD`.
 *
 * @param day Days since the Unix epoch.
 * @returns The ISO date.
 */
function isoDate(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The weekday of a UTC day number, 0 = Sunday; day 0 of the epoch was a Thursday.
 *
 * @param day Days since the Unix epoch.
 * @returns The weekday.
 */
function weekdayOf(day: number): number {
	return (((day + 4) % 7) + 7) % 7;
}

/**
 * The first day of the week in `locale`, 0 = Sunday, read from `Intl.Locale`'s week info; a
 * runtime without it starts weeks on Sunday.
 *
 * @param locale The locale to read; unset reads the runtime's.
 * @returns The weekday a week starts on.
 */
export function weekStartFor(locale?: string): number {
	let resolved = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale);
	let withInfo = resolved as Intl.Locale & {
		getWeekInfo?: () => { firstDay: number };
		weekInfo?: { firstDay: number };
	};
	let firstDay = withInfo.getWeekInfo?.().firstDay ?? withInfo.weekInfo?.firstDay ?? 7;
	return firstDay % 7;
}

/**
 * The level a count reaches: the highest index of `levels` whose lower bound it meets, so with
 * the default bounds a single contribution is level 1 and twelve or more is level 4.
 *
 * @param count The day's count.
 * @param levels Lower bound of each level, ascending.
 * @returns A level from 0 to 4.
 */
export function contributionLevel(
	count: number,
	levels: readonly number[] = DEFAULT_LEVELS,
): number {
	let level = 0;
	for (let index = 1; index < Math.min(levels.length, 5); index++) {
		if (count >= levels[index]!) level = index;
	}
	return level;
}

/**
 * A CSS dashed ident from a component id, which may hold characters an ident cannot.
 *
 * @param id The component's id.
 * @returns The anchor name the tooltip and the active day share.
 */
function anchorName(id: string): string {
	return `--ui-contribution-graph-${id.replace(/[^\w-]/g, "-")}`;
}

/** A grid column: one week, with the month its first in-range day falls in. */
interface Week {
	/** The day number of the week's first row. */
	first: number;
	/** `YYYY-MM` of its first day inside the range. */
	month: string;
}

/**
 * Without script each day's `title` names its count; mapping `@sdxc/ui/app/contribution-graph` in
 * the browser entry runs {@link ContributionGraphTooltip}, for a shared tooltip and arrow keys. Size
 * it with `--ui-contribution-graph-cell` and `-gap`, match `-bg` to the surface, tint `--graph-level-0`–`4`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the graph's markup.
 * @example
 * <ContributionGraph
 * 	days={days}
 * 	start="2025-11-14"
 * 	end="2026-11-13"
 * 	locale="en-US"
 * 	href={(date) => `/activity?date=${date}`}
 * 	labels={{
 * 		caption: t("profile.contributions", { count: total }),
 * 		day: (count, date) => t("profile.contributionsOn", { count, date }),
 * 		less: t("graph.less"),
 * 		more: t("graph.more"),
 * 	}}
 * />
 */
export function ContributionGraph(handle: Handle<ContributionGraph.Props>) {
	return () => {
		let { days, start, end, levels, href, locale, weekStart, labels, mix, ...rest } = handle.props;
		let first = dayNumber(start);
		let last = Math.max(first, dayNumber(end));
		let startsOn = weekStart ?? weekStartFor(locale);
		let gridStart = first - ((weekdayOf(first) - startsOn + 7) % 7);
		let weekCount = Math.floor((last - gridStart) / 7) + 1;
		let counts = new Map<number, number>();
		for (let entry of days) {
			let day = dayNumber(entry.date);
			counts.set(day, (counts.get(day) ?? 0) + entry.count);
		}

		let weeks: Week[] = Array.from({ length: weekCount }, (_, index) => {
			let weekFirst = gridStart + index * 7;
			return { first: weekFirst, month: isoDate(Math.max(weekFirst, first)).slice(0, 7) };
		});
		let months: { month: string; span: number }[] = [];
		for (let week of weeks) {
			let previous = months.at(-1);
			if (previous && previous.month === week.month) previous.span += 1;
			else months.push({ month: week.month, span: 1 });
		}

		let monthName = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
		let weekdayName = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
		let dateName = new Intl.DateTimeFormat(locale, {
			weekday: "long",
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});
		let anchor = anchorName(handle.id);

		return (
			<div
				{...rest}
				data-slot="contribution-graph"
				mix={mergeMix([flex(), raw({ flexDirection: "column" }), gap(2), minIs(0)], mix)}
			>
				<p
					aria-hidden="true"
					data-slot="contribution-graph-summary"
					mix={[raw({ margin: 0 }), text("sm"), weight("medium"), fg("neutral.emphasis")]}
				>
					{labels.caption}
				</p>
				<div
					data-slot="contribution-graph-scroller"
					mix={[
						minIs(0),
						/**
						 * Laid out from the end, the scroller's resting position is its newest week, so a
						 * phone opens on the current week with no script; the table's end margin takes the
						 * spare room when it fits, which keeps it at the start of a wide box.
						 */
						raw({
							display: "flex",
							flexDirection: "row-reverse",
							overflowX: "auto",
							overscrollBehaviorX: "contain",
							paddingBlockEnd: "0.25rem",
						}),
					]}
				>
					<table
						aria-readonly="true"
						data-slot="contribution-graph-table"
						mix={[
							/** The days form an ARIA grid, so arrows move between them as between cells. */
							attrs({ role: "grid" }),
							raw({
								flexShrink: 0,
								marginInlineEnd: "auto",
								borderCollapse: "separate",
								borderSpacing: "var(--ui-contribution-graph-gap, 3px)",
								fontSize: "var(--ui-text-xs, 0.75rem)",
								lineHeight: "1",
								color: "var(--ui-neutral-fg-muted)",
								"& th": { fontWeight: 400, padding: 0, textAlign: "start", whiteSpace: "nowrap" },
								"& thead th": { blockSize: "1rem", verticalAlign: "bottom" },
								'& th[scope="row"]': {
									position: "sticky",
									insetInlineStart: 0,
									zIndex: 1,
									paddingInlineEnd: "0.375rem",
									backgroundColor: "var(--ui-contribution-graph-bg, var(--ui-bg, Canvas))",
									boxShadow:
										"0 0 0 var(--ui-contribution-graph-gap, 3px) var(--ui-contribution-graph-bg, var(--ui-bg, Canvas))",
								},
								"& td[data-level]": {
									inlineSize: "var(--ui-contribution-graph-cell, 10px)",
									blockSize: "var(--ui-contribution-graph-cell, 10px)",
									padding: 0,
									borderRadius: "2px",
									boxShadow:
										"inset 0 0 0 1px color-mix(in oklab, var(--ui-neutral-fg, CanvasText) 6%, transparent)",
								},
								"& td > a": {
									display: "block",
									inlineSize: "100%",
									blockSize: "100%",
									borderRadius: "inherit",
								},
								'& [data-slot="contribution-graph-day"]:focus-visible': {
									outline: "2px solid var(--ui-brand-ring)",
									outlineOffset: "1px",
								},
							}),
							raw(levelRules("& td")),
						]}
					>
						<caption mix={[visuallyHidden()]}>{labels.caption}</caption>
						<thead>
							<tr>
								<td />
								{months.map((group) => (
									<th scope="colgroup" colSpan={group.span}>
										<span mix={group.span < 2 ? [visuallyHidden()] : undefined}>
											{monthName.format(new Date(dayNumber(`${group.month}-01`) * DAY_MS))}
										</span>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{Array.from({ length: 7 }, (_, row) => {
								let weekday = (startsOn + row) % 7;
								return (
									<tr>
										<th scope="row">
											<span mix={SHOWN_WEEKDAYS.has(weekday) ? undefined : [visuallyHidden()]}>
												{weekdayName.format(new Date((gridStart + row) * DAY_MS))}
											</span>
										</th>
										{weeks.map((week, index) => {
											let day = week.first + row;
											if (day < first || day > last) return <td data-outside="" />;
											let count = counts.get(day) ?? 0;
											let date = isoDate(day);
											let name = labels.day(count, dateName.format(new Date(day * DAY_MS)));
											let level = contributionLevel(count, levels);
											let tabIndex = day === last ? 0 : -1;
											if (href) {
												return (
													<td data-level={level} data-count={count}>
														<a
															href={href(date)}
															tabIndex={tabIndex}
															aria-label={name}
															title={name}
															data-slot="contribution-graph-day"
															data-date={date}
															data-week={index}
															data-row={row}
														/>
													</td>
												);
											}
											return (
												<td
													tabIndex={tabIndex}
													aria-label={name}
													title={name}
													data-slot="contribution-graph-day"
													data-level={level}
													data-count={count}
													data-date={date}
													data-week={index}
													data-row={row}
												/>
											);
										})}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
				<div
					data-slot="contribution-graph-legend"
					mix={[
						flex(),
						items("center"),
						justify("end"),
						gap(1),
						text("xs"),
						fg("neutral.muted"),
						nowrap(),
						tabularNums(),
						raw({
							"& > [data-level]": {
								inlineSize: "var(--ui-contribution-graph-cell, 10px)",
								blockSize: "var(--ui-contribution-graph-cell, 10px)",
								borderRadius: "2px",
							},
						}),
						raw(levelRules("& > span")),
					]}
				>
					<span mix={[raw({ marginInlineEnd: "0.25rem" })]}>{labels.less}</span>
					{LEVELS.map((level) => (
						<span aria-hidden="true" data-level={level} />
					))}
					<span mix={[raw({ marginInlineStart: "0.25rem" })]}>{labels.more}</span>
				</div>
				<ContributionGraphTooltip anchor={anchor} />
			</div>
		);
	};
}

/**
 * Tints each level from its `--graph-level-N` token, which an app's theme may set; unset, level 0 is
 * the neutral tint and levels 1–4 mix the accent into it, so both light and dark themes are designed.
 *
 * @param prefix Selector, relative to the rule's host, of the elements carrying `data-level`.
 * @returns One rule per level.
 */
function levelRules(prefix: string): Parameters<typeof raw>[0] {
	let empty = "var(--graph-level-0, var(--ui-neutral-bg-tint-hover))";
	let rules: Parameters<typeof raw>[0] = {};
	for (let level of LEVELS) {
		let fallback = iife(() => {
			if (level === 0) return "var(--ui-neutral-bg-tint-hover)";
			if (level === 4) return "var(--ui-brand-bg-solid)";
			return `color-mix(in oklab, var(--ui-brand-bg-solid) ${LEVEL_SHARE[level]}%, ${empty})`;
		});
		rules[`${prefix}[data-level="${level}"]`] = {
			backgroundColor: `var(--graph-level-${level}, ${fallback})`,
		};
	}
	return rules;
}

/**
 * Client island behind {@link ContributionGraph}'s tooltip and keyboard: a manual popover that
 * `contributionGraphKeys()` fills with the hovered or focused day's name and anchors to it, while
 * the arrows walk the days. Loads from `@sdxc/ui/app/contribution-graph#ContributionGraphTooltip`
 * once the app's browser entry maps it.
 */
export const ContributionGraphTooltip: EntryComponent<ContributionGraph.TooltipProps> = clientEntry(
	"@sdxc/ui/app/contribution-graph#ContributionGraphTooltip",
	function ContributionGraphTooltip(handle: Handle<ContributionGraph.TooltipProps>) {
		return () => (
			<div
				popover="manual"
				role="tooltip"
				data-slot="contribution-graph-tooltip"
				mix={[
					contributionGraphKeys(handle.props.anchor),
					raw({
						inset: "auto",
						margin: 0,
						marginBlockEnd: "0.375rem",
						positionArea: "top",
						positionTryFallbacks: "flip-block",
						paddingInline: "0.5rem",
						paddingBlock: "0.25rem",
						border: "none",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						color: "var(--ui-neutral-fg-on-solid)",
						backgroundColor: "var(--ui-neutral-bg-solid)",
						boxShadow: "var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1))",
						fontSize: "var(--ui-text-xs, 0.75rem)",
						lineHeight: "var(--ui-leading-xs, calc(1 / 0.75))",
						fontWeight: 500,
						whiteSpace: "nowrap",
						pointerEvents: "none",
					}),
				]}
			/>
		);
	},
);
