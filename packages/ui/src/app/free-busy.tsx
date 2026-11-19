/**
 * A "find a time" grid: one row per person over one day's hours, their busy blocks and the hours
 * outside their working day drawn on a track, and the suggested slots everyone can make as bands
 * across every row. The names stay put while the tracks scroll sideways inside their own box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/** The container the grid queries to narrow its names column on a small screen. */
const CONTAINER = "ui-free-busy";

/** The names column's width. */
const NAMES = "var(--ui-free-busy-names, 11rem)";

/** The names column's width inside a narrow container. */
const NARROW_NAMES = "var(--ui-free-busy-names-narrow, 7.5rem)";

/** The tracks column's least width, under which the grid scrolls sideways. */
const TRACKS = "var(--ui-free-busy-tracks, 36rem)";

/** The column granularity when `step` is unset. */
const DEFAULT_STEP = 30;

/** A minute as `H:MM` on a 24-hour clock, the formatter used when none is given. */
function defaultFormatTime(minute: number): string {
	let hours = Math.floor(minute / 60) % 24;
	let rest = Math.round(minute % 60);
	return `${hours}:${String(rest).padStart(2, "0")}`;
}

/** Prop types for {@link FreeBusy}. */
export namespace FreeBusy {
	/** Every string a row announces; `{times}` marks where its ranges go. */
	export interface Labels {
		/** A row with busy time, such as "Busy {times}". */
		busy: string;
		/** A row with nothing booked, such as "Free all day". */
		free: string;
	}

	/** A busy stretch on one person's day. */
	export interface Busy {
		/** Minutes from midnight. */
		start: number;
		/** Minutes from midnight. */
		end: number;
		/** Shown on the block and read in the row's summary in place of nothing. */
		title?: string;
		/** Draws it hatched, for an invitation not yet answered. */
		tentative?: boolean;
	}

	/** A stretch of minutes from midnight. */
	export interface Range {
		start: number;
		end: number;
	}

	/** One person's row. */
	export interface Person {
		/** Unique on the grid. */
		id: string;
		name: string;
		/** A muted line under the name, such as "Lisbon · 2:00 PM local". */
		detail?: string;
		avatar?: RemixNode;
		busy: Busy[];
		/** Outside their working hours, drawn as a hatch on a tint. */
		outside?: Range[];
	}

	/** A suggested time everyone can make, drawn as a band across every row. */
	export interface Slot {
		/** Minutes from midnight. */
		start: number;
		/** Minutes from midnight. */
		end: number;
		/** Makes the slot's label a link, such as one that books it. */
		href?: string;
		/** The slot's visible name, such as "10:00 – 10:30". */
		label: string;
		/** Outlines the band in the brand colour and sets `aria-current` on its link. */
		selected?: boolean;
	}

	/** An hour label on the axis. */
	export interface Hour {
		/** Minutes from midnight. */
		minute: number;
		label: string;
	}

	/** Props accepted by {@link FreeBusy}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The grid's accessible name, such as "Availability on November 18". */
		label: string;
		/** The first visible minute from midnight, such as 480. */
		start: number;
		/** The last visible minute from midnight, such as 1140. */
		end: number;
		/** Minutes per column; the track's faint lines fall on it. @default 30 */
		step?: number;
		/** The axis labels; each also draws an hour line down the tracks. */
		hours: Hour[];
		people: Person[];
		slots?: Slot[];
		/** The present minute, drawn as a thin line. */
		now?: number;
		/** Writes the minutes in each row's summary. @default H:MM on a 24-hour clock */
		formatTime?: (minute: number) => string;
		labels: Labels;
	}
}

/**
 * Renders the grid: a sticky column of names beside a track per person, under an axis of hours
 * and a row of slot labels. Every block is placed as a percentage of the visible range, so it
 * lines up at any width; each name carries a hidden summary of that person's busy times.
 *
 * @example
 * <FreeBusy label="Availability" start={480} end={1140} hours={hours} labels={labels}
 * 	people={[{ id: "ana", name: "Ana", busy: [{ start: 540, end: 600 }] }]} />
 */
export function FreeBusy(handle: Handle<FreeBusy.Props>) {
	return () => {
		let {
			label,
			start,
			end,
			step,
			hours,
			people,
			slots = [],
			now,
			formatTime,
			labels,
			mix,
			...rest
		} = handle.props;
		let span = Math.max(1, end - start);
		let format = formatTime ?? defaultFormatTime;
		let columnStep = step ?? DEFAULT_STEP;
		let percent = (minute: number) =>
			`${((Math.min(end, Math.max(start, minute)) - start) / span) * 100}%`;
		let width = (from: number, to: number) =>
			`${((Math.min(end, to) - Math.max(start, from)) / span) * 100}%`;
		let hasSlots = slots.length > 0;
		let axisRow = hasSlots ? 2 : 1;
		let firstPersonRow = axisRow + 1;
		let lastRow = axisRow + people.length;
		let stickyCell = raw({
			position: "sticky",
			insetInlineStart: "0",
			zIndex: "4",
			boxSizing: "border-box",
			minInlineSize: "0",
			backgroundColor: "var(--ui-bg, Canvas)",
			borderInlineEnd: "1px solid var(--ui-neutral-border)",
		});

		return (
			<div
				{...rest}
				role="group"
				aria-label={label}
				data-slot="free-busy"
				mix={mergeMix(
					[
						raw({
							containerName: CONTAINER,
							containerType: "inline-size",
							minInlineSize: "0",
							maxInlineSize: "100%",
							overflowX: "auto",
							overscrollBehaviorInline: "contain",
							fontVariantNumeric: "tabular-nums",
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="free-busy-grid"
					style={`--ui-free-busy-step: ${(columnStep / span) * 100}%`}
					mix={[
						raw({
							position: "relative",
							display: "grid",
							gridTemplateColumns: `${NAMES} minmax(${TRACKS}, 1fr)`,
							minInlineSize: "min-content",
							[`@container ${CONTAINER} (max-width: 30rem)`]: {
								gridTemplateColumns: `${NARROW_NAMES} minmax(${TRACKS}, 1fr)`,
							},
						}),
					]}
				>
					{hasSlots ? (
						<>
							<span aria-hidden="true" mix={[stickyCell, raw({ gridRow: "1", gridColumn: "1" })]} />
							<div
								data-slot="free-busy-slots"
								mix={[
									raw({
										position: "relative",
										gridRow: "1",
										gridColumn: "2",
										zIndex: "3",
										blockSize: "2rem",
									}),
								]}
							>
								{slots.map((slot) => (
									<SlotLabel
										slot={slot}
										left={percent(slot.start)}
										width={width(slot.start, slot.end)}
									/>
								))}
							</div>
						</>
					) : null}
					<span
						aria-hidden="true"
						mix={[
							stickyCell,
							raw({
								gridRow: `${axisRow}`,
								gridColumn: "1",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							}),
						]}
					/>
					<div
						aria-hidden="true"
						data-slot="free-busy-axis"
						mix={[
							raw({
								position: "relative",
								gridRow: `${axisRow}`,
								gridColumn: "2",
								blockSize: "1.5rem",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								fontSize: "0.6875rem",
								lineHeight: "1.5rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{hours.map((hour) => (
							<span
								data-minute={hour.minute}
								style={`inset-inline-start: ${percent(hour.minute)}`}
								mix={[
									raw({
										position: "absolute",
										insetBlock: "0",
										display: "flex",
										justifyContent: "center",
										inlineSize: "0",
										whiteSpace: "nowrap",
										"&[data-minute]:first-child": { justifyContent: "start" },
										"&[data-minute]:last-child": { justifyContent: "end" },
									}),
								]}
							>
								{hour.label}
							</span>
						))}
					</div>
					<div
						aria-hidden="true"
						data-slot="free-busy-lines"
						style={`grid-row: ${firstPersonRow} / ${lastRow + 1}`}
						mix={[
							raw({
								position: "relative",
								gridColumn: "2",
								zIndex: "0",
								pointerEvents: "none",
								backgroundImage:
									"repeating-linear-gradient(to right, color-mix(in oklch, var(--ui-neutral-border) 50%, transparent) 0 1px, transparent 1px var(--ui-free-busy-step))",
							}),
						]}
					>
						{hours.map((hour) => (
							<span
								style={`inset-inline-start: ${percent(hour.minute)}`}
								mix={[
									raw({
										position: "absolute",
										insetBlock: "0",
										inlineSize: "1px",
										backgroundColor: "var(--ui-neutral-border)",
									}),
								]}
							/>
						))}
					</div>
					{people.map((person, index) => (
						<PersonRow
							person={person}
							row={firstPersonRow + index}
							summary={summarize(person.busy, format, labels)}
							percent={percent}
							width={width}
							start={start}
							end={end}
							stickyCell={stickyCell}
						/>
					))}
					<div
						aria-hidden="true"
						data-slot="free-busy-overlay"
						style={`grid-row: 1 / ${lastRow + 1}`}
						mix={[
							raw({
								position: "relative",
								gridColumn: "2",
								zIndex: "2",
								pointerEvents: "none",
							}),
						]}
					>
						{slots.map((slot) => (
							<span
								data-slot="free-busy-band"
								data-selected={slot.selected ? "" : undefined}
								style={`inset-inline-start: ${percent(slot.start)}; inline-size: ${width(slot.start, slot.end)}`}
								mix={[
									raw({
										position: "absolute",
										insetBlock: "0",
										boxSizing: "border-box",
										borderRadius: "0.375rem",
										backgroundColor:
											"color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
										"&[data-selected]": {
											backgroundColor:
												"color-mix(in oklch, var(--ui-brand-bg-solid) 18%, transparent)",
											boxShadow: "inset 0 0 0 2px var(--ui-brand-bg-solid)",
										},
									}),
								]}
							/>
						))}
						{now === undefined || now < start || now > end ? null : (
							<span
								data-slot="free-busy-now"
								style={`inset-inline-start: ${percent(now)}`}
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: hasSlots ? "2rem" : "0",
										insetBlockEnd: "0",
										inlineSize: "2px",
										marginInlineStart: "-1px",
										backgroundColor: "var(--ui-free-busy-now, var(--ui-danger-bg-solid, crimson))",
									}),
								]}
							/>
						)}
					</div>
				</div>
			</div>
		);
	};
}

/** A row's summary: its busy ranges, each with its title when it has one, or the free label. */
function summarize(
	busy: FreeBusy.Busy[],
	format: (minute: number) => string,
	labels: FreeBusy.Labels,
): string {
	if (busy.length === 0) return labels.free;
	let times = [...busy]
		.sort((a, b) => a.start - b.start)
		.map((block) => {
			let range = `${format(block.start)}–${format(block.end)}`;
			return block.title === undefined ? range : `${block.title} ${range}`;
		})
		.join(", ");
	return labels.busy.replace("{times}", times);
}

/** A slot's label in the top row: a link when it books something, focusable and clickable. */
function SlotLabel(handle: Handle<{ slot: FreeBusy.Slot; left: string; width: string }>) {
	return () => {
		let { slot, left, width } = handle.props;
		let mix = [
			raw({
				position: "absolute",
				insetBlock: "0.25rem",
				boxSizing: "border-box",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				paddingInline: "0.375rem",
				borderRadius: "999px",
				fontSize: "0.6875rem",
				fontWeight: "600",
				whiteSpace: "nowrap",
				color: "var(--ui-brand-fg)",
				backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 12%, var(--ui-bg, Canvas))",
				textDecoration: "none",
				outline: "none",
			}),
			when("&[href]:hover", raw({ backgroundColor: "var(--ui-brand-bg-tint-hover)" })),
			when(
				"&[data-selected]",
				raw({
					backgroundColor: "var(--ui-brand-bg-solid)",
					color: "var(--ui-brand-fg-on-solid, white)",
				}),
			),
			when("&:focus-visible", raw({ boxShadow: "0 0 0 2px var(--ui-brand-ring)" })),
		];
		let style = `inset-inline-start: ${left}; min-inline-size: ${width}`;
		if (slot.href === undefined)
			return (
				<span
					data-slot="free-busy-slot"
					data-selected={slot.selected ? "" : undefined}
					style={style}
					mix={mix}
				>
					{slot.label}
				</span>
			);
		return (
			<a
				href={slot.href}
				data-slot="free-busy-slot"
				data-selected={slot.selected ? "" : undefined}
				aria-current={slot.selected ? "true" : undefined}
				style={style}
				mix={mix}
			>
				{slot.label}
			</a>
		);
	};
}

/** One person: a sticky name cell with the row's hidden summary, and a track of their day. */
function PersonRow(
	handle: Handle<{
		person: FreeBusy.Person;
		row: number;
		summary: string;
		percent: (minute: number) => string;
		width: (from: number, to: number) => string;
		start: number;
		end: number;
		stickyCell: ReturnType<typeof raw>;
	}>,
) {
	return () => {
		let { person, row, summary, percent, width, start, end, stickyCell } = handle.props;
		let visible = (range: FreeBusy.Range) => range.end > start && range.start < end;
		let place = (range: FreeBusy.Range) =>
			`inset-inline-start: ${percent(range.start)}; inline-size: ${width(range.start, range.end)}`;
		return (
			<>
				<div
					data-slot="free-busy-person"
					data-id={person.id}
					style={`grid-row: ${row}`}
					mix={[
						stickyCell,
						raw({
							gridColumn: "1",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							paddingBlock: "0.375rem",
							paddingInline: "0.5rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					{person.avatar === undefined ? null : (
						<span
							aria-hidden="true"
							mix={[
								raw({
									display: "flex",
									flexShrink: "0",
									inlineSize: "1.75rem",
									blockSize: "1.75rem",
								}),
							]}
						>
							{person.avatar}
						</span>
					)}
					<span mix={[raw({ display: "flex", flexDirection: "column", minInlineSize: "0" })]}>
						<span
							data-slot="free-busy-name"
							mix={[
								raw({
									fontSize: "0.8125rem",
									lineHeight: "1.125rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}),
							]}
						>
							{person.name}
						</span>
						{person.detail === undefined ? null : (
							<span
								mix={[
									raw({
										fontSize: "0.6875rem",
										lineHeight: "1rem",
										color: "var(--ui-neutral-fg-muted)",
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}),
								]}
							>
								{person.detail}
							</span>
						)}
						<span data-slot="free-busy-summary" mix={[visuallyHidden()]}>
							{summary}
						</span>
					</span>
				</div>
				<div
					aria-hidden="true"
					data-slot="free-busy-track"
					data-id={person.id}
					style={`grid-row: ${row}`}
					mix={[
						raw({
							position: "relative",
							zIndex: "1",
							gridColumn: "2",
							minBlockSize: "2.75rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					{(person.outside ?? []).filter(visible).map((range) => (
						<span
							data-slot="free-busy-outside"
							style={place(range)}
							mix={[
								raw({
									position: "absolute",
									insetBlock: "0",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									backgroundImage:
										"repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklch, var(--ui-neutral-fg-muted) 22%, transparent) 4px 5px)",
								}),
							]}
						/>
					))}
					{person.busy.filter(visible).map((block) => (
						<span
							data-slot="free-busy-block"
							data-start={block.start}
							data-end={block.end}
							data-tentative={block.tentative ? "" : undefined}
							title={block.title}
							style={place(block)}
							mix={[
								raw({
									position: "absolute",
									insetBlock: "0.375rem",
									boxSizing: "border-box",
									display: "flex",
									alignItems: "center",
									paddingInline: "0.375rem",
									overflow: "hidden",
									borderRadius: "0.375rem",
									boxShadow: "0 0 0 1px var(--ui-bg, Canvas)",
									fontSize: "0.6875rem",
									fontWeight: "500",
									whiteSpace: "nowrap",
									textOverflow: "ellipsis",
									color: "var(--ui-neutral-fg-emphasis)",
									backgroundColor:
										"color-mix(in oklch, var(--ui-neutral-fg-muted) 32%, var(--ui-bg, Canvas))",
									"&[data-tentative]": {
										backgroundColor: "var(--ui-bg, Canvas)",
										backgroundImage:
											"repeating-linear-gradient(135deg, transparent 0 4px, color-mix(in oklch, var(--ui-neutral-fg-muted) 32%, transparent) 4px 8px)",
										boxShadow:
											"inset 0 0 0 1px color-mix(in oklch, var(--ui-neutral-fg-muted) 45%, transparent)",
									},
								}),
							]}
						>
							{block.title}
						</span>
					))}
				</div>
			</>
		);
	};
}
