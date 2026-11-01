/**
 * An animated figure for a measured claim: a headline number counts up from zero and a
 * bar or line chart draws in beside it, holds, then loops. It shows the measurement itself,
 * such as how often feeds are really checked or a month of response times.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";

import { landingSurface } from "../styles/landing.js";

import { MotionLoop } from "./motion-loop.js";

/** Length of one loop: the figure draws, holds the finished chart, then resets. */
const CYCLE_SECONDS = 10;

/** Percent of the cycle at which every drawn element returns to empty for the next loop. */
const RESET_AT = 94;

/** Percent of the cycle the headline number starts counting at. */
const COUNT_FROM = 6;

/** Percent of the cycle the headline number reaches its value at. */
const COUNT_TO = 46;

/** Frames the count passes through on its way up; each is a precomputed, formatted number. */
const COUNT_STEPS = 24;

/** Percent of the cycle the first bar, or the line, starts drawing at. */
const DRAW_FROM = 10;

/** Percent of the cycle one bar takes to grow to its value. */
const BAR_GROW = 18;

/** Percent of the cycle the bars' start times spread over, so a long series still holds. */
const BAR_STAGGER_SPAN = 30;

/** Most percent of the cycle between one bar starting and the next. */
const MAX_BAR_GAP = 6;

/** Percent of the cycle the line takes to draw from its first point to its last. */
const LINE_DRAW = 40;

/**
 * The line's reveal, from nothing to the whole plot. It wipes from the first point to the
 * last, which on a chart read left to right is the line stroking in; the outsets keep the
 * stroke's round caps and the peaks at the plot's edge uncut.
 */
const HIDDEN_CLIP = "inset(-0.5rem 100% -0.5rem -0.5rem)";

/** The line's reveal at rest: the whole plot, plus the outset for the stroke. */
const SHOWN_CLIP = "inset(-0.5rem -0.5rem -0.5rem -0.5rem)";

/** Height of the line chart's plot, which the SVG stretches to fill. */
const LINE_HEIGHT = "7.5rem";

/** Size of a point on the line; the highlighted point is drawn larger. */
const POINT = "0.5rem";

/** Easing a bar's growth starts with, so it lands softly on its value. */
const GROW_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";

/**
 * Room the first text line keeps at its end for the pause toggle pinned to the surface's
 * top corner, so a label that wraps on a phone stays clear of the button.
 */
const PAUSE_CLEARANCE = "2.75rem";

/** Locale the headline number formats in when `metric.locale` is omitted. */
const DEFAULT_LOCALE = "en-US";

/**
 * Prop types for {@link DrawnChart}.
 */
export namespace DrawnChart {
	/** How the chart draws its series. */
	export type Variant = "bars" | "line";

	/** The headline number above the chart. */
	export interface Metric {
		/** The measured value; an integer counts up from zero, any other number shows as is. */
		value: number;
		/** Number formatting, such as `{ maximumFractionDigits: 1 }`; also applied to every counted frame. */
		format?: Intl.NumberFormatOptions;
		/** Locale the number formats in. Defaults to `"en-US"`. */
		locale?: string;
		/** What the number measures, set under it. */
		label: RemixNode;
		/** Text drawn before the number, such as `"$"`. */
		prefix?: string;
		/** Text drawn after the number, such as `"%"` or `" ms"`. */
		suffix?: string;
	}

	/** One measured point of the series. */
	export interface Datum {
		/** A bar's label, or a point's label under the line; keep it short for the line. */
		label: RemixNode;
		value: number;
		/** The value as shown, such as `"14 min"`; defaults to the bare number. */
		display?: RemixNode;
	}

	/**
	 * Props accepted by {@link DrawnChart}.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Accessible name of the chart: the bars' list, or the line's image. Required. */
		"aria-label": string;
		/** Accessible name of the pause toggle. */
		pauseLabel?: string;
		metric?: Metric;
		/** Defaults to `"bars"`, drawn horizontally so labels read on a phone. */
		variant?: Variant;
		series: readonly Datum[];
		/** Value a full bar, or the top of the plot, stands for. Defaults to the series' largest value. */
		max?: number;
		/** Index of the one datum drawn in the brand colour. */
		highlight?: number;
		/** A note under the chart, such as the period or the source of the numbers. */
		footnote?: RemixNode;
	}
}

/**
 * Renders the figure on a raised surface inside a {@link MotionLoop}. The markup is the
 * finished figure: full bars or line and the real formatted number, which is what reduced
 * motion and assistive technology get. Charts with the same series length share keyframes.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the figure's markup.
 * @example
 * <DrawnChart
 * 	aria-label="Median time between checks, by how often a feed posts"
 * 	metric={{ value: 15, suffix: " min", label: "Between checks of an hourly feed" }}
 * 	series={[{ label: "Hourly", value: 15, display: "15 min" }, { label: "Daily", value: 240, display: "4 h" }]}
 * 	highlight={0}
 * />
 */
export function DrawnChart(handle: Handle<DrawnChart.Props>) {
	return () => {
		let {
			"aria-label": label,
			footnote,
			highlight,
			max,
			metric,
			mix,
			pauseLabel,
			series,
			variant,
			...rest
		} = handle.props;
		let scale = max ?? Math.max(0, ...series.map((datum) => datum.value));
		let chart =
			(variant ?? "bars") === "line" ? (
				<LineChart label={label} series={series} scale={scale} highlight={highlight} />
			) : (
				<BarChart
					label={label}
					series={series}
					scale={scale}
					highlight={highlight}
					clearance={metric === undefined}
				/>
			);

		return (
			<MotionLoop {...rest} pauseLabel={pauseLabel} placement="start-end" mix={mix}>
				<div
					data-slot="drawn-chart"
					mix={[
						landingSurface(),
						raw({ display: "grid", gap: "1.5rem", padding: "clamp(1.25rem, 4cqi, 2rem)" }),
					]}
				>
					{metric ? <Headline metric={metric} /> : null}
					{chart}
					{footnote ? (
						<p
							data-slot="drawn-chart-footnote"
							mix={[
								small(),
								raw({
									margin: "0",
									paddingBlockStart: "1rem",
									borderBlockStart:
										"1px solid var(--ui-landing-hairline, var(--ui-neutral-border))",
								}),
							]}
						>
							{footnote}
						</p>
					) : null}
				</div>
			</MotionLoop>
		);
	};
}

/** Props {@link Headline} reads. */
interface HeadlineProps {
	metric: DrawnChart.Metric;
}

/**
 * The large number over its label. An integer value also gets a decorative counter whose
 * `::before` steps through precomputed formatted frames while motion is allowed; the real
 * number stays in the DOM as text, only visually hidden while the counter shows.
 */
function Headline(handle: Handle<HeadlineProps>) {
	return () => {
		let { metric } = handle.props;
		let text = formatMetric(metric, metric.value);
		let counts = Number.isInteger(metric.value) && metric.value !== 0;

		return (
			<div
				data-slot="drawn-chart-metric"
				mix={[raw({ display: "grid", gap: "0.25rem", paddingInlineEnd: PAUSE_CLEARANCE })]}
			>
				<p
					data-slot="drawn-chart-number"
					mix={[
						raw({
							position: "relative",
							margin: "0",
							fontSize: "clamp(2.25rem, 10cqi, 3.25rem)",
							lineHeight: "1.05",
							fontWeight: "700",
							letterSpacing: "-0.02em",
							fontVariantNumeric: "tabular-nums",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{counts ? <Counter metric={metric} text={text} /> : null}
					<span
						data-slot="drawn-chart-number-text"
						mix={[counts ? motionSafe(visuallyHidden()) : []]}
					>
						{text}
					</span>
				</p>
				<p mix={[small(), raw({ margin: "0" })]}>{metric.label}</p>
			</div>
		);
	};
}

/** Props {@link Counter} reads. */
interface CounterProps {
	metric: DrawnChart.Metric;
	/** The finished, formatted number, which the counter rests on between frames. */
	text: string;
}

/**
 * The counting number, drawn only by a pseudo-element and hidden from assistive technology.
 * Its resting content is the finished number, so a browser that skips animating `content`
 * still shows the right value.
 */
function Counter(handle: Handle<CounterProps>) {
	return () => {
		let { metric, text } = handle.props;
		let frames = countFrames(metric);
		let name = `ui-drawn-chart-count-${hash(
			Object.values(frames)
				.map((frame) => frame.content)
				.join("|"),
		)}`;

		return (
			<span
				aria-hidden="true"
				data-slot="drawn-chart-count"
				mix={[
					keyframes(name, frames),
					raw({ display: "none" }),
					motionSafe(
						raw({
							display: "inline",
							"&::before": {
								content: cssString(text),
								...loop(name),
								animationTimingFunction: "step-end",
							},
						}),
					),
				]}
			/>
		);
	};
}

/**
 * Keyframe stops for the count: zero until {@link COUNT_FROM}, then {@link COUNT_STEPS}
 * eased-out frames up to the value, held until {@link RESET_AT}. Each stop's `content` is
 * the frame already formatted with the metric's prefix, suffix and number format.
 */
function countFrames(metric: DrawnChart.Metric): Record<string, { content: string }> {
	let frame = (value: number) => ({ content: cssString(formatMetric(metric, value)) });
	let frames: Record<string, { content: string }> = { "0%": frame(0) };
	for (let step = 0; step <= COUNT_STEPS; step++) {
		let progress = step / COUNT_STEPS;
		let eased = 1 - (1 - progress) ** 3;
		frames[percent(COUNT_FROM + (COUNT_TO - COUNT_FROM) * progress)] = frame(
			Math.round(metric.value * eased),
		);
	}
	frames[`${RESET_AT}%`] = frame(metric.value);
	frames["100%"] = frame(0);
	return frames;
}

/** The metric's value, or one counted frame of it, with its prefix and suffix. */
function formatMetric(metric: DrawnChart.Metric, value: number) {
	let number = new Intl.NumberFormat(metric.locale ?? DEFAULT_LOCALE, metric.format).format(value);
	return `${metric.prefix ?? ""}${number}${metric.suffix ?? ""}`;
}

/** `text` as a quoted CSS string, safe for the `content` property. */
function cssString(text: string) {
	return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** A short, stable name fragment for a set of frames, so different metrics never share keyframes. */
function hash(text: string) {
	let value = 5381;
	for (let index = 0; index < text.length; index++) {
		value = (Math.imul(value, 33) ^ text.charCodeAt(index)) >>> 0;
	}
	return value.toString(36);
}

/** A keyframe stop key, rounded so computed offsets stay readable in the stylesheet. */
function percent(value: number) {
	return `${Math.round(value * 100) / 100}%`;
}

/** Share of the scale `value` fills, in percent and clamped to the track. */
function share(value: number, scale: number) {
	return scale > 0 ? Math.min(100, Math.max(0, (value / scale) * 100)) : 0;
}

/** Props both chart variants read. */
interface ChartProps {
	label: string;
	series: readonly DrawnChart.Datum[];
	/** The value a full bar or the top of the plot stands for. */
	scale: number;
	highlight?: number;
}

/** Props {@link BarChart} reads. */
interface BarChartProps extends ChartProps {
	/** Keeps the first row's text clear of the pause toggle when no metric sits above it. */
	clearance: boolean;
}

/**
 * The series as a named list of horizontal bars: each row's label and value over a track
 * whose fill is the value's share of the scale. Each fill grows from zero in turn.
 */
function BarChart(handle: Handle<BarChartProps>) {
	return () => {
		let { clearance, highlight, label, scale, series } = handle.props;
		let gap = series.length > 0 ? Math.min(MAX_BAR_GAP, BAR_STAGGER_SPAN / series.length) : 0;

		return (
			<ol
				aria-label={label}
				data-slot="drawn-chart-bars"
				mix={[
					raw({ display: "grid", gap: "0.875rem", margin: "0", padding: "0", listStyle: "none" }),
				]}
			>
				{series.map((datum, index) => {
					let lit = index === highlight;
					let name = `ui-drawn-chart-bar-${series.length}-${index}`;
					let start = DRAW_FROM + index * gap;
					return (
						<li key={index} mix={[raw({ display: "grid", gap: "0.375rem" })]}>
							<span
								mix={[
									raw({
										display: "flex",
										justifyContent: "space-between",
										alignItems: "baseline",
										gap: "0.75rem",
									}),
									clearance && index === 0 ? raw({ paddingInlineEnd: PAUSE_CLEARANCE }) : [],
								]}
							>
								<span mix={[caption(lit)]}>{datum.label}</span>
								<span
									mix={[caption(lit), raw({ flexShrink: "0", fontVariantNumeric: "tabular-nums" })]}
								>
									{datum.display ?? datum.value}
								</span>
							</span>
							<span
								aria-hidden="true"
								mix={[
									raw({
										display: "block",
										blockSize: "0.5rem",
										borderRadius: "9999px",
										backgroundColor: "var(--ui-neutral-bg-tint)",
										overflow: "hidden",
									}),
								]}
							>
								<span
									data-slot="drawn-chart-bar"
									style={{ inlineSize: `${share(datum.value, scale)}%` }}
									mix={[
										keyframes(name, {
											"0%": { transform: "scaleX(0)" },
											[percent(start)]: {
												transform: "scaleX(0)",
												animationTimingFunction: GROW_EASING,
											},
											[percent(start + BAR_GROW)]: { transform: "scaleX(1)" },
											[`${RESET_AT}%`]: { transform: "scaleX(1)" },
											[`${RESET_AT + 2}%`]: { transform: "scaleX(0)" },
											"100%": { transform: "scaleX(0)" },
										}),
										raw({
											display: "block",
											blockSize: "100%",
											borderRadius: "inherit",
											backgroundColor: lit
												? "var(--ui-brand-bg-solid)"
												: "var(--ui-neutral-fg-muted)",
											transformOrigin: "left center",
											"&:dir(rtl)": { transformOrigin: "right center" },
										}),
										motionSafe(raw(loop(name))),
									]}
								/>
							</span>
						</li>
					);
				})}
			</ol>
		);
	};
}

/**
 * The series as a line drawn in from its first point, each point appearing as the line
 * reaches it, with short labels under the plot. The SVG is a named image; a visually
 * hidden list carries every label and value for assistive technology.
 */
function LineChart(handle: Handle<ChartProps>) {
	return () => {
		let { highlight, label, scale, series } = handle.props;
		let count = series.length;
		let points = series.map((datum, index) => ({
			x: count > 1 ? (index / (count - 1)) * 100 : 50,
			y: 100 - share(datum.value, scale),
		}));
		let path = points
			.map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`)
			.join(" ");
		let lineName = `ui-drawn-chart-line-${count}`;

		return (
			<div data-slot="drawn-chart-line" mix={[raw({ display: "grid", gap: "0.625rem" })]}>
				<div
					mix={[
						raw({
							position: "relative",
							blockSize: LINE_HEIGHT,
							marginInline: `calc(${POINT} / 2)`,
							borderBlockEnd: "1px solid var(--ui-landing-hairline, var(--ui-neutral-border))",
						}),
					]}
				>
					<svg
						role="img"
						aria-label={label}
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						data-slot="drawn-chart-plot"
						mix={[
							keyframes(lineName, {
								"0%": { clipPath: HIDDEN_CLIP },
								[`${DRAW_FROM}%`]: { clipPath: HIDDEN_CLIP },
								[`${DRAW_FROM + LINE_DRAW}%`]: { clipPath: SHOWN_CLIP },
								[`${RESET_AT}%`]: { clipPath: SHOWN_CLIP },
								[`${RESET_AT + 2}%`]: { clipPath: HIDDEN_CLIP },
								"100%": { clipPath: HIDDEN_CLIP },
							}),
							raw({
								display: "block",
								inlineSize: "100%",
								blockSize: "100%",
								overflow: "visible",
							}),
							motionSafe(raw(loop(lineName))),
						]}
					>
						<path
							d={path}
							mix={[
								raw({
									fill: "none",
									stroke: "var(--ui-neutral-fg-emphasis)",
									strokeWidth: "2",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									vectorEffect: "non-scaling-stroke",
								}),
							]}
						/>
					</svg>
					{points.map((point, index) => (
						<Point
							key={index}
							x={point.x}
							y={point.y}
							count={count}
							index={index}
							lit={index === highlight}
						/>
					))}
				</div>
				<div
					aria-hidden="true"
					mix={[
						raw({
							position: "relative",
							blockSize: "1.125rem",
							marginInline: `calc(${POINT} / 2)`,
						}),
					]}
				>
					{series.map((datum, index) => (
						<span
							key={index}
							style={{ left: `${points[index]!.x}%` }}
							mix={[
								small(),
								raw({
									position: "absolute",
									insetBlockStart: "0",
									whiteSpace: "nowrap",
									lineHeight: "1.125rem",
									translate: edgeAlign(index, count),
								}),
								index === highlight ? raw({ color: "var(--ui-brand-fg)", fontWeight: "600" }) : [],
							]}
						>
							{datum.label}
						</span>
					))}
				</div>
				<ol mix={[visuallyHidden()]}>
					{series.map((datum, index) => (
						<li key={index}>
							{datum.label}: {datum.display ?? datum.value}
						</li>
					))}
				</ol>
			</div>
		);
	};
}

/** Rounds a plot coordinate so the path data stays short. */
function round(value: number) {
	return Math.round(value * 100) / 100;
}

/**
 * How far a label under the line shifts from its point: the first and last align to the
 * plot's edges so they stay inside the surface, every other one centres on its point.
 */
function edgeAlign(index: number, count: number) {
	if (count > 1 && index === 0) return "0";
	if (count > 1 && index === count - 1) return "-100%";
	return "-50%";
}

/** Props {@link Point} reads. */
interface PointProps {
	/** Position across the plot, in percent. */
	x: number;
	/** Position down the plot, in percent. */
	y: number;
	count: number;
	index: number;
	lit: boolean;
}

/**
 * A point on the line, drawn in HTML over the stretched SVG so it stays round. It appears
 * when the line reaches it, and the highlighted point is larger and in the brand colour.
 */
function Point(handle: Handle<PointProps>) {
	return () => {
		let { count, index, lit, x, y } = handle.props;
		let name = `ui-drawn-chart-point-${count}-${index}`;
		let at = DRAW_FROM + (count > 1 ? (index / (count - 1)) * LINE_DRAW : 0);
		let off = { opacity: "0", transform: "scale(0.4)" };
		let on = { opacity: "1", transform: "scale(1)" };

		return (
			<span
				aria-hidden="true"
				data-slot="drawn-chart-point"
				style={{ left: `${x}%`, top: `${y}%` }}
				mix={[
					keyframes(name, {
						"0%": off,
						[percent(Math.max(0, at - 1))]: off,
						[percent(at + 1)]: on,
						[`${RESET_AT}%`]: on,
						[`${RESET_AT + 2}%`]: off,
						"100%": off,
					}),
					raw({
						position: "absolute",
						inlineSize: lit ? `calc(${POINT} * 1.75)` : POINT,
						blockSize: lit ? `calc(${POINT} * 1.75)` : POINT,
						marginInlineStart: lit ? `calc(${POINT} * -0.875)` : `calc(${POINT} / -2)`,
						marginBlockStart: lit ? `calc(${POINT} * -0.875)` : `calc(${POINT} / -2)`,
						borderRadius: "9999px",
						backgroundColor: lit ? "var(--ui-brand-bg-solid)" : "var(--ui-neutral-fg-emphasis)",
						boxShadow: "0 0 0 2px var(--ui-bg)",
					}),
					motionSafe(raw(loop(name))),
				]}
			/>
		);
	};
}

/** The animation declarations every drawn element shares: one linear loop of the cycle. */
function loop(name: string) {
	return {
		animationName: name,
		animationDuration: `${CYCLE_SECONDS}s`,
		animationTimingFunction: "linear",
		animationIterationCount: "infinite",
		animationFillMode: "both",
	};
}

/** A bar's label or value, in the heading ink, or the brand ink when highlighted. */
function caption(lit: boolean) {
	return raw({
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		fontWeight: lit ? "600" : "500",
		color: lit ? "var(--ui-brand-fg)" : "var(--ui-neutral-fg-emphasis)",
		minInlineSize: "0",
		overflowWrap: "anywhere",
	});
}

/** The quieter text: the metric's label, the line's labels and the footnote. */
function small() {
	return raw({
		fontSize: "0.8125rem",
		lineHeight: "1.25rem",
		color: "var(--ui-neutral-fg-muted)",
		overflowWrap: "anywhere",
	});
}
