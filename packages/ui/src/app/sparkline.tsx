/**
 * A row-sized trend line with no axes: the SVG stretches to its box while the stroke keeps its
 * width, an optional area and last-point dot mark where the series ends, and a one-word state
 * can sit beside it, so a list row carries its own trend.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg, fill, fillOpacity, stroke, strokeLinecap, strokeLinejoin } from "@sdxc/u/color";
import { strokeWidth, vectorEffect } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { absolute, block, grow, hstack, relative, shrink } from "@sdxc/u/layout";
import { bs, is, minIs } from "@sdxc/u/size";
import { data } from "@sdxc/u/state";
import { translateProperty } from "@sdxc/u/transform";
import { nowrap, text, weight } from "@sdxc/u/typography";

import type { Point } from "./utils/chart-path.js";

import { areaPath, linePath } from "./utils/chart-path.js";

/** Tone a sparkline draws in when `tone` is omitted. */
const DEFAULT_TONE: Sparkline.Tone = "brand";

/**
 * Height of the `viewBox`; the plot maps values onto it with a small inset, so a stroke
 * at the series' minimum or maximum stays inside the box.
 */
const VIEWBOX_HEIGHT = 100;

/** Distance, in `viewBox` units, kept between the series' extremes and the box edges. */
const VIEWBOX_INSET = 6;

/**
 * Prop types for {@link Sparkline}.
 */
export namespace Sparkline {
	/** Semantic role the line, area and dot are drawn in. */
	export type Tone = "brand" | "neutral" | "success" | "warning" | "danger";

	/** Per-part styling for the parts a sparkline composes. */
	export interface PartsProps {
		plot?: TagProps<"span">["mix"];
		line?: TagProps<"path">["mix"];
		area?: TagProps<"path">["mix"];
		dot?: TagProps<"span">["mix"];
		state?: TagProps<"span">["mix"];
	}

	/** Props accepted by {@link Sparkline}. */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/** Samples in time order; a `null` leaves a gap in the line instead of drawing a zero. */
		values: readonly (number | null)[];
		/** Accessible name of the graphic, summarising the trend ("p95 latency, rising"). */
		label: string;
		/** Longer accessible description, such as the range and the latest value. */
		description?: string;
		/** @default {@link DEFAULT_TONE} */
		tone?: Tone;
		/** Fills the region under the line. */
		area?: boolean;
		/**
		 * Marks the latest sample with a dot.
		 *
		 * @default true
		 */
		dot?: boolean;
		/** `[min, max]` the plot spans; the samples' own extremes when omitted, so rows can share a scale. */
		domain?: readonly [number, number];
		/** One word beside the line that reads the trend ("Stable", "Degrading"). */
		state?: RemixNode;
		parts?: PartsProps;
	}
}

/**
 * Resolves the plotted domain: the caller's, or the samples' own extremes widened by one on
 * each side when every sample is equal, so a flat series draws across the middle.
 *
 * @param values Samples, `null` gaps included.
 * @param domain Caller's fixed domain, when given.
 * @returns The `[min, max]` the plot maps onto its height.
 */
function resolveDomain(
	values: readonly (number | null)[],
	domain: readonly [number, number] | undefined,
): readonly [number, number] {
	if (domain) return domain;
	let present = values.filter((value): value is number => value !== null);
	if (present.length === 0) return [0, 1];
	let min = Math.min(...present);
	let max = Math.max(...present);
	return min === max ? [min - 1, max + 1] : [min, max];
}

/**
 * Splits the samples into runs of consecutive present values, each scaled into `viewBox`
 * space, so a `null` sample breaks the line where the data is missing.
 *
 * @param values Samples, `null` gaps included.
 * @param domain `[min, max]` mapped onto the plot's height.
 * @returns One list of points per unbroken run.
 */
function segments(
	values: readonly (number | null)[],
	domain: readonly [number, number],
): Point[][] {
	let [min, max] = domain;
	let span = max - min || 1;
	let usable = VIEWBOX_HEIGHT - VIEWBOX_INSET * 2;
	let runs: Point[][] = [];
	let current: Point[] = [];

	values.forEach((value, index) => {
		if (value === null) {
			if (current.length > 0) runs.push(current);
			current = [];
			return;
		}
		let clamped = Math.min(Math.max(value, min), max);
		current.push({ x: index, y: VIEWBOX_INSET + usable - ((clamped - min) / span) * usable });
	});
	if (current.length > 0) runs.push(current);

	return runs;
}

/**
 * Draws one unbroken run; a lone sample becomes a zero-length stroke, which its round cap
 * paints as a dot, so an isolated reading between two gaps stays visible.
 *
 * @param run Scaled points of one run.
 * @returns The path's `d` attribute.
 */
function runPath(run: readonly Point[]): string {
	let [only] = run;
	return run.length === 1 && only ? `M ${only.x},${only.y} h 0` : linePath(run);
}

/**
 * Renders the trend: a `role="img"` SVG named by `label` that fills the row's inline size at
 * `--ui-sparkline-block-size`, with a stroke that stays `--ui-sparkline-line-width` wide at any
 * size. The latest-point dot is a round box over the plot, so it stays round when the plot stretches.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the sparkline's markup.
 * @example
 * <Sparkline values={latency} label={t("monitor.latencyTrend")} tone="warning" state={t("trend.degrading")} />
 * @example
 * <Sparkline values={checks} label={t("monitor.checks")} area dot={false} domain={[0, 100]} />
 */
export function Sparkline(handle: Handle<Sparkline.Props>) {
	return () => {
		let { values, label, description, tone, area, dot, domain, state, parts, mix, ...rest } =
			handle.props;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let descriptionId = `${handle.id}-description`;
		let runs = segments(values, resolveDomain(values, domain));
		let width = Math.max(values.length - 1, 1);
		let lastRun = runs.at(-1);
		let last = lastRun?.at(-1);
		let showDot = (dot ?? true) && last !== undefined && last.x === values.length - 1;

		return (
			<span
				data-slot="sparkline"
				data-tone={resolvedTone}
				{...rest}
				mix={mergeMix(
					[
						hstack({ gap: 2, align: "center" }),
						is("full"),
						minIs(0),
						data("tone", "brand", fg("brand")),
						data("tone", "neutral", fg("neutral.muted")),
						data("tone", "success", fg("success")),
						data("tone", "warning", fg("warning")),
						data("tone", "danger", fg("danger")),
					],
					mix,
				)}
			>
				<span
					data-slot="sparkline-plot"
					dir="ltr"
					mix={[
						relative(),
						block(),
						grow(),
						minIs(0),
						bs("var(--ui-sparkline-block-size, 1.5rem)"),
						parts?.plot,
					]}
				>
					<svg
						role="img"
						aria-describedby={description ? descriptionId : undefined}
						viewBox={`0 0 ${width} ${VIEWBOX_HEIGHT}`}
						preserveAspectRatio="none"
						mix={[block(), is("full"), bs("full"), raw({ overflow: "visible" })]}
					>
						<title>{label}</title>
						{description ? <desc id={descriptionId}>{description}</desc> : null}
						{area
							? runs.map((run, index) => (
									<path
										key={`area-${index}`}
										data-slot="sparkline-area"
										d={areaPath(run, VIEWBOX_HEIGHT)}
										mix={[
											fill("currentColor"),
											fillOpacity("var(--ui-sparkline-area-opacity, 0.16)"),
											stroke("none"),
											parts?.area,
										]}
									/>
								))
							: null}
						{runs.map((run, index) => (
							<path
								key={`line-${index}`}
								data-slot="sparkline-line"
								d={runPath(run)}
								mix={[
									fill("none"),
									stroke("currentColor"),
									strokeWidth("var(--ui-sparkline-line-width, 1.5px)"),
									strokeLinejoin("round"),
									strokeLinecap("round"),
									vectorEffect("non-scaling-stroke"),
									parts?.line,
								]}
							/>
						))}
					</svg>
					{showDot && last ? (
						<span
							aria-hidden="true"
							data-slot="sparkline-dot"
							mix={[
								absolute(),
								is("var(--ui-sparkline-dot-size, 0.375rem)"),
								bs("var(--ui-sparkline-dot-size, 0.375rem)"),
								rounded("full"),
								raw({
									insetInlineStart: `${(last.x / width) * 100}%`,
									insetBlockStart: `${last.y}%`,
									backgroundColor: "currentColor",
								}),
								translateProperty("-50% -50%"),
								parts?.dot,
							]}
						/>
					) : null}
				</span>
				{state ? (
					<span
						data-slot="sparkline-state"
						mix={[shrink(0), text("xs"), weight("medium"), nowrap(), parts?.state]}
					>
						{state}
					</span>
				) : null}
			</span>
		);
	};
}
