/**
 * An animated feed of events landing one by one, newest on top, with the exception
 * surfaced: checks pass every few minutes and the one that broke names its failing step,
 * feed items arrive, jobs finish. It proves continuous activity without a screenshot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";

import { landingSurface } from "../styles/landing.js";

import { MotionLoop } from "./motion-loop.js";

/** Length of one loop: the rows land, the feed holds, then it empties for the next loop. */
const CYCLE_SECONDS = 10;

/** Percent of the cycle at which the oldest row lands. */
const FIRST_ROW_AT = 6;

/** Most percent of the cycle between one row landing and the next. */
const MAX_ROW_GAP = 14;

/** Percent of the cycle the rows share, so a long feed still leaves time to hold. */
const ROWS_SPAN = 58;

/** Percent of the cycle a landing row takes to open to its full height. */
const EXPAND_SPAN = 3;

/** Percent of the cycle between a row landing and its `flipTo` status replacing the first. */
const FLIP_AFTER = 9;

/** Percent of the cycle the chips take to cross-fade. */
const FLIP_SPAN = 2;

/** Percent of the cycle at which every row fades out for the next loop. */
const RESET_AT = 94;

/** Name of the live dot's pulse, shared by every ticker since it reads no row data. */
const PULSE_KEYFRAMES = "ui-event-ticker-pulse";

/**
 * Room the header keeps at its end for the pause toggle pinned to the surface's top
 * corner, so a title that wraps on a phone stays clear of the button.
 */
const PAUSE_CLEARANCE = "2.75rem";

/** The theme tone each status's chip and dot draw from. */
const STATUS_TONES: Record<EventTicker.Status, string> = {
	ok: "success",
	warn: "warning",
	fail: "danger",
	pending: "neutral",
};

/**
 * Prop types for {@link EventTicker}.
 */
export namespace EventTicker {
	/** Outcome of one event, drawn as a success, warning, danger or neutral chip. */
	export type Status = "ok" | "warn" | "fail" | "pending";

	/** What a row turns into partway through its life, such as a pending job finishing. */
	export interface Flip {
		status: Status;
		/** Quieter line that replaces the row's `detail`. */
		detail?: RemixNode;
		/** Mono line that replaces the row's `code`. */
		code?: string;
	}

	/** One event of the feed. */
	export interface Row {
		/** When it happened, set in mono, such as "09:42". */
		time: string;
		label: RemixNode;
		status: Status;
		/** Quieter line under the label; a failed row tints it in the danger tone. */
		detail?: RemixNode;
		/** The detail set in mono in place of `detail`, such as the failing step's source. */
		code?: string;
		/** The status, and optionally the detail, the row settles on; the finished state shows it. */
		flipTo?: Flip;
	}

	/**
	 * Props accepted by {@link EventTicker}.
	 */
	export interface Props extends Omit<TagProps<"div">, "children" | "title"> {
		/** Accessible name of the feed's list. Required — the library ships no copy. */
		"aria-label": string;
		/** Accessible name of the pause toggle. */
		pauseLabel?: string;
		/** Header line over the feed, drawn beside a live dot. */
		title?: RemixNode;
		/** The events, oldest first; the feed renders them newest first. */
		rows: readonly Row[];
		/** The text of each status chip, such as `{ ok: "Passed", fail: "Failed", … }`. */
		statusLabels: Record<Status, string>;
		/** A note under the feed, such as how often the checks run. */
		footnote?: RemixNode;
	}
}

/**
 * Renders the feed as an ordered list on a raised surface inside a {@link MotionLoop}.
 * Each row opens in its turn at the top and pushes the older ones down; a hidden copy of
 * the finished feed holds the surface's height, so the page never shifts while it loops.
 * Without motion every row shows with its final status. Equal row counts share keyframes.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the ticker's markup.
 * @example
 * <EventTicker
 * 	aria-label="Recent checks"
 * 	title="Checkout flow"
 * 	rows={[{ time: "09:40", label: "Run passed", status: "ok" }]}
 * 	statusLabels={{ ok: "Passed", warn: "Slow", fail: "Failed", pending: "Running" }}
 * />
 */
export function EventTicker(handle: Handle<EventTicker.Props>) {
	return () => {
		let {
			"aria-label": label,
			footnote,
			mix,
			pauseLabel,
			rows,
			statusLabels,
			title,
			...rest
		} = handle.props;
		let timing = timingFor(rows.length);
		let newestFirst = rows.map((row, index) => ({ row, index })).reverse();

		return (
			<MotionLoop {...rest} pauseLabel={pauseLabel} placement="start-end" mix={mix}>
				<div
					data-slot="event-ticker"
					mix={[
						landingSurface(),
						raw({
							display: "grid",
							gap: "0.75rem",
							padding: "clamp(1.25rem, 4cqi, 2rem)",
						}),
						title === undefined ? raw({ paddingBlockStart: "3.25rem" }) : [],
					]}
				>
					{title === undefined ? null : (
						<div
							data-slot="event-ticker-header"
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
									minBlockSize: "2rem",
									paddingInlineEnd: PAUSE_CLEARANCE,
								}),
							]}
						>
							<span aria-hidden="true" mix={[liveDot()]} />
							<span
								mix={[
									raw({
										fontSize: "0.9375rem",
										lineHeight: "1.5rem",
										fontWeight: "600",
										color: "var(--ui-neutral-fg-emphasis)",
										minInlineSize: "0",
									}),
								]}
							>
								{title}
							</span>
						</div>
					)}

					<div mix={[raw({ display: "grid", alignItems: "start" })]}>
						<ol aria-label={label} mix={[list()]}>
							{newestFirst.map(({ row, index }) => (
								<RowItem
									key={index}
									row={row}
									index={index}
									timing={timing}
									statusLabels={statusLabels}
								/>
							))}
						</ol>
						<ol
							aria-hidden="true"
							inert
							data-slot="event-ticker-sizer"
							mix={[
								list(),
								raw({ display: "none", visibility: "hidden" }),
								motionSafe(raw({ display: "grid" })),
							]}
						>
							{newestFirst.map(({ row, index }) => (
								<RowItem key={index} row={row} index={index} statusLabels={statusLabels} />
							))}
						</ol>
					</div>

					{footnote === undefined ? null : (
						<div
							data-slot="event-ticker-footnote"
							mix={[
								quiet(),
								raw({
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									gap: "0.375rem",
									paddingBlockStart: "0.25rem",
								}),
							]}
						>
							{footnote}
						</div>
					)}
				</div>
			</MotionLoop>
		);
	};
}

/** When each row of a feed with a given number of rows lands, in percent of the cycle. */
interface Timing {
	/** Number of rows, which names the keyframes so equal feeds share them. */
	count: number;
	gap: number;
}

/** Spreads `count` rows over {@link ROWS_SPAN}, never further apart than {@link MAX_ROW_GAP}. */
function timingFor(count: number): Timing {
	return { count, gap: count > 0 ? Math.min(MAX_ROW_GAP, ROWS_SPAN / count) : MAX_ROW_GAP };
}

/** Percent of the cycle at which row `index` (counting from the oldest) lands. */
function landsAt(timing: Timing, index: number) {
	return round(FIRST_ROW_AT + index * timing.gap);
}

/** Rounds a keyframe offset to two decimals, so generated stops stay readable. */
function round(value: number) {
	return Math.round(value * 100) / 100;
}

/** The animation declarations every moving element shares: one linear loop of the cycle. */
function loop(name: string) {
	return {
		animationName: name,
		animationDuration: `${CYCLE_SECONDS}s`,
		animationTimingFunction: "linear",
		animationIterationCount: "infinite",
		animationFillMode: "both",
	};
}

/** Props {@link RowItem} reads. */
interface RowItemProps {
	row: EventTicker.Row;
	/** Position in the oldest-first array, which sets when the row lands. */
	index: number;
	/** The feed's timing; omitted for the static copy that sizes the surface. */
	timing?: Timing;
	statusLabels: Record<EventTicker.Status, string>;
}

/**
 * One event: its time, label and status chip over the detail line. A row with `flipTo`
 * stacks both chips and both details in one cell and cross-fades them; at rest only the
 * final pair shows and the first is hidden from assistive technology.
 */
function RowItem(handle: Handle<RowItemProps>) {
	return () => {
		let { index, row, statusLabels, timing } = handle.props;
		let flip = row.flipTo;
		let flipAt = timing ? landsAt(timing, index) + FLIP_AFTER : 0;
		let slot = timing ? `${timing.count}-${index}` : "";
		let finalStatus = flip?.status ?? row.status;

		return (
			<li data-status={finalStatus} mix={[rowShell(timing, index)]}>
				<div mix={[raw({ minBlockSize: "0", overflow: "hidden" })]}>
					<div mix={[rowGrid()]}>
						<time
							mix={[
								quiet(),
								raw({ gridArea: "time", fontFamily: "var(--ui-font-mono)", whiteSpace: "nowrap" }),
							]}
						>
							{row.time}
						</time>
						<span
							mix={[
								raw({
									gridArea: "label",
									minInlineSize: "0",
									fontSize: "0.875rem",
									lineHeight: "1.25rem",
									fontWeight: "500",
									color: "var(--ui-neutral-fg-emphasis)",
									overflowWrap: "anywhere",
								}),
							]}
						>
							{row.label}
						</span>
						<span mix={[stack(), raw({ gridArea: "chip", justifyItems: "end" })]}>
							{flip ? (
								<Chip
									status={row.status}
									label={statusLabels[row.status]}
									hidden
									mix={[fading(`ui-event-ticker-from-${slot}`, timing, flipAt, true)]}
								/>
							) : null}
							<Chip
								status={finalStatus}
								label={statusLabels[finalStatus]}
								mix={[flip ? fading(`ui-event-ticker-to-${slot}`, timing, flipAt, false) : []]}
							/>
						</span>
						<RowDetails row={row} timing={timing} flipAt={flipAt} slot={slot} />
					</div>
				</div>
			</li>
		);
	};
}

/** Props {@link RowDetails} reads. */
interface RowDetailsProps {
	row: EventTicker.Row;
	timing?: Timing;
	flipAt: number;
	/** Count and index that name this row's keyframes. */
	slot: string;
}

/**
 * The row's detail line, or the two lines a `flipTo` with its own detail cross-fades
 * between. A row that has no detail before or after renders nothing.
 */
function RowDetails(handle: Handle<RowDetailsProps>) {
	return () => {
		let { flipAt, row, slot, timing } = handle.props;
		let flip = row.flipTo;
		let flips = flip !== undefined && (flip.detail !== undefined || flip.code !== undefined);
		let before = { status: row.status, detail: row.detail, code: row.code };
		let after = flips && flip ? flip : before;
		let hasBefore = before.detail !== undefined || before.code !== undefined;
		let hasAfter = after.detail !== undefined || after.code !== undefined;
		if (!hasBefore && !hasAfter) return null;
		let finalStatus = flip?.status ?? row.status;

		return (
			<span mix={[stack(), raw({ gridArea: "detail", justifyItems: "start" })]}>
				{flips && hasBefore ? (
					<DetailLine
						status={row.status}
						detail={before.detail}
						code={before.code}
						hidden
						mix={[fading(`ui-event-ticker-detail-from-${slot}`, timing, flipAt, true)]}
					/>
				) : null}
				{hasAfter ? (
					<DetailLine
						status={finalStatus}
						detail={after.detail}
						code={after.code}
						mix={[flips ? fading(`ui-event-ticker-detail-to-${slot}`, timing, flipAt, false) : []]}
					/>
				) : null}
			</span>
		);
	};
}

/** Props {@link DetailLine} reads. */
interface DetailLineProps {
	status: EventTicker.Status;
	detail?: RemixNode;
	code?: string;
	/** Hides the line from assistive technology, for the detail a flip replaces. */
	hidden?: boolean;
	mix?: TagProps<"span">["mix"];
}

/** A quieter line under the label, in mono for `code`, tinted in the danger tone on a failure. */
function DetailLine(handle: Handle<DetailLineProps>) {
	return () => {
		let { code, detail, hidden, mix, status } = handle.props;
		let tint =
			status === "fail"
				? raw({
						paddingInline: "0.5rem",
						paddingBlock: "0.125rem",
						borderRadius: "0.375rem",
						color: "var(--ui-danger-fg-emphasis)",
						backgroundColor: "var(--ui-danger-bg-tint)",
					})
				: [];

		return code !== undefined ? (
			<code
				aria-hidden={hidden ? "true" : undefined}
				mix={[quiet(), layer(), raw({ fontFamily: "var(--ui-font-mono)" }), tint, mix ?? []]}
			>
				{code}
			</code>
		) : (
			<span aria-hidden={hidden ? "true" : undefined} mix={[quiet(), layer(), tint, mix ?? []]}>
				{detail}
			</span>
		);
	};
}

/** The list both the live feed and its sizing copy lay out with. */
function list() {
	return raw({
		gridArea: "1 / 1",
		display: "grid",
		margin: "0",
		padding: "0",
		listStyle: "none",
	});
}

/**
 * A row's collapsible shell, open by default. While animating it stays closed until the
 * row lands, opens to its content's height, holds, and fades out at {@link RESET_AT},
 * closing only once it is invisible.
 */
function rowShell(timing: Timing | undefined, index: number) {
	let shell = raw({ display: "grid", gridTemplateRows: "1fr" });
	if (!timing) return [shell];
	let name = `ui-event-ticker-row-${timing.count}-${index}`;
	let at = landsAt(timing, index);
	let closed = { gridTemplateRows: "0fr", opacity: "0" };
	let open = { gridTemplateRows: "1fr", opacity: "1" };

	return [
		shell,
		keyframes(name, {
			"0%": closed,
			[`${at}%`]: closed,
			[`${round(at + EXPAND_SPAN)}%`]: open,
			[`${RESET_AT}%`]: open,
			[`${RESET_AT + 3}%`]: { gridTemplateRows: "1fr", opacity: "0" },
			"99%": { gridTemplateRows: "1fr", opacity: "0" },
			"100%": closed,
		}),
		motionSafe(raw(loop(name))),
	];
}

/**
 * Cross-fades one of a flip's two stacked layers at `at`: the first layer (`leaving`)
 * shows until then, the second after. At rest the second shows and the first stays hidden.
 */
function fading(name: string, timing: Timing | undefined, at: number, leaving: boolean) {
	let rest = raw({ opacity: leaving ? "0" : "1" });
	if (!timing) return [rest];
	let before = { opacity: leaving ? "1" : "0" };
	let after = { opacity: leaving ? "0" : "1" };

	return [
		rest,
		keyframes(name, {
			"0%": before,
			[`${at}%`]: before,
			[`${round(at + FLIP_SPAN)}%`]: after,
			"99%": after,
			"100%": before,
		}),
		motionSafe(raw(loop(name))),
	];
}

/** A row's grid: time, label and chip on the first line, the detail under the label. */
function rowGrid() {
	return raw({
		display: "grid",
		gridTemplateColumns: "auto minmax(0, 1fr) auto",
		gridTemplateAreas: '"time label chip" ". detail detail"',
		columnGap: "0.75rem",
		rowGap: "0.25rem",
		alignItems: "baseline",
		paddingBlock: "0.625rem",
		borderBlockEnd: "1px solid var(--ui-landing-hairline, var(--ui-neutral-border))",
	});
}

/** Places a layer in its {@link stack}'s one cell. */
function layer() {
	return raw({ gridArea: "layer" });
}

/** A single grid cell its children overlap in, so stacked layers share one box. */
function stack() {
	return raw({ display: "grid", gridTemplateAreas: '"layer"', minInlineSize: "0" });
}

/** The pill a {@link Chip} draws in the tone {@link STATUS_TONES} gives `status`. */
function chip(status: EventTicker.Status) {
	let tone = STATUS_TONES[status];

	return [
		layer(),
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			paddingInline: "0.5rem",
			paddingBlock: "0.125rem",
			borderRadius: "9999px",
			border: `1px solid var(--ui-${tone}-border)`,
			fontSize: "0.75rem",
			lineHeight: "1rem",
			fontWeight: "600",
			whiteSpace: "nowrap",
			color: `var(--ui-${tone}-fg-emphasis)`,
			backgroundColor: `var(--ui-${tone}-bg-tint)`,
		}),
	];
}

/** Props {@link Chip} reads. */
interface ChipProps {
	status: EventTicker.Status;
	label: string;
	/** Hides the chip from assistive technology, for the status a flip replaces. */
	hidden?: boolean;
	mix?: TagProps<"span">["mix"];
}

/** A status chip: a dot in the status's solid tone, then its label. */
function Chip(handle: Handle<ChipProps>) {
	return () => {
		let { hidden, label, mix, status } = handle.props;
		return (
			<span
				data-slot="event-ticker-chip"
				aria-hidden={hidden ? "true" : undefined}
				mix={[chip(status), mix ?? []]}
			>
				<span
					aria-hidden="true"
					mix={[
						raw({
							flexShrink: "0",
							inlineSize: "0.375rem",
							blockSize: "0.375rem",
							borderRadius: "9999px",
							backgroundColor: `var(--ui-${STATUS_TONES[status]}-bg-solid)`,
						}),
					]}
				/>
				{label}
			</span>
		);
	};
}

/** The header's live dot, which pulses while motion runs and holds solid otherwise. */
function liveDot() {
	return [
		keyframes(PULSE_KEYFRAMES, {
			"0%": { boxShadow: "0 0 0 0 var(--ui-success-bg-tint)", opacity: "1" },
			"50%": { boxShadow: "0 0 0 0.3125rem var(--ui-success-bg-tint)", opacity: "0.6" },
			"100%": { boxShadow: "0 0 0 0 var(--ui-success-bg-tint)", opacity: "1" },
		}),
		raw({
			flexShrink: "0",
			inlineSize: "0.5rem",
			blockSize: "0.5rem",
			borderRadius: "9999px",
			backgroundColor: "var(--ui-success-bg-solid)",
		}),
		motionSafe(
			raw({
				animationName: PULSE_KEYFRAMES,
				animationDuration: "2s",
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
			}),
		),
	];
}

/** The quieter ink a row's time and detail, and the footnote, are set in. */
function quiet() {
	return raw({
		fontSize: "0.8125rem",
		lineHeight: "1.25rem",
		color: "var(--ui-neutral-fg-muted)",
		overflowWrap: "anywhere",
	});
}
