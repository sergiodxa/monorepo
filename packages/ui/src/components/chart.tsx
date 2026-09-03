/**
 * The `Chart` namespace's compound parts, covering Cartesian series
 * ({@link Chart}, {@link Chart.Line}, {@link Chart.Area}, {@link Chart.Bar})
 * and the independent {@link Chart.Pie} root, each pairing with
 * {@link Chart.Legend} for a script-free series switcher and
 * {@link Chart.Tooltip} for a richer hover surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import {
	bg,
	fg,
	fill,
	fillOpacity,
	outline,
	stroke,
	strokeLinecap,
	strokeLinejoin,
	strokeWidth,
	vectorEffect,
} from "@sdxc/u/color";
import { opacity, rounded, shadow, transition, transitionDuration } from "@sdxc/u/effects";
import { cursor, pointerEvents, raw, userSelect } from "@sdxc/u/general";
import {
	absolute,
	block,
	flex,
	flexWrap,
	gap,
	inlineBlock,
	inlineFlex,
	items,
	relative,
	shrink,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, pb, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { scaleProperty, translateProperty } from "@sdxc/u/transform";
import { fontSize, leading, nowrap, textDecoration, weight } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

import type { Point } from "../utils/chart-path";
import type { PieAngles } from "../utils/chart-scale";

import { durations, easings } from "../animations/tokens";
import { CHART_COLOR_SLOT_COUNT, chartPalette } from "../styles/chart-palette";
import { legendToggle } from "../styles/legend-toggle";
import { computeMarkerIndices } from "../utils/chart-marker-indices";
import { arcPath, areaPath, linePath } from "../utils/chart-path";
import { bandScale, linearScale, pieAngles, ticks } from "../utils/chart-scale";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/** Categorical color {@link Chart.Line} falls back to when `color` is omitted. */
const DEFAULT_LINE_COLOR: Chart.Color = 1;

/** Categorical color {@link Chart.Area} falls back to when `color` is omitted. */
const DEFAULT_AREA_COLOR: Chart.Color = 1;

/**
 * `yDomain` value {@link Chart.Area} falls back to closing a series' filled
 * region down (or up) to when `baseline` is omitted.
 */
const DEFAULT_AREA_BASELINE = 0;

/**
 * Approximate marker count {@link Chart.Line} and {@link Chart.Area} fall
 * back to for `markerCount`, giving keyboard and screen-reader users a
 * representative spread of stops instead of one per raw sample.
 */
const DEFAULT_MARKER_COUNT = 6;

/**
 * `aria-hidden="true"` applied to {@link Chart.Line}'s and {@link Chart.Area}'s
 * plotted `<path>` through {@link attrs} — a series' accessible name and
 * hover tooltip live on its point markers instead.
 */
const DEFAULT_PATH_ARIA_HIDDEN = "true";

/**
 * Pixel distance from center to every wedge's inner edge {@link Chart.Pie}
 * falls back to when `innerRadius` is omitted — a solid pie reaching the
 * center, with no donut hole.
 */
const DEFAULT_PIE_INNER_RADIUS = 0;

/**
 * {@link Chart.Color} {@link Chart.Tooltip.Swatch} falls back to when
 * `color` is omitted, matching {@link DEFAULT_LINE_COLOR}'s own default.
 */
const DEFAULT_SWATCH_COLOR: Chart.Color = 1;

/**
 * `aria-hidden` value applied to {@link Chart.Tooltip} through
 * {@link attrs} unless overridden — the surface only restates the label,
 * value, and color a hovered point's native `<title>` already carries.
 */
const DEFAULT_TOOLTIP_ARIA_HIDDEN = "true";

/** Approximate gridline count {@link Chart.Bar} falls back to when `tickCount` is omitted. */
const DEFAULT_BAR_TICK_COUNT = 5;

/** Fraction of each category band reserved as a gap from its neighbors, {@link Chart.Bar} falls back to when `categoryGap` is omitted. */
const DEFAULT_CATEGORY_GAP = 0.2;

/**
 * Fraction of a category's own band reserved as a gap between its series'
 * bars, {@link Chart.Bar} falls back to when `seriesGap` is omitted —
 * packing bars edge to edge, since most rows plot a single series.
 */
const DEFAULT_SERIES_GAP = 0;

/**
 * `role="group"` applied to {@link Chart.Legend}'s host through
 * {@link attrs} unless a consumer supplies its own `role`, announcing the
 * series switcher as a related set of controls to assistive technology.
 */
const DEFAULT_LEGEND_ROLE = "group";

/**
 * `defaultChecked` {@link Chart.LegendItemProps} falls back to when
 * omitted, so a series renders visible until a reader explicitly hides it.
 */
const DEFAULT_LEGEND_ITEM_CHECKED = true;

/**
 * Renders the series switcher's host: a `role="group"` `<div>` laying its
 * {@link Chart.Legend.Item} children in a wrapping row. Must render as a
 * later sibling of the chart root, with items in that chart's series order.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the legend's markup.
 * @example
 * <Chart width={480} height={240} xDomain={[0, 11]} yDomain={[0, 1000]} aria-label={t("chart.revenue.label")}>
 * 	<Chart.Line points={points} color={1} />
 * </Chart>
 * <Chart.Legend aria-label={t("chart.legend")}>
 * 	<Chart.Legend.Item color={1}>{t("chart.series.revenue")}</Chart.Legend.Item>
 * </Chart.Legend>
 */
function ChartLegend(handle: Handle<Chart.LegendProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		warnIfNoAccessibleLabel(
			handle.props,
			'Chart.Legend: needs an "aria-label" or "aria-labelledby" identifying this legend for assistive technology.',
		);

		return (
			<div
				data-slot="legend"
				{...rest}
				mix={[
					attrs({ role: DEFAULT_LEGEND_ROLE }),
					flex(),
					flexWrap(),
					items("center"),
					gap(4),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders one series' entry: a native `<label>` wrapping a visually hidden,
 * `defaultChecked` checkbox, a `data-color` swatch matching its series, and
 * its name — unchecking hides the series via the paired chart root's `css()`.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props, plus
 * the underlying `<input>`'s own attributes and per-part `swatch` styling.
 * @returns The render function producing the item's markup.
 * @example
 * <Chart.Legend.Item color={1}>{t("chart.series.revenue")}</Chart.Legend.Item>
 * @example
 * <Chart.Legend.Item color={3} defaultChecked={false}>
 * 	{t("chart.series.archived")}
 * </Chart.Legend.Item>
 */
function ChartLegendItem(handle: Handle<Chart.LegendItemProps>) {
	return () => {
		let { color, defaultChecked, children, parts, mix, ...rest } = handle.props;
		let resolvedChecked = defaultChecked ?? DEFAULT_LEGEND_ITEM_CHECKED;

		return (
			<label
				data-slot="legend-item"
				mix={[
					relative(),
					inlineFlex(),
					items("center"),
					fg("neutral"),
					when("&:has(input:focus-visible)", outline({ color: "brand.ring", offset: 2 })),
					gap(2),
					cursor("default"),
					transition("opacity, color"),
					userSelect(),
					fontSize("sm"),
					leading(1.25),
					when("&:has(input:not(:checked))", [opacity(50), textDecoration("line-through")]),
				]}
			>
				<span
					aria-hidden="true"
					data-slot="swatch"
					data-color={String(color)}
					mix={[
						chartPalette("color"),
						inlineBlock(),
						is(2.5),
						bs(2.5),
						rounded("full"),
						shrink(),
						bg("currentColor"),
						parts?.swatch,
					]}
				/>
				<input
					type="checkbox"
					defaultChecked={resolvedChecked}
					{...rest}
					mix={[visuallyHidden(), mix]}
				/>
				{children}
			</label>
		);
	};
}

ChartLegend.Item = ChartLegendItem;

/**
 * Prop and context types for {@link Chart} and its {@link Chart.Line},
 * {@link Chart.Area}, {@link Chart.Pie}, and {@link Chart.Legend} compound
 * parts.
 */
export namespace Chart {
	/**
	 * Props accepted by {@link Chart.Legend}. Every native `<div>` attribute is
	 * available unchanged, so `aria-label`, `aria-labelledby`, and `mix` style
	 * the host exactly as they would on a bare grouping `<div>`.
	 */
	export interface LegendProps extends TagProps<"div"> {}

	/**
	 * Per-part styling for the color swatch {@link Chart.Legend.Item}
	 * composes internally alongside its own host `<input>`.
	 */
	export interface LegendItemPartsProps {
		/** Styling for the small swatch identifying this series' color. */
		swatch?: TagProps<"span">["mix"];
	}

	/**
	 * Props accepted by {@link Chart.Legend.Item}. Every native `<input>`
	 * attribute is available unchanged — aside from `type`, always
	 * `"checkbox"` — and `mix` styles that same `<input>` host.
	 */
	export interface LegendItemProps extends Omit<TagProps<"input">, "type" | "role"> {
		/** ARIA role override, restricted to what a checkbox input may carry. */
		role?: "checkbox" | "button" | "menuitemcheckbox" | "option" | "switch";
		/**
		 * This series' categorical color — the identical {@link Color} its
		 * matching plotted series was given as its own `color`, so this
		 * swatch always matches the series it labels.
		 */
		color: Color;
		/**
		 * The series' visible name, read aloud as this checkbox's
		 * accessible name through native `<label>` association. Required —
		 * this module ships no built-in copy of its own.
		 */
		children: RemixNode;
		/** Per-part styling for this item's internally composed swatch. */
		parts?: LegendItemPartsProps;
	}

	/**
	 * Value {@link Chart} stores in component context: the pixel dimensions of
	 * its coordinate space and the data domains mapped across them, shared with
	 * every nested series compound part.
	 */
	export interface Context {
		/** Pixel width of the coordinate space, matching {@link Props.width}. */
		width: number;
		/** Pixel height of the coordinate space, matching {@link Props.height}. */
		height: number;
		/** `[start, end]` domain bounds mapped across `width`, matching {@link Props.xDomain}. */
		xDomain: readonly [number, number];
		/** `[start, end]` domain bounds mapped across `height`, matching {@link Props.yDomain}. */
		yDomain: readonly [number, number];
	}

	/**
	 * Props accepted by {@link Chart}. Every native `<svg>` attribute still
	 * applies except `viewBox`, `width`, and `height`, computed from the props
	 * of the same name below so every nested series' pixel math matches.
	 */
	export interface Props extends Omit<TagProps<"svg">, "viewBox" | "width" | "height"> {
		/**
		 * Pixel width of the chart's internal coordinate space — the value every
		 * nested series' `x` positions are mapped onto. The `<svg>` renders at its
		 * container's full size, scaling this space while preserving aspect ratio.
		 */
		width: number;
		/**
		 * Pixel height of the chart's internal coordinate space — the value
		 * every nested series' `y` positions are mapped onto.
		 */
		height: number;
		/**
		 * `[start, end]` bounds of every nested series' horizontal data
		 * values, mapped across `width` and shared through context so every
		 * series lines up on the same horizontal scale.
		 */
		xDomain: readonly [number, number];
		/**
		 * `[start, end]` bounds of every nested series' vertical data values, mapped
		 * across `height`. `start` maps to the coordinate space's bottom edge and
		 * `end` to its top, matching a value axis growing upward against SVG's `y`.
		 */
		yDomain: readonly [number, number];
	}

	/**
	 * One categorical color a {@link Chart.Line}, {@link Chart.Area}, or any
	 * further series picks up through the `--ui-chart-1` through `--ui-chart-8`
	 * semantic variables, rotating a fixed palette across several series.
	 */
	export type Color = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

	/**
	 * One data point plotted by {@link Chart.Line}, in data space — the
	 * values a consumer's own domain uses, not yet mapped to pixels.
	 */
	export interface LinePoint {
		/** Horizontal data value, mapped across the ancestor {@link Chart}'s `xDomain`. */
		x: number;
		/** Vertical data value, mapped across the ancestor {@link Chart}'s `yDomain`. */
		y: number;
		/**
		 * Accessible name and hover tooltip text for this point, read by the
		 * native `<title>` nested in its marker when the point falls among the
		 * representative spread {@link Chart.Line} renders a marker for.
		 */
		label: string;
	}

	/**
	 * Props accepted by {@link Chart.Line}. Extends every native `<g>`
	 * attribute except `children` and `points`, redefined below with this
	 * series' own data-space shape in place of the native `<polyline>` attribute.
	 */
	export interface LineProps extends Omit<TagProps<"g">, "children" | "points"> {
		/**
		 * The series' data points, in draw order along `x`. The plotted path
		 * connects every point given here; the accessible markers render on
		 * only a representative spread of them, chosen through `markerCount`.
		 */
		points: readonly LinePoint[];
		/** Categorical color. Defaults to {@link DEFAULT_LINE_COLOR}. */
		color?: Color;
		/**
		 * Approximate number of accessible, hoverable markers placed along
		 * `points`. Each marker snaps to the point closest to one of this many
		 * evenly spread "nice" values across the ancestor {@link Chart}'s `xDomain`.
		 *
		 * @default {@link DEFAULT_MARKER_COUNT}
		 */
		markerCount?: number;
		/**
		 * Per-part styling for the plotted `path` and each point `marker`,
		 * layered after each part's own built-in styling. Use the `mix` prop
		 * instead to style the series' outer host.
		 */
		parts?: {
			/** Additional mixin(s) applied to the stroked `<path>`. */
			path?: TagProps<"path">["mix"];
			/** Additional mixin(s) applied to each point's `<circle>` marker. */
			marker?: TagProps<"circle">["mix"];
		};
	}

	/**
	 * One data point plotted by {@link Chart.Area}, in data space — the
	 * values a consumer's own domain uses, not yet mapped to pixels.
	 */
	export interface AreaPoint {
		/** Horizontal data value, mapped across the ancestor {@link Chart}'s `xDomain`. */
		x: number;
		/** Vertical data value, mapped across the ancestor {@link Chart}'s `yDomain`. */
		y: number;
		/**
		 * Accessible name and hover tooltip text for this point, read by the
		 * native `<title>` nested in its marker when the point falls among the
		 * representative spread {@link Chart.Area} renders a marker for.
		 */
		label: string;
	}

	/**
	 * Props accepted by {@link Chart.Area}. Extends every native `<g>`
	 * attribute except `children` and `points`, redefined below with this
	 * series' own data-space shape in place of the native `<polyline>` attribute.
	 */
	export interface AreaProps extends Omit<TagProps<"g">, "children" | "points"> {
		/**
		 * The series' data points, in draw order along `x`. The filled region
		 * traces every point given here before closing down to `baseline`; markers
		 * render on a representative spread of them, chosen through `markerCount`.
		 */
		points: readonly AreaPoint[];
		/** Categorical color. Defaults to {@link DEFAULT_AREA_COLOR}. */
		color?: Color;
		/**
		 * The `yDomain` value the filled region closes down (or up) to —
		 * typically the value axis' zero line. Defaults to
		 * {@link DEFAULT_AREA_BASELINE}.
		 */
		baseline?: number;
		/**
		 * Approximate number of accessible, hoverable markers placed along
		 * `points`. Each marker snaps to the point closest to one of this many
		 * evenly spread "nice" values across the ancestor {@link Chart}'s `xDomain`.
		 *
		 * @default {@link DEFAULT_MARKER_COUNT}
		 */
		markerCount?: number;
		/**
		 * Per-part styling for the filled `path` and each point `marker`,
		 * layered after each part's own built-in styling. Use the `mix` prop
		 * instead to style the series' outer host.
		 */
		parts?: {
			/** Additional mixin(s) applied to the filled `<path>`. */
			path?: TagProps<"path">["mix"];
			/** Additional mixin(s) applied to each point's `<circle>` marker. */
			marker?: TagProps<"circle">["mix"];
		};
	}

	/**
	 * One wedge's input for {@link Chart.Pie}: a magnitude and its required
	 * accessible label. {@link pieAngles} turns `value` into a proportional
	 * angle span, treating a negative value as zero and an all-zero total as even.
	 */
	export interface PieDatum {
		/** The magnitude this wedge represents. */
		value: number;
		/**
		 * Accessible name and hover tooltip text for this wedge, read by the
		 * native `<title>` nested inside it — required, since a wedge with no
		 * label has nothing for assistive technology to announce.
		 */
		label: string;
		/**
		 * Categorical color for this wedge, defaulting to its position in `data`
		 * modulo the palette's slot count. Set explicitly to pin a category's
		 * color across several charts or a paired legend.
		 */
		color?: Color;
	}

	/**
	 * Props accepted by {@link Chart.Pie}. Every native `<svg>` attribute still
	 * applies except `children`, `viewBox`, `width`, and `height` — the latter
	 * two take plain numbers for this component's own math, computing `viewBox`.
	 */
	export interface PieProps
		extends PieAngles.Options, Omit<TagProps<"svg">, "children" | "viewBox" | "width" | "height"> {
		/**
		 * The wedges to draw, in draw order. Each entry's position in this
		 * list picks its default color when its own `color` is omitted.
		 */
		data: readonly PieDatum[];
		/**
		 * Pixel width of the chart's internal coordinate space that `viewBox` maps
		 * onto. The rendered `<svg>` fills `100%` of the host's own inline size,
		 * scaled to fit while preserving this aspect ratio against `height`.
		 */
		width: number;
		/**
		 * Pixel height of the chart's internal coordinate space, on the same
		 * terms as `width`.
		 */
		height: number;
		/**
		 * Pixel distance from center to every wedge's inner edge, in the same
		 * coordinate space as `width`/`height`. A positive value smaller than the
		 * chart's outer radius produces a donut with a hole that size.
		 *
		 * @default {@link DEFAULT_PIE_INNER_RADIUS}
		 */
		innerRadius?: number;
		/**
		 * Per-part styling for every wedge `segment`, layered after its own
		 * built-in styling. Use the `mix` prop instead to style the chart's
		 * outer host.
		 */
		parts?: {
			/** Additional mixin(s) applied to every wedge's `<path>`. */
			segment?: TagProps<"path">["mix"];
		};
	}

	/**
	 * Prop types for {@link Chart.Tooltip} and its own compound parts.
	 */
	export namespace Tooltip {
		/**
		 * Every native `<div>` attribute, plus the `mix` passthrough. A
		 * `chartTooltip()` mixin writes this host's position and open state
		 * directly at runtime, as CSS custom properties and a `data-open` attribute.
		 */
		export interface Props extends TagProps<"div"> {}

		/**
		 * Props accepted by {@link Chart.Tooltip.Swatch}.
		 */
		export interface SwatchProps extends TagProps<"span"> {
			/**
			 * Categorical color matching the hovered point or wedge's own
			 * series — the same {@link Chart.Color} any series or {@link Chart.Pie}
			 * wedge renders with. Defaults to {@link DEFAULT_SWATCH_COLOR}.
			 */
			color?: Color;
		}

		/**
		 * Every native `<span>` attribute, plus the `mix` passthrough.
		 */
		export interface LabelProps extends TagProps<"span"> {}

		/**
		 * Every native `<span>` attribute, plus the `mix` passthrough.
		 */
		export interface ValueProps extends TagProps<"span"> {}
	}

	/**
	 * A single series' plotted value at one {@link Chart.BarRow}'s category.
	 */
	export interface BarValue {
		/** Numeric magnitude this bar represents, mapped across {@link Chart.BarProps.domain}. */
		value: number;
		/**
		 * Accessible name and hover tooltip text for this bar, read by the
		 * native `<title>` nested inside it — typically a formatted description of
		 * the category, series, and value together (e.g. `"March revenue: $1,240"`).
		 */
		label: string;
	}

	/**
	 * One category's row of plotted values, one {@link Chart.BarValue} per key
	 * listed in {@link Chart.BarProps.series}.
	 */
	export interface BarRow {
		/**
		 * Category key positioning this row's bars along the shared band axis.
		 * Keep every row's category unique — a repeated category shares its first
		 * occurrence's band position, overlapping its bars there.
		 */
		category: string;
		/**
		 * This row's value for every key listed in {@link Chart.BarProps.series},
		 * keyed the same way. A row missing one of those keys renders no bar
		 * for that series at this category.
		 */
		values: Readonly<Record<string, BarValue>>;
	}

	/**
	 * Props accepted by {@link Chart.Bar}. Every native `<svg>` attribute still
	 * applies except `children`, `viewBox`, `width`, and `height` — the latter
	 * two take plain numbers for this component's own math, computing `viewBox`.
	 */
	export interface BarProps extends Omit<
		TagProps<"svg">,
		"children" | "viewBox" | "width" | "height"
	> {
		/** Rows to plot, one band per row along the category axis, in draw order. */
		data: readonly BarRow[];
		/**
		 * Ordered series keys plotted within every row's band. A key's position in
		 * this list is both the stable index stamped onto `data-series-index` and
		 * its slot in the `--ui-chart-1`–`--ui-chart-8` palette, wrapping past it.
		 */
		series: readonly string[];
		/**
		 * Pixel width of the chart's internal coordinate space that `viewBox` maps
		 * onto. The rendered `<svg>` fills `100%` of the host's own inline size,
		 * scaled to fit while preserving this aspect ratio against `height`.
		 */
		width: number;
		/**
		 * Pixel height of the chart's internal coordinate space, on the same
		 * terms as `width`.
		 */
		height: number;
		/**
		 * `[start, end]` bounds of every bar's value, mapped across `height`.
		 * `start` maps to the bottom edge and `end` to the top, matching the same
		 * upward-value convention {@link Chart.Props.yDomain} uses against SVG's `y`.
		 */
		domain: readonly [number, number];
		/** Approximate number of horizontal gridlines spanning `domain`. Defaults to {@link DEFAULT_BAR_TICK_COUNT}. */
		tickCount?: number;
		/** Fraction of each category band reserved as a gap from its neighbors. Defaults to {@link DEFAULT_CATEGORY_GAP}. */
		categoryGap?: number;
		/**
		 * Fraction of each category's own band reserved as a gap between its
		 * series' bars — most bar charts plot a single series per category, with
		 * no neighboring bar to gap against.
		 *
		 * @default {@link DEFAULT_SERIES_GAP}
		 */
		seriesGap?: number;
		/**
		 * Per-part styling for the gridlines and bars, layered after each
		 * part's own built-in styling. Use the `mix` prop instead to style
		 * the chart's outer host.
		 */
		parts?: {
			/** Additional mixin(s) applied to each horizontal gridline. */
			gridline?: TagProps<"line">["mix"];
			/** Additional mixin(s) applied to each plotted bar. */
			bar?: TagProps<"rect">["mix"];
		};
	}
}

/**
 * Renders a chart's coordinate space: a responsive `<svg>` whose `viewBox`
 * comes from `width`/`height`, shared via context so nested series share one
 * scale. A paired {@link Chart.Legend} must render as this root's later sibling.
 *
 * @param handle Runtime handle carrying the host `<svg>`'s props and providing {@link Chart.Context}.
 * @returns The render function producing the chart's coordinate space.
 * @example
 * <Chart width={480} height={240} xDomain={[0, 11]} yDomain={[0, 1000]} aria-label={t("chart.revenue.label")}>
 * 	<Chart.Line
 * 		points={months.map((month) => ({
 * 			x: month.index,
 * 			y: month.revenue,
 * 			label: t("chart.revenue.point", { month: month.name, amount: month.revenue }),
 * 		}))}
 * 	/>
 * </Chart>
 * <Chart.Legend aria-label={t("chart.legend")}>
 * 	<Chart.Legend.Item color={1}>{t("chart.series.revenue")}</Chart.Legend.Item>
 * </Chart.Legend>
 */
export function Chart(handle: Handle<Chart.Props, Chart.Context>) {
	return () => {
		let { width, height, xDomain, yDomain, mix, ...rest } = handle.props;

		handle.context.set({ width, height, xDomain, yDomain });

		return (
			<svg
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="xMidYMid meet"
				{...rest}
				mix={[legendToggle(), block(), is("full"), bs("auto"), mix]}
			/>
		);
	};
}

Chart.Legend = ChartLegend;

/**
 * Renders one series' representative point markers: a small focusable
 * `<circle>` at each of `markerIndices`' scaled positions, nested with a
 * `<title>` carrying that point's own `label`.
 *
 * @param points The series' original data points, read for each marker's label.
 * @param scaledPoints Each point's already-scaled pixel position, in the same order as `points`.
 * @param markerIndices Which of `points`' indices to render a marker for.
 * @param markerMix Additional mixin(s) layered after each marker's own built-in styling.
 * @returns The rendered `<circle>` markers.
 */
function renderChartMarkers(
	points: readonly { label: string }[],
	scaledPoints: readonly Point[],
	markerIndices: readonly number[],
	markerMix: TagProps<"circle">["mix"],
): RemixNode {
	return markerIndices.map((index) => {
		let point = points[index];
		let position = scaledPoints[index];

		if (point === undefined || position === undefined) return null;

		return (
			<circle
				key={index}
				cx={position.x}
				cy={position.y}
				tabIndex={0}
				role="img"
				mix={[
					focusVisible(outline({ color: "brand.ring", offset: 2 })),
					cursor("default"),
					fill("currentColor"),
					raw({ r: "var(--ui-chart-point-radius, 0.1875rem)" }),
					markerMix,
				]}
			>
				<title>{point.label}</title>
			</circle>
		);
	});
}

/**
 * Renders a line series: a stroked, `aria-hidden` `<path>` connecting
 * `points` via {@link linearScale} and {@link linePath}, plus a focusable
 * marker with a `<title>`, sampled via {@link ticks} for manageable density.
 *
 * @param handle Runtime handle carrying the host `<g>`'s props.
 * @returns The render function producing the series' markup.
 * @example
 * <Chart.Line
 * 	color={2}
 * 	points={[
 * 		{ x: 0, y: 12, label: t("chart.point", { x: 0, y: 12 }) },
 * 		{ x: 1, y: 18, label: t("chart.point", { x: 1, y: 18 }) },
 * 		{ x: 2, y: 9, label: t("chart.point", { x: 2, y: 9 }) },
 * 	]}
 * />
 * @example
 * <Chart.Line points={points} markerCount={3} parts={{ path: css({ strokeDasharray: "4 4" }) }} />
 */
Chart.Line = function ChartLine(handle: Handle<Chart.LineProps>) {
	return () => {
		let { points, color, markerCount, parts, mix, ...rest } = handle.props;
		let context = handle.context.get(Chart);
		let resolvedColor = color ?? DEFAULT_LINE_COLOR;
		let resolvedMarkerCount = markerCount ?? DEFAULT_MARKER_COUNT;

		let x = linearScale(context.xDomain, [0, context.width]);
		let y = linearScale(context.yDomain, [context.height, 0]);
		let scaledPoints: Point[] = points.map((point) => ({ x: x(point.x), y: y(point.y) }));
		let d = linePath(scaledPoints);

		let markerIndices = computeMarkerIndices(points, context.xDomain, resolvedMarkerCount);

		return (
			<g data-color={String(resolvedColor)} {...rest} mix={[chartPalette("color"), mix]}>
				<path
					d={d}
					mix={[
						attrs({ "aria-hidden": DEFAULT_PATH_ARIA_HIDDEN }),
						fill("none"),
						stroke("currentColor"),
						strokeWidth("var(--ui-chart-line-width, 2px)"),
						strokeLinejoin("round"),
						strokeLinecap("round"),
						parts?.path,
					]}
				/>
				{renderChartMarkers(points, scaledPoints, markerIndices, parts?.marker)}
			</g>
		);
	};
};

/**
 * Renders the tooltip's floating host: an absolutely positioned `<div>`
 * reading position and `data-open` state a `chartTooltip()` mixin writes
 * onto it. Visibility requires pairing that mixin with the chart root.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the surface's markup.
 * @example
 * <div style={{ position: "relative" }} mix={chartTooltip()}>
 * 	<Chart width={480} height={240} xDomain={[0, 11]} yDomain={[0, 1000]} aria-label={t("chart.revenue.label")}>
 * 		<Chart.Line points={points} />
 * 	</Chart>
 * 	<Chart.Tooltip>
 * 		<Chart.Tooltip.Swatch color={2} />
 * 		<Chart.Tooltip.Label>{t("chart.months.march")}</Chart.Tooltip.Label>
 * 		<Chart.Tooltip.Value>42</Chart.Tooltip.Value>
 * 	</Chart.Tooltip>
 * </div>
 */
function ChartTooltip(handle: Handle<Chart.Tooltip.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				data-slot="tooltip"
				{...rest}
				mix={[
					attrs({ "aria-hidden": DEFAULT_TOOLTIP_ARIA_HIDDEN }),
					absolute(),
					flex(),
					items("center"),
					rounded("md"),
					pi(2),
					fg("neutral.onSolid"),
					bg("neutral.solid"),
					shadow("md"),
					z(10),
					gap(1.5),
					pb(1.5),
					nowrap(),
					opacity(0),
					transition("opacity, scale", { duration: durations.fast, easing: easings.standard }),
					when("&[data-open]", [opacity(100), scaleProperty(1)]),
					media("(prefers-reduced-motion: reduce)", [
						scaleProperty("none"),
						raw({ transitionProperty: "opacity" }),
					]),
					raw({
						left: "var(--ui-chart-tooltip-x, 0px)",
						top: "var(--ui-chart-tooltip-y, 0px)",
						fontSize: "0.8125rem",
					}),
					translateProperty("-50% calc(-100% - var(--ui-chart-tooltip-gap, 0.5rem))"),
					leading(1.2),
					pointerEvents(),
					scaleProperty(0.95),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders a small circular color chip identifying the tooltip's current
 * point or wedge: a native `<span>` colored through the `data-color`
 * attribute, on the same eight-slot palette every series already renders with.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the swatch's markup.
 * @example
 * <Chart.Tooltip.Swatch color={2} />
 */
ChartTooltip.Swatch = function ChartTooltipSwatch(handle: Handle<Chart.Tooltip.SwatchProps>) {
	return () => {
		let { color, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_SWATCH_COLOR;

		return (
			<span
				{...rest}
				data-slot="swatch"
				data-color={String(resolvedColor)}
				mix={[
					chartPalette("backgroundColor"),
					inlineBlock(),
					is(2),
					bs(2),
					rounded("full"),
					shrink(),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the tooltip's label slot: a native `<span>` showing the hovered
 * point or wedge's own label — the same string rendered into its native
 * `<title>` — muted to read as secondary against {@link Chart.Tooltip.Value}.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the label's markup.
 * @example
 * <Chart.Tooltip.Label>{t("chart.months.march")}</Chart.Tooltip.Label>
 */
ChartTooltip.Label = function ChartTooltipLabel(handle: Handle<Chart.Tooltip.LabelProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <span {...rest} data-slot="label" mix={[opacity(75), mix]} />;
	};
};

/**
 * Renders the tooltip's value slot: a native `<span>` showing the hovered
 * point or wedge's own value, weighted to read as the surface's most
 * prominent figure against {@link Chart.Tooltip.Label}.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the value's markup.
 * @example
 * <Chart.Tooltip.Value>42</Chart.Tooltip.Value>
 */
ChartTooltip.Value = function ChartTooltipValue(handle: Handle<Chart.Tooltip.ValueProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <span {...rest} data-slot="value" mix={[weight("semibold"), mix]} />;
	};
};

// @ts-ignore
Chart.Tooltip = ChartTooltip;

/**
 * Renders an area series: a filled, `aria-hidden` `<path>` tracing `points`
 * and closing down to `baseline`, mapped through {@link linearScale} and
 * {@link areaPath}, plus a focusable marker sampled via {@link ticks}.
 *
 * @param handle Runtime handle carrying the host `<g>`'s props.
 * @returns The render function producing the series' markup.
 * @example
 * <Chart.Area
 * 	color={3}
 * 	points={[
 * 		{ x: 0, y: 12, label: t("chart.point", { x: 0, y: 12 }) },
 * 		{ x: 1, y: 18, label: t("chart.point", { x: 1, y: 18 }) },
 * 		{ x: 2, y: 9, label: t("chart.point", { x: 2, y: 9 }) },
 * 	]}
 * />
 * @example
 * <Chart.Area
 * 	points={points}
 * 	baseline={20}
 * 	markerCount={3}
 * 	parts={{ path: css({ fillOpacity: 0.4 }) }}
 * />
 */
Chart.Area = function ChartArea(handle: Handle<Chart.AreaProps>) {
	return () => {
		let { points, color, baseline, markerCount, parts, mix, ...rest } = handle.props;
		let context = handle.context.get(Chart);
		let resolvedColor = color ?? DEFAULT_AREA_COLOR;
		let resolvedBaseline = baseline ?? DEFAULT_AREA_BASELINE;
		let resolvedMarkerCount = markerCount ?? DEFAULT_MARKER_COUNT;

		let x = linearScale(context.xDomain, [0, context.width]);
		let y = linearScale(context.yDomain, [context.height, 0]);
		let scaledPoints: Point[] = points.map((point) => ({ x: x(point.x), y: y(point.y) }));
		let d = areaPath(scaledPoints, y(resolvedBaseline));

		let markerIndices = computeMarkerIndices(points, context.xDomain, resolvedMarkerCount);

		return (
			<g data-color={String(resolvedColor)} {...rest} mix={[chartPalette("color"), mix]}>
				<path
					d={d}
					mix={[
						attrs({ "aria-hidden": DEFAULT_PATH_ARIA_HIDDEN }),
						fill("currentColor"),
						fillOpacity("var(--ui-chart-area-fill-opacity, 0.25)"),
						stroke("currentColor"),
						strokeWidth("var(--ui-chart-area-width, 2px)"),
						strokeLinejoin("round"),
						strokeLinecap("round"),
						parts?.path,
					]}
				/>
				{renderChartMarkers(points, scaledPoints, markerIndices, parts?.marker)}
			</g>
		);
	};
};

/**
 * Renders a pie or donut chart: an independent `<svg>` root, since a
 * circular layout shares no domain with a Cartesian {@link Chart}. A paired
 * {@link Chart.Legend} must render as this root's later sibling.
 *
 * @param handle Runtime handle carrying the host `<svg>`'s props.
 * @returns The render function producing the chart's markup.
 * @example
 * <Chart.Pie
 * 	width={200}
 * 	height={200}
 * 	aria-label={t("chart.revenueByRegion")}
 * 	data={[
 * 		{ value: 45, label: t("region.americas", { percent: 45 }) },
 * 		{ value: 30, label: t("region.emea", { percent: 30 }) },
 * 		{ value: 25, label: t("region.apac", { percent: 25 }) },
 * 	]}
 * />
 * @example
 * <Chart.Pie
 * 	width={200}
 * 	height={200}
 * 	innerRadius={60}
 * 	aria-label={t("chart.storageByType")}
 * 	data={rows.map((row) => ({ value: row.bytes, label: row.name }))}
 * />
 */
Chart.Pie = function ChartPie(handle: Handle<Chart.PieProps>) {
	return () => {
		let { data, width, height, innerRadius, startAngle, endAngle, padAngle, parts, mix, ...rest } =
			handle.props;
		let resolvedInnerRadius = innerRadius ?? DEFAULT_PIE_INNER_RADIUS;

		let cx = width / 2;
		let cy = height / 2;
		let outerRadius = Math.min(width, height) / 2;

		let slices = pieAngles(
			data.map((datum) => datum.value),
			{ startAngle, endAngle, padAngle },
		);

		return (
			<svg
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="xMidYMid meet"
				{...rest}
				mix={[chartPalette("fill", " "), legendToggle(), block(), is("full"), bs("auto"), mix]}
			>
				{slices.map((slice, index) => {
					let datum = data[index];
					if (datum === undefined) return null;

					let d = arcPath({
						cx,
						cy,
						innerRadius: resolvedInnerRadius,
						outerRadius,
						startAngle: slice.startAngle,
						endAngle: slice.endAngle,
					});
					if (d === "") return null;

					let resolvedColor: Chart.Color =
						datum.color ?? (((index % CHART_COLOR_SLOT_COUNT) + 1) as Chart.Color);

					return (
						<path
							key={index}
							d={d}
							data-color={String(resolvedColor)}
							tabIndex={0}
							role="img"
							mix={[
								focusVisible(outline({ color: "brand.ring", offset: 2 })),
								cursor("default"),
								parts?.segment,
							]}
						>
							<title>{datum.label}</title>
						</path>
					);
				})}
			</svg>
		);
	};
};

/**
 * Renders a categorical bar chart: an independent `<svg>` root, since a
 * band axis shares no continuous domain with a Cartesian {@link Chart}. A
 * paired {@link Chart.Legend} must render as this root's later sibling.
 *
 * @param handle Runtime handle carrying the host `<svg>`'s props.
 * @returns The render function producing the chart's markup.
 * @example
 * <Chart.Bar
 * 	width={480}
 * 	height={240}
 * 	domain={[0, 5000]}
 * 	aria-label={t("chart.revenue.label")}
 * 	data={[
 * 		{
 * 			category: "Jan",
 * 			values: { revenue: { value: 4000, label: t("chart.revenuePoint", { month: "Jan", value: 4000 }) } },
 * 		},
 * 		{
 * 			category: "Feb",
 * 			values: { revenue: { value: 3000, label: t("chart.revenuePoint", { month: "Feb", value: 3000 }) } },
 * 		},
 * 	]}
 * 	series={["revenue"]}
 * />
 * @example
 * <Chart.Bar
 * 	width={480}
 * 	height={240}
 * 	domain={[0, 5000]}
 * 	aria-label={t("chart.revenue.label")}
 * 	data={quarters.map((quarter) => ({
 * 		category: quarter.name,
 * 		values: {
 * 			revenue: {
 * 				value: quarter.revenue,
 * 				label: t("chart.revenuePoint", { quarter: quarter.name, value: quarter.revenue }),
 * 			},
 * 			refunds: {
 * 				value: quarter.refunds,
 * 				label: t("chart.refundsPoint", { quarter: quarter.name, value: quarter.refunds }),
 * 			},
 * 		},
 * 	}))}
 * 	series={["revenue", "refunds"]}
 * 	seriesGap={0.15}
 * />
 */
Chart.Bar = function ChartBar(handle: Handle<Chart.BarProps>) {
	return () => {
		let {
			data,
			series,
			width,
			height,
			domain,
			tickCount,
			categoryGap,
			seriesGap,
			parts,
			mix,
			...rest
		} = handle.props;
		let resolvedTickCount = tickCount ?? DEFAULT_BAR_TICK_COUNT;
		let resolvedCategoryGap = categoryGap ?? DEFAULT_CATEGORY_GAP;
		let resolvedSeriesGap = seriesGap ?? DEFAULT_SERIES_GAP;

		let categories = data.map((row) => row.category);
		let outer = bandScale(categories, [0, width], {
			paddingInner: resolvedCategoryGap,
			paddingOuter: resolvedCategoryGap / 2,
		});
		let inner = bandScale(series, [0, outer.bandwidth], { paddingInner: resolvedSeriesGap });
		let y = linearScale(domain, [height, 0]);
		let baselineY = y(0);
		let gridlineValues = ticks(domain, resolvedTickCount);

		return (
			<svg
				viewBox={`0 0 ${width} ${height}`}
				preserveAspectRatio="xMidYMid meet"
				{...rest}
				mix={[chartPalette("fill", " "), legendToggle(), block(), is("full"), bs("auto"), mix]}
			>
				<g mix={[attrs({ "aria-hidden": DEFAULT_PATH_ARIA_HIDDEN })]}>
					{gridlineValues.map((value) => (
						<line
							key={value}
							x1={0}
							x2={width}
							y1={y(value)}
							y2={y(value)}
							mix={[
								stroke("var(--ui-neutral-border)"),
								strokeWidth("1"),
								vectorEffect("non-scaling-stroke"),
								parts?.gridline,
							]}
						/>
					))}
				</g>
				{data.map((row) => {
					let categoryX = outer.position(row.category);
					if (categoryX === undefined) return null;

					return series.map((key, index) => {
						let entry = row.values[key];
						if (entry === undefined) return null;

						let barX = categoryX + (inner.position(key) ?? 0);
						let barValueY = y(entry.value);
						let rectY = Math.min(baselineY, barValueY);
						let rectHeight = Math.abs(barValueY - baselineY);
						let resolvedColor: Chart.Color = ((index % CHART_COLOR_SLOT_COUNT) + 1) as Chart.Color;

						return (
							<rect
								key={`${row.category}:${key}`}
								x={barX}
								y={rectY}
								width={inner.bandwidth}
								height={rectHeight}
								data-color={String(resolvedColor)}
								data-series-index={String(index)}
								tabIndex={0}
								role="img"
								mix={[
									hover(opacity(85)),
									focusVisible(outline({ color: "brand.ring", offset: 2 })),
									cursor("default"),
									transition("opacity"),
									media("(prefers-reduced-motion: reduce)", transitionDuration("0s")),
									parts?.bar,
								]}
							>
								<title>{entry.label}</title>
							</rect>
						);
					});
				})}
			</svg>
		);
	};
};
