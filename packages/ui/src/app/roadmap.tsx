/**
 * A roadmap: grouped rows of projects, each a name in a sticky list beside a bar on a shared
 * time axis, with months and weeks across the top and today's line through every row. A bar
 * fills with its progress and runs a hatched tail past its target when it is projected late.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";

/** Milliseconds in a day, the axis's unit. */
const DAY_MS = 86_400_000;

/** Container the roadmap names, so the list column narrows on a phone-narrow roadmap. */
const ROADMAP_CONTAINER = "ui-roadmap";

/** Below this width the list column narrows and drops its trailing details. */
const NARROW = `@container ${ROADMAP_CONTAINER} (width < 40rem)`;

/** The width of one day on the axis, which every offset and length multiplies. */
const DAY = "var(--ui-roadmap-day-width, 6px)";

/** The list column's width. */
const LIST = "var(--ui-roadmap-list-width, 20rem)";

/** The height of a project row, which its bar centres in. */
const ROW = "var(--ui-roadmap-row-height, 2.75rem)";

/** Prop types for {@link Roadmap}, {@link Roadmap.Group} and {@link Roadmap.Item}. */
export namespace Roadmap {
	/** Every string the roadmap shows or announces; `{…}` marks where a value goes. */
	export interface Labels {
		/** The today marker's name, such as "Today". */
		today: string;
		/** A bar's dates, such as "{start} to {end}". */
		schedule: string;
		/** A bar's progress, such as "{percent} complete". */
		progress: string;
		/** A late bar's projection, such as "projected to finish {date}". */
		projected: string;
		/** What an item without dates says on the axis, such as "No dates". */
		unscheduled: string;
	}

	/** Props accepted by {@link Roadmap}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The roadmap's accessible name. */
		label: string;
		/** The first day on the axis, as `YYYY-MM-DD`. */
		start: string;
		/** The last day on the axis, as `YYYY-MM-DD`. */
		end: string;
		/** Today, as `YYYY-MM-DD`; draws the line when it falls on the axis. */
		today?: string;
		/** Formats the month and day labels. @default "en" */
		locale?: string;
		/** The list column's heading row, such as Active and Closed tabs. */
		header?: RemixNode;
		labels: Labels;
		/** {@link Roadmap.Group}s, in order. */
		children: RemixNode;
	}

	/** Context the roadmap hands its groups and items. */
	export interface Context {
		start: number;
		end: number;
		locale: string;
		labels: Labels;
	}

	/** Props accepted by {@link Roadmap.Group}. */
	export interface GroupProps extends Omit<TagProps<"section">, "title" | "children"> {
		/** The group's name, such as a quarter. */
		title: RemixNode;
		/** Controls at the group header's end, such as an "Add project" link. */
		actions?: RemixNode;
		/** {@link Roadmap.Item}s. */
		children?: RemixNode;
	}

	/** Props accepted by {@link Roadmap.Item}. */
	export interface ItemProps extends Omit<TagProps<"li">, "children"> {
		name: string;
		/** The project's page; the name in the list and on the bar both link to it. */
		href?: string;
		/** A 16px glyph before the name, in the list and on the bar. */
		icon?: RemixNode;
		/** Trailing details in the list row, such as the lead's avatar and a status. */
		meta?: RemixNode;
		/** The first day, as `YYYY-MM-DD`; an item without `start` and `end` has no bar. */
		start?: string;
		/** The target day, as `YYYY-MM-DD`. */
		end?: string;
		/** How much is done, from 0 to 1, drawn as the bar's fill. */
		progress?: number;
		/** The day the work is projected to finish; past `end`, a hatched tail runs to it. */
		projectedEnd?: string;
		/** Drawn after the name on the bar, such as a burn-up sparkline. */
		trailing?: RemixNode;
	}
}

/**
 * Days from the epoch to a `YYYY-MM-DD` date, read as UTC so a time zone never shifts a bar.
 *
 * @param date The date.
 * @returns Whole days since 1970-01-01.
 */
export function roadmapDay(date: string): number {
	return Math.round(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

/** A calc() length `days` days along the axis. */
function along(days: number): string {
	return `calc(${days} * ${DAY})`;
}

/** Formats a day for a label, in UTC. */
function format(day: number, locale: string, options: Intl.DateTimeFormatOptions): string {
	return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
		new Date(day * DAY_MS),
	);
}

/**
 * Renders the roadmap inside its own scrolling box: the list column stays put while the axis
 * scrolls sideways, and the axis row stays put while the rows scroll. Size the box from
 * outside (a block size, or a flex parent) for the rows to scroll inside it.
 *
 * @example
 * <Roadmap label="Roadmap" start="2026-09-01" end="2027-03-31" today="2026-11-12" labels={labels}>
 * 	<Roadmap.Group title="Q4 2026">
 * 		<Roadmap.Item name="Checkout v2" href="/projects/checkout" start="2026-10-01" end="2026-12-15" progress={0.6} />
 * 	</Roadmap.Group>
 * </Roadmap>
 */
export function Roadmap(handle: Handle<Roadmap.Props, Roadmap.Context>) {
	return () => {
		let {
			label,
			start,
			end,
			today,
			locale = "en",
			header,
			labels,
			children,
			mix,
			...rest
		} = handle.props;
		let first = roadmapDay(start);
		let last = roadmapDay(end);
		let span = last - first + 1;
		handle.context.set({ start: first, end: last, locale, labels });

		let months: Array<{ day: number; label: string }> = [];
		let weeks: number[] = [];
		for (let day = first; day <= last; day++) {
			let date = new Date(day * DAY_MS);
			if (date.getUTCDate() === 1 || day === first) {
				months.push({ day, label: format(day, locale, { month: "long" }) });
			}
			if (date.getUTCDay() === 1) weeks.push(day);
		}
		let firstMonday = weeks[0] ?? first;
		let todayDay = today === undefined ? undefined : roadmapDay(today);
		let showsToday = todayDay !== undefined && todayDay >= first && todayDay <= last;

		return (
			<div
				{...rest}
				role="region"
				aria-label={label}
				data-slot="roadmap"
				mix={mergeMix(
					[
						raw({
							container: `${ROADMAP_CONTAINER} / inline-size`,
							position: "relative",
							overflow: "auto",
							overscrollBehavior: "contain",
							minInlineSize: 0,
							backgroundColor: "var(--ui-bg, Canvas)",
							"--ui-roadmap-track": along(span),
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="roadmap-grid"
					mix={[
						raw({
							position: "relative",
							display: "grid",
							gridTemplateColumns: `${LIST} var(--ui-roadmap-track)`,
							alignContent: "start",
							minBlockSize: "100%",
							[NARROW]: { "--ui-roadmap-list-width": "10rem" },
							inlineSize: "max-content",
							minInlineSize: "100%",
						}),
					]}
				>
					<div
						data-slot="roadmap-corner"
						mix={[
							raw({
								position: "sticky",
								insetBlockStart: "0",
								insetInlineStart: "0",
								zIndex: "6",
								display: "flex",
								alignItems: "center",
								minBlockSize: "3.5rem",
								paddingInline: "0.75rem",
								boxSizing: "border-box",
								backgroundColor: "var(--ui-bg, Canvas)",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								borderInlineEnd: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						{header}
					</div>
					<div
						aria-hidden="true"
						data-slot="roadmap-axis"
						mix={[
							raw({
								position: "sticky",
								insetBlockStart: "0",
								zIndex: "5",
								minBlockSize: "3.5rem",
								backgroundColor: "var(--ui-bg, Canvas)",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								fontSize: "0.75rem",
								lineHeight: "1rem",
								fontVariantNumeric: "tabular-nums",
								whiteSpace: "nowrap",
							}),
						]}
					>
						{months.map((month) => (
							<span
								data-slot="roadmap-month"
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "0.625rem",
										insetInlineStart: along(month.day - first),
										paddingInlineStart: "0.375rem",
										color: "var(--ui-neutral-fg)",
										fontWeight: "500",
									}),
								]}
							>
								{month.label}
							</span>
						))}
						{weeks.map((week) => (
							<span
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "1.875rem",
										insetInlineStart: along(week - first),
										translate: "-50% 0",
										color: "var(--ui-neutral-fg-muted)",
										opacity: todayDay !== undefined && Math.abs(week - todayDay) < 4 ? "0" : "1",
									}),
								]}
							>
								{format(week, locale, { day: "numeric" })}
							</span>
						))}
						{iife(() => {
							if (!showsToday || todayDay === undefined) return null;
							return (
								<span
									data-slot="roadmap-today-label"
									mix={[
										raw({
											position: "absolute",
											insetBlockStart: "1.625rem",
											insetInlineStart: along(todayDay - first + 0.5),
											translate: "-50% 0",
											minInlineSize: "1.5rem",
											blockSize: "1.5rem",
											paddingInline: "0.25rem",
											boxSizing: "border-box",
											borderRadius: "999px",
											display: "grid",
											placeItems: "center",
											fontWeight: "700",
											color: "var(--ui-brand-fg-on-solid, white)",
											backgroundColor: "var(--ui-brand-bg-solid)",
										}),
									]}
								>
									{format(todayDay, locale, { day: "numeric" })}
								</span>
							);
						})}
					</div>
					{children}
					<div
						aria-hidden="true"
						data-slot="roadmap-weeks"
						mix={[
							raw({
								position: "absolute",
								insetBlock: "3.5rem 0",
								insetInlineStart: LIST,
								inlineSize: "var(--ui-roadmap-track)",
								zIndex: "0",
								pointerEvents: "none",
								backgroundImage:
									"linear-gradient(to right, var(--ui-neutral-border) 1px, transparent 1px)",
								backgroundSize: `${along(7)} 100%`,
								backgroundPositionX: along(firstMonday - first),
								opacity: "0.45",
							}),
						]}
					/>
					{iife(() => {
						if (!showsToday || todayDay === undefined) return null;
						return (
							<div
								data-slot="roadmap-today"
								mix={[
									raw({
										position: "absolute",
										insetBlock: "0",
										insetInlineStart: `calc(${LIST} + ${along(todayDay - first + 0.5)})`,
										inlineSize: "2px",
										translate: "-50% 0",
										zIndex: "2",
										pointerEvents: "none",
										backgroundColor: "var(--ui-brand-bg-solid)",
									}),
								]}
							>
								<span mix={[visuallyHidden()]}>
									{`${labels.today}: ${format(todayDay, locale, { dateStyle: "long" })}`}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		);
	};
}

/**
 * One group: a header row spanning list and axis, then its projects as a list, so a screen
 * reader hears each group's name and count before its rows.
 */
Roadmap.Group = function RoadmapGroup(handle: Handle<Roadmap.GroupProps>) {
	return () => {
		let { title, actions, children, mix, id, ...rest } = handle.props;
		return (
			<section
				{...rest}
				id={id}
				data-slot="roadmap-group"
				mix={mergeMix([raw({ display: "contents" })], mix)}
			>
				<div
					mix={[
						raw({
							position: "sticky",
							insetInlineStart: "0",
							zIndex: "3",
							gridColumn: "1",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							minBlockSize: "2.75rem",
							paddingInline: "0.75rem",
							boxSizing: "border-box",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							borderInlineEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<h3
						mix={[
							raw({
								margin: "0",
								flex: "1 1 auto",
								minInlineSize: 0,
								fontSize: "0.9375rem",
								lineHeight: "1.25rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{title}
					</h3>
					{actions}
				</div>
				<div
					aria-hidden="true"
					mix={[
						raw({ gridColumn: "2", backgroundColor: "var(--ui-neutral-bg-tint)", opacity: "0.6" }),
					]}
				/>
				<ul
					mix={[
						raw({
							display: "grid",
							gridColumn: "1 / -1",
							gridTemplateColumns: "subgrid",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
					]}
				>
					{children}
				</ul>
			</section>
		);
	};
};

/**
 * One project: its name, glyph and details in the list column, and its bar on the axis, with
 * the dates, progress and projection written out for a screen reader. A bar shorter than its
 * name lets the name run past its end.
 */
Roadmap.Item = function RoadmapItem(handle: Handle<Roadmap.ItemProps>) {
	return () => {
		let { name, href, icon, meta, start, end, progress, projectedEnd, trailing, mix, ...rest } =
			handle.props;
		let roadmap = handle.context.get(Roadmap);
		let { labels, locale } = roadmap;
		let from = start === undefined ? undefined : roadmapDay(start);
		let to = end === undefined ? undefined : roadmapDay(end);
		let scheduled = from !== undefined && to !== undefined && to >= from;
		let projected = projectedEnd === undefined ? undefined : roadmapDay(projectedEnd);
		let late = scheduled && projected !== undefined && to !== undefined && projected > to;
		let percent = Math.round(Math.min(Math.max(progress ?? 0, 0), 1) * 100);

		let glyph = iife(() => {
			if (!icon) return null;
			return (
				<span
					aria-hidden="true"
					mix={[
						raw({
							display: "inline-flex",
							flexShrink: "0",
							"& > svg": { inlineSize: "1rem", blockSize: "1rem" },
						}),
					]}
				>
					{icon}
				</span>
			);
		});
		let title = iife(() => {
			if (!href) return name;
			return (
				<a
					href={href}
					mix={[
						raw({
							color: "inherit",
							textDecoration: "none",
							outline: "none",
							"&:hover": { textDecoration: "underline" },
							"&:focus-visible": {
								borderRadius: "0.25rem",
								boxShadow: "0 0 0 2px var(--ui-brand-ring)",
							},
						}),
					]}
				>
					{name}
				</a>
			);
		});
		let description = iife(() => {
			if (!scheduled) return labels.unscheduled;
			let parts = [
				labels.schedule
					.replace("{start}", format(from!, locale, { dateStyle: "medium" }))
					.replace("{end}", format(to!, locale, { dateStyle: "medium" })),
			];
			if (progress !== undefined) parts.push(labels.progress.replace("{percent}", `${percent}%`));
			if (late) {
				parts.push(
					labels.projected.replace("{date}", format(projected!, locale, { dateStyle: "medium" })),
				);
			}
			return parts.join(", ");
		});
		let left = scheduled ? from! - roadmap.start : 0;
		let length = scheduled ? to! - from! + 1 : 0;

		return (
			<li
				{...rest}
				data-slot="roadmap-item"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridColumn: "1 / -1",
							gridTemplateColumns: "subgrid",
							blockSize: ROW,
							"&:hover > *": {
								backgroundColor: "color-mix(in oklch, var(--ui-neutral-bg-tint) 60%, transparent)",
							},
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="roadmap-item-name"
					mix={[
						raw({
							position: "sticky",
							insetInlineStart: "0",
							zIndex: "3",
							display: "flex",
							alignItems: "center",
							gap: "0.625rem",
							minInlineSize: 0,
							paddingInline: "0.75rem 0.75rem",
							boxSizing: "border-box",
							fontSize: "0.875rem",
							lineHeight: "1.25rem",
							color: "var(--ui-neutral-fg-emphasis)",
							backgroundColor: "var(--ui-bg, Canvas)",
							borderInlineEnd: "1px solid var(--ui-neutral-border)",
							borderBlockEnd: "1px solid var(--ui-neutral-border-subtle, transparent)",
						}),
					]}
				>
					{glyph}
					<span
						mix={[
							raw({
								flex: "1 1 auto",
								minInlineSize: 0,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}),
						]}
					>
						{title}
						<span mix={[visuallyHidden()]}>{`, ${description}`}</span>
					</span>
					{iife(() => {
						if (!meta) return null;
						return (
							<span
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.5rem",
										flexShrink: "0",
										[NARROW]: { display: "none" },
									}),
								]}
							>
								{meta}
							</span>
						);
					})}
				</div>
				<div
					aria-hidden="true"
					data-slot="roadmap-item-track"
					mix={[raw({ position: "relative", zIndex: "1", minInlineSize: 0 })]}
				>
					{iife(() => {
						if (!scheduled) {
							return (
								<span
									mix={[
										raw({
											position: "absolute",
											insetBlock: "0",
											insetInlineStart: "0.75rem",
											display: "flex",
											alignItems: "center",
											fontSize: "0.75rem",
											color: "var(--ui-neutral-fg-muted)",
											whiteSpace: "nowrap",
										}),
									]}
								>
									{labels.unscheduled}
								</span>
							);
						}
						return (
							<>
								{iife(() => {
									if (!late) return null;
									return (
										<span
											data-slot="roadmap-late"
											mix={[
												raw({
													position: "absolute",
													insetBlock: "0.4375rem",
													insetInlineStart: along(left + length - 0.5),
													inlineSize: along(projected! - to! + 0.5),
													borderRadius: "0 0.375rem 0.375rem 0",
													border:
														"1px dashed color-mix(in oklch, var(--ui-danger-fg) 60%, transparent)",
													borderInlineStart: "0",
													backgroundImage:
														"repeating-linear-gradient(-45deg, color-mix(in oklch, var(--ui-danger-fg) 22%, transparent) 0 2px, transparent 2px 7px)",
												}),
											]}
										/>
									);
								})}
								<span
									data-slot="roadmap-bar"
									style={`--ui-roadmap-progress:${percent}%`}
									mix={[
										raw({
											position: "absolute",
											insetBlock: "0.4375rem",
											insetInlineStart: along(left),
											inlineSize: along(length),
											boxSizing: "border-box",
											borderRadius: "0.375rem",
											border: "1px solid var(--ui-neutral-border)",
											backgroundColor: "var(--ui-neutral-bg-tint)",
											backgroundImage:
												"linear-gradient(to right, color-mix(in oklch, var(--ui-brand-bg-solid) 22%, var(--ui-neutral-bg-tint)) var(--ui-roadmap-progress), transparent var(--ui-roadmap-progress))",
										}),
									]}
								/>
								<span
									data-slot="roadmap-bar-label"
									mix={[
										raw({
											position: "absolute",
											insetBlock: "0",
											insetInlineStart: `calc(${along(left)} + 0.625rem)`,
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
											fontSize: "0.8125rem",
											lineHeight: "1.25rem",
											fontWeight: "500",
											color: "var(--ui-neutral-fg-emphasis)",
											whiteSpace: "nowrap",
											pointerEvents: "none",
										}),
									]}
								>
									{glyph}
									{name}
									{iife(() => {
										if (!trailing) return null;
										return (
											<span mix={[raw({ display: "inline-flex", color: "var(--ui-brand-fg)" })]}>
												{trailing}
											</span>
										);
									})}
								</span>
							</>
						);
					})}
				</div>
			</li>
		);
	};
};
