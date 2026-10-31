/**
 * An animated picture of one thing serving many: a source sends one pulse down a trunk,
 * a bus carries it to every target, and each target lights in turn, then loops. With
 * `direction="in"` it mirrors to many targets feeding one source, such as regions voting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";

import { marketingSurface } from "../styles/marketing.js";

import { MotionLoop } from "./motion-loop.js";

/** Length of one loop: the pulse travels, every target lights, the outcome holds, then resets. */
const CYCLE_SECONDS = 10;

/** Percent of the cycle at which every lit element goes dark again for the next loop. */
const RESET_AT = 94;

/** Most percent of the cycle between one target lighting and the next. */
const MAX_TARGET_GAP = 9;

/** Percent of the cycle the targets share, so six targets still leave time for the outcome. */
const TARGETS_SPAN = 42;

/** Container the card declares, which the target grid queries to pick its column count. */
const CONTAINER_NAME = "ui-fan-out-diagram";

/** Card content width from which the targets take up to three columns instead of two. */
const WIDE_FROM = "22.5rem";

/** Height of the trunk between the source and the nearest bus. */
const TRUNK = "1.5rem";

/** Height of the stub from a bus down to each target, kept as the target cell's padding. */
const STUB = "1rem";

/** Space between target columns, which each bus segment bridges to meet its neighbour. */
const COLUMN_GAP = "0.75rem";

/** Space between target rows, which the rail spans to link one row's bus to the next. */
const ROW_GAP = "0.5rem";

/** Room at the grid's start edge for the rail that links rows once the targets wrap. */
const RAIL_GUTTER = "0.75rem";

/**
 * Room the card keeps for the pause toggle pinned to its top corner: inline room beside
 * the source on top, or block room above the targets when they sit on top.
 */
const PAUSE_CLEARANCE = "2.75rem";

/** Inline padding of the source row, which with the card padding clears the pause toggle. */
const SOURCE_CLEARANCE = "1.5rem";

/** Inline size of the pulse that travels the trunk. */
const PULSE = "0.5rem";

/**
 * Prop types for {@link FanOutDiagram}.
 */
export namespace FanOutDiagram {
	/** Which way the pulse flows: from the source to every target, or from every target in. */
	export type Direction = "out" | "in";

	/** The one end of the diagram, such as a feed fetch or an incident. */
	export interface Source {
		/** Glyph inside the source's well, drawn in the brand ink. */
		icon?: RemixNode;
		title: RemixNode;
		/** Quieter mono line under the title, such as a URL or a check name. */
		detail?: RemixNode;
	}

	/** One of the many ends, such as a follower's queue or an alert channel. */
	export interface Target {
		/** Glyph before the title. */
		icon?: RemixNode;
		title: RemixNode;
		/** Line that fades in as the target lights, such as "+3 posts". */
		detail?: RemixNode;
	}

	/**
	 * Props accepted by {@link FanOutDiagram}.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Accessible name of the diagram's figure. Required — the library ships no copy. */
		"aria-label": string;
		/** Accessible name of the pause toggle. */
		pauseLabel?: string;
		source: Source;
		/** Two to six targets, laid out in up to three columns. */
		targets: readonly Target[];
		/**
		 * `out` puts the source on top and flows down to the targets; `in` puts the targets
		 * on top and flows down into the source.
		 * @default "out"
		 */
		direction?: Direction;
		/** The result badge that appears once every target lit, such as "Delivered to 4". */
		outcome?: RemixNode;
		/** A note across from the outcome. */
		footnote?: RemixNode;
	}
}

/**
 * Renders the source, its trunk and a list of targets on a raised surface inside a
 * {@link MotionLoop}. Without motion every line shows filled and every target lit, so the
 * static picture is the delivered state. Diagrams of the same shape and direction share keyframes.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the diagram's markup.
 * @example
 * <FanOutDiagram
 * 	aria-label="One fetch, every reader"
 * 	source={{ icon: <RssIcon size={14} />, title: "Feed fetched", detail: "GET /feed.xml" }}
 * 	targets={[{ title: "Ana", detail: "+3 posts" }, { title: "Ben", detail: "+3 posts" }]}
 * 	outcome="Delivered to 2 readers"
 * />
 */
export function FanOutDiagram(handle: Handle<FanOutDiagram.Props>) {
	return () => {
		let {
			"aria-label": label,
			direction = "out",
			footnote,
			mix,
			outcome,
			pauseLabel,
			source,
			targets,
			...rest
		} = handle.props;
		let timing = timingFor(direction, targets.length);
		let narrow = layoutFor(direction, targets.length, Math.min(targets.length, 2));
		let wide = layoutFor(direction, targets.length, Math.min(targets.length, 3));
		let sourceNode = <SourceRow source={source} timing={timing} />;
		let trunk = <Trunk timing={timing} />;

		return (
			<MotionLoop {...rest} pauseLabel={pauseLabel} placement="start-end" mix={mix}>
				<figure
					aria-label={label}
					data-slot="fan-out-diagram"
					data-direction={direction}
					mix={[
						marketingSurface(),
						container(CONTAINER_NAME),
						raw({
							display: "grid",
							gap: "1.5rem",
							margin: "0",
							padding: "clamp(1.25rem, 4cqi, 2rem)",
						}),
						direction === "in" ? raw({ paddingBlockStart: PAUSE_CLEARANCE }) : [],
					]}
				>
					<div mix={[raw({ display: "grid", minInlineSize: "0" })]}>
						{direction === "out" ? sourceNode : null}
						{direction === "out" ? trunk : null}
						<ul
							data-slot="fan-out-diagram-targets"
							mix={[
								raw({
									"--ui-fan-cols-n": `repeat(${narrow.columns}, minmax(0, 1fr))`,
									"--ui-fan-cols-w": `repeat(${wide.columns}, minmax(0, 1fr))`,
									"--ui-fan-gutter-n": narrow.rows > 1 ? RAIL_GUTTER : "0px",
									"--ui-fan-gutter-w": wide.rows > 1 ? RAIL_GUTTER : "0px",
									display: "grid",
									columnGap: COLUMN_GAP,
									rowGap: ROW_GAP,
									margin: "0",
									padding: "0",
									listStyle: "none",
								}),
								responsive({
									gridTemplateColumns: "var(--ui-fan-cols-n)",
									paddingInlineStart: "var(--ui-fan-gutter-n)",
								}),
							]}
						>
							{targets.map((target, index) => (
								<TargetCell
									key={index}
									target={target}
									index={index}
									timing={timing}
									narrow={narrow.cells[index]!}
									wide={wide.cells[index]!}
									narrowWraps={narrow.rows > 1}
									wideWraps={wide.rows > 1}
								/>
							))}
						</ul>
						{direction === "in" ? trunk : null}
						{direction === "in" ? sourceNode : null}
					</div>

					{outcome === undefined && footnote === undefined ? null : (
						<div
							data-slot="fan-out-diagram-footer"
							mix={[
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "0.75rem",
									paddingBlockStart: "1.25rem",
									borderBlockStart:
										"1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))",
								}),
							]}
						>
							{outcome === undefined ? null : (
								<span data-slot="fan-out-diagram-outcome" mix={[outcomeBadge(timing)]}>
									<CheckIcon size={14} strokeWidth={2.5} aria-hidden="true" />
									{outcome}
								</span>
							)}
							{footnote === undefined ? null : (
								<span
									data-slot="fan-out-diagram-footnote"
									mix={[
										detail(),
										raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" }),
										appearsWithOutcome(timing),
									]}
								>
									{footnote}
								</span>
							)}
						</div>
					)}
				</figure>
			</MotionLoop>
		);
	};
}

/**
 * Applies `narrowStyles`, whose values read `-n` custom properties, and the same
 * declarations reading `-w` properties once the card is wide. Every element writes its own
 * values into those properties, so the two rules stay identical for every diagram.
 */
function responsive(narrowStyles: Record<string, string>) {
	let wideStyles: Record<string, string> = {};
	for (let [property, value] of Object.entries(narrowStyles)) {
		wideStyles[property] = value.replaceAll("-n)", "-w)");
	}
	return [raw(narrowStyles), at(WIDE_FROM, CONTAINER_NAME, raw(wideStyles))];
}

/** Where one target sits for one column count, and which lines it draws there. */
interface Cell {
	/** One-based grid row. */
	row: number;
	/** One-based grid column. */
	column: number;
	/** Whether the cell starts its row, so its bus begins at the rail or its own centre. */
	rowStart: boolean;
	/** Whether the cell ends its row, so its bus stops at its own centre. */
	rowEnd: boolean;
	/** Whether the cell draws the rail that links its row's bus to the next row's. */
	rail: boolean;
}

/** The grid one column count gives a set of targets. */
interface Layout {
	columns: number;
	rows: number;
	cells: Cell[];
}

/**
 * Places `count` targets in `columns` columns. The row nearest the source is always full,
 * so the trunk meets its bus: flowing out a short row goes last, flowing in it goes first.
 * Once there are several rows, a rail in the start gutter links every row's bus.
 */
function layoutFor(direction: FanOutDiagram.Direction, count: number, columns: number): Layout {
	let safeColumns = Math.max(columns, 1);
	let rows = Math.ceil(count / safeColumns);
	let short = direction === "in" ? count % safeColumns : 0;
	let place = (index: number) => {
		if (index < short) return { row: 0, column: index };
		let offset = index - short;
		return {
			row: (short > 0 ? 1 : 0) + Math.floor(offset / safeColumns),
			column: offset % safeColumns,
		};
	};
	let cells: Cell[] = [];
	for (let index = 0; index < count; index++) {
		let { row, column } = place(index);
		let next = index + 1 < count ? place(index + 1) : undefined;
		let linked = direction === "out" ? row < rows - 1 : row > 0;
		cells.push({
			row: row + 1,
			column: column + 1,
			rowStart: column === 0,
			rowEnd: next === undefined || next.row !== row,
			rail: column === 0 && linked,
		});
	}
	return { columns: safeColumns, rows, cells };
}

/** Where a cell's bus segment starts and ends, as inline insets from the cell's edges. */
function busInsets(cell: Cell, wraps: boolean) {
	let center = "calc(50% - 1px)";
	let bridge = `calc(${COLUMN_GAP} / -2)`;
	let end = cell.rowEnd ? center : bridge;
	if (!cell.rowStart) return { start: bridge, end };
	return { start: wraps ? `calc(${RAIL_GUTTER} / -2 - 1px)` : center, end };
}

/** When each element of a diagram lights, in percent of the cycle. */
interface Timing {
	direction: FanOutDiagram.Direction;
	/** Number of targets, which with the direction names the keyframes. */
	count: number;
	/** Percent of the cycle at which the first target lights. */
	first: number;
	/** Percent of the cycle between one target lighting and the next. */
	gap: number;
	trunkFrom: number;
	trunkTo: number;
	busFrom: number;
	busTo: number;
	/** Percent of the cycle at which the source lights. */
	sourceAt: number;
	outcomeAt: number;
}

/**
 * Lays out one cycle. Flowing out, the pulse runs the trunk, the buses fill, then each
 * stub and target lights in turn. Flowing in, the targets light first, their stubs and
 * the buses fill, and the pulse runs the trunk into the source last.
 */
function timingFor(direction: FanOutDiagram.Direction, count: number): Timing {
	let gap = count > 0 ? Math.min(MAX_TARGET_GAP, TARGETS_SPAN / count) : MAX_TARGET_GAP;
	if (direction === "out") {
		let last = 24 + Math.max(count - 1, 0) * gap;
		return {
			direction,
			count,
			first: 24,
			gap,
			trunkFrom: 2,
			trunkTo: 12,
			busFrom: 12,
			busTo: 18,
			sourceAt: 2,
			outcomeAt: last + 8,
		};
	}
	let last = 8 + Math.max(count - 1, 0) * gap;
	return {
		direction,
		count,
		first: 8,
		gap,
		trunkFrom: last + 10,
		trunkTo: last + 20,
		busFrom: last + 4,
		busTo: last + 10,
		sourceAt: last + 20,
		outcomeAt: last + 24,
	};
}

/** Percent of the cycle at which target `index` lights. */
function lightsAt(timing: Timing, index: number) {
	return timing.first + index * timing.gap;
}

/** The keyframe name of one part, unique per direction and count, and per index when given. */
function frameName(timing: Timing, part: string, index?: number) {
	let base = `ui-fan-out-diagram-${timing.direction}-${part}-${timing.count}`;
	return index === undefined ? base : `${base}-${index}`;
}

/** The animation declarations every lit element shares: one linear loop of the cycle. */
function loop(name: string) {
	return {
		animationName: name,
		animationDuration: `${CYCLE_SECONDS}s`,
		animationTimingFunction: "linear",
		animationIterationCount: "infinite",
		animationFillMode: "both",
	};
}

/**
 * Keyframe stops that hold `off` until `at`, switch to `on`, and go back to `off` at
 * {@link RESET_AT}, so every element of the diagram resets together.
 */
function litFrames(at: number, off: Record<string, string>, on: Record<string, string>) {
	return {
		"0%": off,
		[`${at - 1}%`]: off,
		[`${at}%`]: on,
		[`${RESET_AT}%`]: on,
		[`${RESET_AT + 2}%`]: off,
		"100%": off,
	};
}

/** A line's fill, full by default and grown from `from` to `to` while the diagram animates. */
function fill(name: string, axis: "X" | "Y", from: number, to: number, origin: string) {
	let empty = { transform: `scale${axis}(0)` };
	let full = { transform: `scale${axis}(1)` };
	return [
		keyframes(name, {
			"0%": empty,
			[`${from}%`]: empty,
			[`${to}%`]: full,
			[`${RESET_AT}%`]: full,
			[`${RESET_AT + 2}%`]: empty,
			"100%": empty,
		}),
		raw({
			position: "absolute",
			inset: "0",
			backgroundColor: "var(--ui-success-bg-solid)",
			transformOrigin: origin,
		}),
		motionSafe(raw(loop(name))),
	];
}

/** Props {@link Line} reads. */
interface LineProps {
	/** Placement and size of the unfilled track. */
	track: ReturnType<typeof raw>[];
	/** The fill's mixins, from {@link fill}. */
	filled: ReturnType<typeof fill>;
	/** Identifies the line in tests and devtools. */
	slot: string;
}

/** A neutral track with a success fill drawn over it. */
function Line(handle: Handle<LineProps>) {
	return () => {
		let { filled, slot, track } = handle.props;
		return (
			<span
				aria-hidden="true"
				data-slot={slot}
				mix={[...track, raw({ backgroundColor: "var(--ui-neutral-border)" })]}
			>
				<span mix={filled} />
			</span>
		);
	};
}

/** Props {@link SourceRow} reads. */
interface SourceRowProps {
	source: FanOutDiagram.Source;
	timing: Timing;
}

/** The source card, centred on the trunk, its text kept clear of the pause toggle. */
function SourceRow(handle: Handle<SourceRowProps>) {
	return () => {
		let { source, timing } = handle.props;
		let name = frameName(timing, "source");
		let on = { borderColor: "var(--ui-brand-border)" };
		let off = { borderColor: "var(--ui-neutral-border)" };

		return (
			<div
				data-slot="fan-out-diagram-source-row"
				mix={[
					raw({
						display: "grid",
						justifyItems: "center",
						paddingInline: timing.direction === "out" ? SOURCE_CLEARANCE : "0",
						minInlineSize: "0",
					}),
				]}
			>
				<div
					data-slot="fan-out-diagram-source"
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.75rem",
							maxInlineSize: "100%",
							minInlineSize: "0",
							paddingBlock: "0.625rem",
							paddingInline: "0.875rem",
							border: "1px solid",
							borderRadius: "0.75rem",
							backgroundColor: "var(--ui-bg)",
							...on,
						}),
						timing.direction === "in"
							? [keyframes(name, litFrames(timing.sourceAt, off, on)), motionSafe(raw(loop(name)))]
							: [],
					]}
				>
					{source.icon === undefined ? null : (
						<span
							aria-hidden="true"
							mix={[
								raw({
									display: "grid",
									placeItems: "center",
									flexShrink: "0",
									inlineSize: "1.75rem",
									blockSize: "1.75rem",
									borderRadius: "9999px",
									color: "var(--ui-brand-fg)",
									backgroundColor: "var(--ui-brand-bg-tint)",
								}),
							]}
						>
							{source.icon}
						</span>
					)}
					<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
						<span mix={[caption()]}>{source.title}</span>
						{source.detail === undefined ? null : (
							<code mix={[detail(), raw({ fontFamily: "var(--ui-font-mono)" })]}>
								{source.detail}
							</code>
						)}
					</span>
				</div>
			</div>
		);
	};
}

/** Props {@link Trunk} reads. */
interface TrunkProps {
	timing: Timing;
}

/** The line between the source and the nearest bus, which the pulse travels down. */
function Trunk(handle: Handle<TrunkProps>) {
	return () => {
		let { timing } = handle.props;
		let pulse = frameName(timing, "pulse");
		let hidden = { opacity: "0", transform: "translateY(0)" };
		let start = { opacity: "1", transform: "translateY(0)" };
		let end = { opacity: "1", transform: `translateY(${TRUNK})` };

		return (
			<span
				aria-hidden="true"
				data-slot="fan-out-diagram-trunk"
				mix={[
					raw({
						position: "relative",
						justifySelf: "center",
						inlineSize: "2px",
						blockSize: TRUNK,
						backgroundColor: "var(--ui-neutral-border)",
					}),
				]}
			>
				<span
					mix={fill(frameName(timing, "trunk"), "Y", timing.trunkFrom, timing.trunkTo, "top")}
				/>
				<span
					mix={[
						keyframes(pulse, {
							"0%": hidden,
							[`${timing.trunkFrom - 1}%`]: hidden,
							[`${timing.trunkFrom}%`]: start,
							[`${timing.trunkTo}%`]: end,
							[`${timing.trunkTo + 1}%`]: { ...end, opacity: "0" },
							"100%": { ...end, opacity: "0" },
						}),
						raw({
							position: "absolute",
							insetBlockStart: `calc(${PULSE} / -2)`,
							insetInlineStart: `calc(1px - ${PULSE} / 2)`,
							inlineSize: PULSE,
							blockSize: PULSE,
							borderRadius: "9999px",
							backgroundColor: "var(--ui-brand-bg-solid)",
							boxShadow: "0 0 0 3px var(--ui-brand-bg-tint)",
							opacity: "0",
						}),
						motionSafe(raw(loop(pulse))),
					]}
				/>
			</span>
		);
	};
}

/** Props {@link TargetCell} reads. */
interface TargetCellProps {
	target: FanOutDiagram.Target;
	index: number;
	timing: Timing;
	/** Where the cell sits while the card is narrow. */
	narrow: Cell;
	/** Where the cell sits once the card is wide. */
	wide: Cell;
	/** Whether the targets take several rows while the card is narrow. */
	narrowWraps: boolean;
	/** Whether the targets take several rows once the card is wide. */
	wideWraps: boolean;
}

/**
 * One target's grid cell: its bus segment along the edge facing the source, a stub from
 * that bus to the chip, and the rail when it links rows. The stub is the cell's padding,
 * so it meets the chip however the grid wraps or the chip's text grows.
 */
function TargetCell(handle: Handle<TargetCellProps>) {
	return () => {
		let { index, narrow, narrowWraps, target, timing, wide, wideWraps } = handle.props;
		let isOut = timing.direction === "out";
		let narrowBus = busInsets(narrow, narrowWraps);
		let wideBus = busInsets(wide, wideWraps);
		let at = lightsAt(timing, index);
		let stubFrom = isOut ? at - 4 : at;
		let stubTo = isOut ? at : at + 4;
		let edge = isOut ? "insetBlockStart" : "insetBlockEnd";
		let chipName = frameName(timing, "chip", index);
		let on = { borderColor: "var(--ui-brand-border)" };
		let off = { borderColor: "var(--ui-neutral-border)" };

		return (
			<li
				data-slot="fan-out-diagram-target"
				mix={[
					raw({
						"--ui-fan-row-n": String(narrow.row),
						"--ui-fan-row-w": String(wide.row),
						"--ui-fan-col-n": String(narrow.column),
						"--ui-fan-col-w": String(wide.column),
						"--ui-fan-bus-start-n": narrowBus.start,
						"--ui-fan-bus-start-w": wideBus.start,
						"--ui-fan-bus-end-n": narrowBus.end,
						"--ui-fan-bus-end-w": wideBus.end,
						"--ui-fan-rail-n": narrow.rail ? "block" : "none",
						"--ui-fan-rail-w": wide.rail ? "block" : "none",
						position: "relative",
						display: "grid",
						minInlineSize: "0",
						[isOut ? "paddingBlockStart" : "paddingBlockEnd"]: STUB,
					}),
					responsive({ gridRow: "var(--ui-fan-row-n)", gridColumn: "var(--ui-fan-col-n)" }),
				]}
			>
				<Line
					slot="fan-out-diagram-bus"
					track={[
						raw({ position: "absolute", [edge]: "0", blockSize: "2px" }),
						...responsive({
							insetInlineStart: "var(--ui-fan-bus-start-n)",
							insetInlineEnd: "var(--ui-fan-bus-end-n)",
						}),
					]}
					filled={fill(frameName(timing, "bus"), "X", timing.busFrom, timing.busTo, "center")}
				/>
				<Line
					slot="fan-out-diagram-rail"
					track={[
						raw({
							position: "absolute",
							insetInlineStart: `calc(${RAIL_GUTTER} / -2 - 1px)`,
							inlineSize: "2px",
							insetBlockStart: isOut ? "0" : `calc(-1 * ${ROW_GAP})`,
							insetBlockEnd: isOut ? `calc(-1 * ${ROW_GAP})` : "0",
						}),
						...responsive({ display: "var(--ui-fan-rail-n)" }),
					]}
					filled={fill(frameName(timing, "rail"), "Y", timing.busFrom, timing.busTo, "top")}
				/>
				<Line
					slot="fan-out-diagram-stub"
					track={[
						raw({
							position: "absolute",
							[edge]: "0",
							insetInlineStart: "calc(50% - 1px)",
							inlineSize: "2px",
							blockSize: STUB,
						}),
					]}
					filled={fill(frameName(timing, "stub", index), "Y", stubFrom, stubTo, "top")}
				/>
				<div
					data-slot="fan-out-diagram-chip"
					mix={[
						keyframes(chipName, litFrames(at, off, on)),
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr) auto",
							alignItems: "start",
							columnGap: "0.375rem",
							minInlineSize: "0",
							paddingBlock: "0.5rem",
							paddingInline: "0.625rem",
							border: "1px solid",
							borderRadius: "0.625rem",
							backgroundColor: "var(--ui-bg)",
							...on,
						}),
						motionSafe(raw(loop(chipName))),
					]}
				>
					<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
						<span
							mix={[
								caption(),
								raw({ display: "flex", alignItems: "center", gap: "0.375rem", minInlineSize: "0" }),
							]}
						>
							{target.icon === undefined ? null : (
								<span
									aria-hidden="true"
									mix={[
										raw({ display: "inline-flex", flexShrink: "0", color: "var(--ui-brand-fg)" }),
									]}
								>
									{target.icon}
								</span>
							)}
							<span mix={[raw({ minInlineSize: "0", overflowWrap: "anywhere" })]}>
								{target.title}
							</span>
						</span>
						{target.detail === undefined ? null : (
							<span mix={[detail(), lightsIn(frameName(timing, "detail", index), at)]}>
								{target.detail}
							</span>
						)}
					</span>
					<CheckIcon
						size={14}
						strokeWidth={2.5}
						aria-hidden="true"
						mix={[
							raw({ marginBlockStart: "0.125rem", color: "var(--ui-success-fg)" }),
							lightsIn(frameName(timing, "check", index), at),
						]}
					/>
				</div>
			</li>
		);
	};
}

/** Fades an element in when its target lights. */
function lightsIn(name: string, at: number) {
	return [
		keyframes(name, litFrames(at, { opacity: "0" }, { opacity: "1" })),
		motionSafe(raw(loop(name))),
	];
}

/** The outcome badge, which appears once the last target lit. */
function outcomeBadge(timing: Timing) {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			paddingInline: "0.625rem",
			paddingBlock: "0.25rem",
			borderRadius: "9999px",
			fontSize: "0.8125rem",
			fontWeight: "600",
			color: "var(--ui-success-fg)",
			backgroundColor: "var(--ui-success-bg-tint)",
		}),
		appearsWithOutcome(timing),
	];
}

/** Shows an element when the outcome appears, rising slightly into place. */
function appearsWithOutcome(timing: Timing) {
	let name = frameName(timing, "outcome");
	return [
		keyframes(
			name,
			litFrames(
				timing.outcomeAt,
				{ opacity: "0", transform: "translateY(4px)" },
				{ opacity: "1", transform: "none" },
			),
		),
		motionSafe(raw(loop(name))),
	];
}

/** A caption in the heading ink. */
function caption() {
	return raw({
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		fontWeight: "600",
		color: "var(--ui-neutral-fg-emphasis)",
		overflowWrap: "anywhere",
	});
}

/** The quieter line under a caption, and the footnote. */
function detail() {
	return raw({
		fontSize: "0.8125rem",
		lineHeight: "1.25rem",
		color: "var(--ui-neutral-fg-muted)",
		overflowWrap: "anywhere",
	});
}
