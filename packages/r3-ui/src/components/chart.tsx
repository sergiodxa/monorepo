/**
 * The `Chart` namespace's compound parts, covering both Cartesian and
 * circular chart geometries under one shared name. {@link Chart} renders the
 * coordinate space every nested Cartesian series shares — its pixel
 * dimensions and the data domains mapped across them — and publishes that
 * shared space through component context, so every series nested inside
 * reads the same coordinate system instead of a consumer repeating it on
 * each one. {@link Chart.Line} plots a stroked path connecting a set of data
 * points, drawn through {@link linearScale} for data-to-pixel positioning and
 * {@link linePath} for the path string. {@link Chart.Area} shares that same
 * positioning and closes it down to a baseline through {@link areaPath}
 * instead, filling the region beneath (or above) the series rather than just
 * tracing it. Both place a reachable, hoverable marker on a representative
 * spread of their points, computed through {@link ticks}. {@link Chart.Pie}
 * plots a circular geometry that shares no axis with a Cartesian series, so
 * it renders as its own independent `<svg>` root instead of nesting inside
 * {@link Chart}'s coordinate space: {@link pieAngles} allocates each wedge's
 * angle span proportional to its share of the total, and {@link arcPath}
 * turns that span into the wedge's `d` path string, drawing a solid pie or,
 * with a positive `innerRadius`, a donut. {@link Chart.Bar} plots a
 * categorical geometry that, like {@link Chart.Pie}, shares no axis with a
 * Cartesian series' continuous `xDomain`, so it too renders as its own
 * independent `<svg>` root: {@link bandScale} positions and sizes every bar
 * along its category axis — subdividing each category's band into one inner
 * band per series when a row plots more than one — {@link linearScale} maps
 * each bar's numeric value onto the vertical axis, and {@link ticks}
 * generates the horizontal gridlines drawn behind the bars. {@link Chart.Legend}
 * pairs with any of these roots as a later sibling: a checkbox-driven series
 * switcher whose swatches and names render fully readable with no script,
 * unchecking an item hiding its matching series through that chart root's
 * own static styling rather than a mixin of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { visuallyHidden } from "@pkg/u/a11y";
import { bg, fg, outline } from "@pkg/u/color";
import { opacity, rounded, shadow, transition, transitionDuration } from "@pkg/u/effects";
import { cursor, pointerEvents, raw, userSelect } from "@pkg/u/general";
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
} from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, is, pb, pi } from "@pkg/u/size";
import { z } from "@pkg/u/stacking";
import { focusVisible, hover, when } from "@pkg/u/state";
import { scaleProperty, translateProperty } from "@pkg/u/transform";
import { fontSize, leading, nowrap, textDecoration, weight } from "@pkg/u/typography";
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
 * Approximate number of accessible markers {@link Chart.Line} and
 * {@link Chart.Area} place along their plotted points when `markerCount` is
 * omitted — enough to give a keyboard or screen-reader user a representative
 * spread of stops without a dense series turning into one stop per raw
 * sample.
 */
const DEFAULT_MARKER_COUNT = 6;

/**
 * `aria-hidden="true"` applied to {@link Chart.Line}'s and {@link Chart.Area}'s
 * plotted `<path>` through {@link attrs}, keeping the purely visual stroke or
 * fill out of the accessibility tree — a series' accessible names and hover
 * tooltips live on its point markers instead.
 */
const DEFAULT_PATH_ARIA_HIDDEN = true;

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
 * {@link attrs} unless a consumer overrides it. The surface only restates
 * the label, value, and series color a hovered point's own native
 * `<title>`, accessible name, and series color already carry, so
 * assistive technology gains nothing from encountering it directly.
 */
const DEFAULT_TOOLTIP_ARIA_HIDDEN = true;

/** Approximate gridline count {@link Chart.Bar} falls back to when `tickCount` is omitted. */
const DEFAULT_BAR_TICK_COUNT = 5;

/** Fraction of each category band reserved as a gap from its neighbors, {@link Chart.Bar} falls back to when `categoryGap` is omitted. */
const DEFAULT_CATEGORY_GAP = 0.2;

/**
 * Fraction of a category's own band reserved as a gap between its series'
 * bars, {@link Chart.Bar} falls back to when `seriesGap` is omitted — packing
 * every category's bars edge to edge by default, since most bar charts plot
 * a single series per category and have no neighboring bar to gap against.
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
 * {@link Chart.Legend.Item} children out in a wrapping horizontal row, each
 * pairing a color swatch with its series' name. Every swatch and name
 * renders fully readable with no script involved; unchecking an item is
 * what actually hides that series' points, driven entirely by the paired
 * chart root's own `css()` reading this same checkbox — this host and its
 * items carry no visibility logic of their own.
 *
 * Composition asks two things of the consumer, matching exactly how the
 * paired chart root's own static rules are keyed: render `Chart.Legend` as
 * a later sibling of the chart root it controls, since a chart root reads
 * this legend's checkboxes through the general sibling combinator, which
 * only looks at siblings that follow it; and render each
 * {@link Chart.Legend.Item} in the same order as the chart's own series,
 * since a chart root locates the item controlling series `n` by its
 * position among its siblings — the `n`-th `<label>` inside this legend —
 * not by reading any attribute off the checkbox itself.
 *
 * In dev mode, a legend rendered without an `aria-label` or
 * `aria-labelledby` logs a `console.warn`, since assistive technology
 * otherwise has no accessible name to announce for the set.
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
 * `defaultChecked` `<input type="checkbox">` alongside a small color swatch
 * and the series' name — the same "decorative element, then input, then
 * visible text" order this catalog's own `Checkbox` already establishes, so
 * clicking or tapping anywhere in the row toggles the control natively,
 * with no separate `htmlFor`/`id` pair required. The swatch reads its color
 * from `data-color` through the same eight-slot `--ui-chart-*` palette a
 * chart root's own points read, keeping every series' legend color
 * identical to its plotted color.
 *
 * Unchecking the input dims the whole row and strikes through its name — a
 * shape change paired with the color change, never color alone — and is the
 * only difference this item ever renders on its own; hiding the matching
 * series' points elsewhere is entirely the paired chart root's own `css()`
 * reacting to this same checkbox by its position among its siblings.
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
					when("&:has(input:focus-visible)", outline({ color: "primary.ring", offset: 2 })),
					gap(2),
					cursor("default"),
					transition("opacity, color"),
					userSelect(),
					fontSize("sm"),
					leading(1.25),
					when("&:has(input:not(:checked))", [opacity(50), textDecoration("line-through")]),
				]}
			>
				{/*
				 * The swatch comes before the input in source order, mirroring
				 * `Checkbox`'s own decorative-box-then-input layout, even though
				 * this swatch's own color is static per series rather than a
				 * reaction to the input's state — the whole row (swatch
				 * included) dims through the label's own `opacity` above instead.
				 */}
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
	 * Props accepted by {@link Chart.Legend}. Every native `<div>` attribute
	 * is available unchanged, so `aria-label`, `aria-labelledby`, and `mix`
	 * identify and style the host exactly as they would on a bare grouping
	 * `<div>`.
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
	 * attribute is available unchanged — aside from `type`, which is always
	 * `"checkbox"` — so `defaultChecked`, `name`, `value`, `disabled`, and
	 * the rest work exactly as they would on a bare checkbox input, and
	 * `mix` styles that same `<input>` host.
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
	 * Value {@link Chart} stores in component context: the pixel dimensions
	 * of its coordinate space and the data domains mapped across them, read
	 * by every series compound part nested inside so they all plot against
	 * the same shared scale.
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
	 * applies except `viewBox`, `width`, and `height`, which this component
	 * computes itself from the props of the same name below so every nested
	 * series' pixel math always matches what's actually rendered.
	 */
	export interface Props extends Omit<TagProps<"svg">, "viewBox" | "width" | "height"> {
		/**
		 * Pixel width of the chart's internal coordinate space — the value
		 * every nested series' `x` positions are mapped onto. The `<svg>`
		 * itself renders at its container's full inline size, scaling this
		 * coordinate space to fit while preserving its aspect ratio against
		 * `height`.
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
		 * `[start, end]` bounds of every nested series' vertical data values,
		 * mapped across `height` and shared through context so every series
		 * lines up on the same vertical scale. `start` maps to the
		 * coordinate space's bottom edge and `end` to its top edge, matching
		 * how a value axis grows upward while SVG's own `y` axis grows
		 * downward.
		 */
		yDomain: readonly [number, number];
	}

	/**
	 * One categorical color a {@link Chart.Line}, a {@link Chart.Area}, or
	 * any further series plotted alongside them picks up through the
	 * `--ui-chart-1` through `--ui-chart-8` semantic variables, rotating a
	 * fixed palette across several series instead of assigning any of them a
	 * fixed semantic role.
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
		 * native `<title>` nested in its marker whenever this point falls
		 * among the representative spread {@link Chart.Line} renders a
		 * marker for. Typically a formatted description of both values
		 * together (e.g. `"March: $1,240"`), built by the consumer through
		 * the platform's `Intl` APIs against their own localized strings —
		 * this component never derives it from `x`/`y` on its own.
		 */
		label: string;
	}

	/**
	 * Props accepted by {@link Chart.Line}. Extends every native `<g>`
	 * attribute except `children` and `points` — `points` is redefined below
	 * with this series' own data-space shape, in place of the native SVG
	 * attribute of the same name that only applies to `<polyline>`/`<polygon>`.
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
		 * Approximate number of accessible, hoverable markers to place along
		 * `points`. Each marker snaps to whichever actual point sits closest
		 * to one of this many evenly spread "nice" values across the
		 * ancestor {@link Chart}'s `xDomain`, so a dense series still exposes
		 * a manageable, evenly distributed set of keyboard stops instead of
		 * one per raw sample. Defaults to {@link DEFAULT_MARKER_COUNT}.
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
		 * native `<title>` nested in its marker whenever this point falls
		 * among the representative spread {@link Chart.Area} renders a
		 * marker for. Typically a formatted description of both values
		 * together (e.g. `"March: $1,240"`), built by the consumer through
		 * the platform's `Intl` APIs against their own localized strings —
		 * this component never derives it from `x`/`y` on its own.
		 */
		label: string;
	}

	/**
	 * Props accepted by {@link Chart.Area}. Extends every native `<g>`
	 * attribute except `children` and `points` — `points` is redefined below
	 * with this series' own data-space shape, in place of the native SVG
	 * attribute of the same name that only applies to `<polyline>`/`<polygon>`.
	 */
	export interface AreaProps extends Omit<TagProps<"g">, "children" | "points"> {
		/**
		 * The series' data points, in draw order along `x`. The filled
		 * region traces every point given here before closing down to
		 * `baseline`; the accessible markers render on only a representative
		 * spread of them, chosen through `markerCount`.
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
		 * Approximate number of accessible, hoverable markers to place along
		 * `points`. Each marker snaps to whichever actual point sits closest
		 * to one of this many evenly spread "nice" values across the
		 * ancestor {@link Chart}'s `xDomain`, so a dense series still exposes
		 * a manageable, evenly distributed set of keyboard stops instead of
		 * one per raw sample. Defaults to {@link DEFAULT_MARKER_COUNT}.
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
	 * accessible label. {@link pieAngles} turns `value` into an angle span
	 * proportional to its share of every value's total; a negative `value`
	 * contributes a zero-width wedge instead of an inverted one, and an
	 * all-zero (or empty-sum) `data` list splits the circle evenly instead of
	 * collapsing every wedge to nothing.
	 */
	export interface PieDatum {
		/** The magnitude this wedge represents. */
		value: number;
		/**
		 * Accessible name and hover tooltip text for this wedge, read by the
		 * native `<title>` nested inside it — required, since the library
		 * ships no built-in copy and a wedge with no label has nothing for
		 * assistive technology to announce.
		 */
		label: string;
		/**
		 * Categorical color for this wedge. Defaults to this datum's position
		 * in `data` modulo the palette's slot count (plus one), rotating the
		 * same fixed palette {@link Chart.Line} and {@link Chart.Area} read
		 * from — set it explicitly to keep a given category pinned to the
		 * same color across several charts or a paired legend instead of
		 * leaving it to positional cycling.
		 */
		color?: Color;
	}

	/**
	 * Props accepted by {@link Chart.Pie}. Every native `<svg>` attribute
	 * still applies except `children`, `viewBox`, `width`, and `height` —
	 * `width`/`height` are redefined below as the plain numbers this
	 * component's own coordinate-space math needs, in place of the native SVG
	 * attribute's `number | string`, and `viewBox` is computed from them, so a
	 * consumer never sets it directly.
	 */
	export interface PieProps
		extends PieAngles.Options, Omit<TagProps<"svg">, "children" | "viewBox" | "width" | "height"> {
		/**
		 * The wedges to draw, in draw order. Each entry's position in this
		 * list picks its default color when its own `color` is omitted.
		 */
		data: readonly PieDatum[];
		/**
		 * Pixel width of the chart's internal coordinate space that `viewBox`
		 * maps onto — not the rendered size, which always fills `100%` of the
		 * host's own inline size, scaled to fit while preserving this aspect
		 * ratio against `height`.
		 */
		width: number;
		/**
		 * Pixel height of the chart's internal coordinate space, on the same
		 * terms as `width`.
		 */
		height: number;
		/**
		 * Pixel distance from center to every wedge's inner edge, in the same
		 * coordinate space as `width`/`height`. Leave at the default of
		 * {@link DEFAULT_PIE_INNER_RADIUS} for a solid pie reaching the
		 * center, or pass a positive value smaller than the chart's outer
		 * radius for a donut with a hole that size.
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
		 * Every native `<div>` attribute, plus the `mix` passthrough. Carries
		 * no prop of its own for position or open state: a `chartTooltip()`
		 * mixin writes both directly onto this host at runtime — position as
		 * the `--ui-chart-tooltip-x`/`--ui-chart-tooltip-y` custom properties
		 * this component's own CSS reads, open state as a `data-open`
		 * attribute — rather than either one threading through a prop.
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
		 * native `<title>` nested inside it. Typically a formatted
		 * description of the category, series, and value together (e.g.
		 * `"March revenue: $1,240"`), built by the consumer through the
		 * platform's `Intl` APIs against their own localized strings — this
		 * component never derives it from `value` on its own.
		 */
		label: string;
	}

	/**
	 * One category's row of plotted values, one {@link Chart.BarValue} per key
	 * listed in {@link Chart.BarProps.series}.
	 */
	export interface BarRow {
		/**
		 * Category key positioning this row's bars along the shared band
		 * axis. Keep every row's category unique — a repeated category falls
		 * back to sharing its first occurrence's position, so its bars
		 * overlap instead of getting a band of their own.
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
	 * Props accepted by {@link Chart.Bar}. Every native `<svg>` attribute
	 * still applies except `children`, `viewBox`, `width`, and `height` —
	 * `width`/`height` are redefined below as the plain numbers this
	 * component's own coordinate-space math needs, in place of the native SVG
	 * attribute's `number | string`, and `viewBox` is computed from them, so a
	 * consumer never sets it directly.
	 */
	export interface BarProps extends Omit<
		TagProps<"svg">,
		"children" | "viewBox" | "width" | "height"
	> {
		/** Rows to plot, one band per row along the category axis, in draw order. */
		data: readonly BarRow[];
		/**
		 * Ordered series keys plotted within every row's band, subdividing
		 * each category's own band into one inner band per key. A key's
		 * position in this list is both the stable index stamped onto its
		 * bars' `data-series-index` — the attribute a sibling
		 * `Chart.Legend`'s checkbox-driven CSS and the `chartTooltip()` mixin
		 * both key off, alongside `data-color` — and its position in the same
		 * `--ui-chart-1` through `--ui-chart-8` palette {@link Chart.Line},
		 * {@link Chart.Area}, and {@link Chart.Pie} rotate through, wrapping
		 * back to the first color once `series` outgrows the sequence.
		 */
		series: readonly string[];
		/**
		 * Pixel width of the chart's internal coordinate space that `viewBox`
		 * maps onto — not the rendered size, which always fills `100%` of the
		 * host's own inline size, scaled to fit while preserving this aspect
		 * ratio against `height`.
		 */
		width: number;
		/**
		 * Pixel height of the chart's internal coordinate space, on the same
		 * terms as `width`.
		 */
		height: number;
		/**
		 * `[start, end]` bounds of every bar's value, mapped across `height`.
		 * `start` maps to the coordinate space's bottom edge and `end` to its
		 * top edge, matching how a value axis grows upward while SVG's own
		 * `y` axis grows downward — the same convention
		 * {@link Chart.Props.yDomain} uses.
		 */
		domain: readonly [number, number];
		/** Approximate number of horizontal gridlines spanning `domain`. Defaults to {@link DEFAULT_BAR_TICK_COUNT}. */
		tickCount?: number;
		/** Fraction of each category band reserved as a gap from its neighbors. Defaults to {@link DEFAULT_CATEGORY_GAP}. */
		categoryGap?: number;
		/**
		 * Fraction of each category's own band reserved as a gap between its
		 * series' bars. Defaults to {@link DEFAULT_SERIES_GAP} — packing every
		 * category's bars edge to edge, since most bar charts plot a single
		 * series per category and have no neighboring bar to gap against.
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
 * Renders a chart's coordinate space: a responsive `<svg>` sized to its
 * container's full inline size, its internal coordinate system fixed by a
 * `viewBox` built from `width` and `height`. Publishes those dimensions
 * alongside `xDomain` and `yDomain` through component context, so every
 * series compound part nested inside — {@link Chart.Line} today — maps its
 * own data points across the exact same shared scale without a consumer
 * repeating the domain on each one.
 *
 * Also carries the static, position-keyed rules a paired {@link Chart.Legend}
 * reacts against: for each of the eight `data-color` slots, unchecking the
 * matching {@link Chart.Legend.Item} — read by its position among its own
 * `<label>` siblings, the `n`-th one inside the legend — hides every nested
 * series element sharing that slot's `data-color`. This is why
 * {@link Chart.Legend} must render as a later sibling of this root: the
 * rule reaches it through the general sibling combinator, which only
 * matches siblings that follow.
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
				mix={[
					// A paired `Chart.Legend`'s checkboxes drive this — one
					// static rule per categorical color slot, keyed by the
					// checkbox's position among its own `<label>` siblings
					// rather than by any attribute read off the checkbox
					// itself. Any further chart root sharing this same
					// `data-color` contract needs this identical mixin.
					legendToggle(),
					block(),
					is("full"),
					bs("auto"),
					mix,
				]}
			/>
		);
	};
}

Chart.Legend = ChartLegend;

/**
 * Renders one series' representative point markers: a small focusable
 * `<circle>` at each of `markerIndices`' scaled positions, nested with a
 * `<title>` carrying that point's own `label` — the identical marker both
 * {@link Chart.Line} and {@link Chart.Area} place along their plotted
 * points.
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
					focusVisible(outline({ color: "primary.ring", offset: 2 })),
					cursor("default"),
					raw({
						fill: "currentColor",
						r: "var(--ui-chart-point-radius, 0.1875rem)",
					}),
					markerMix,
				]}
			>
				<title>{point.label}</title>
			</circle>
		);
	});
}

/**
 * Renders a line series: a stroked `<path>` connecting `points` in order,
 * plus a reachable marker on a representative spread of them. Every point's
 * data-space `x`/`y` value is mapped to a pixel position through
 * {@link linearScale} built from the ancestor {@link Chart}'s `xDomain` and
 * `yDomain`, and the path's `d` string comes from feeding those scaled
 * positions to {@link linePath}. The path itself renders `aria-hidden`,
 * since it carries no accessible name of its own; each marker is a small
 * focusable `<circle>` nested with a `<title>`, giving assistive technology
 * and hover alike the point's `label`. Markers don't render one per raw
 * point — {@link ticks} generates a "nice", evenly spread set of `xDomain`
 * values first, and each snaps to whichever actual point sits closest to
 * it, keeping a dense series' keyboard and hover surface manageable.
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
						raw({
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "var(--ui-chart-line-width, 2px)",
							strokeLinejoin: "round",
							strokeLinecap: "round",
						}),
						parts?.path,
					]}
				/>
				{renderChartMarkers(points, scaledPoints, markerIndices, parts?.marker)}
			</g>
		);
	};
};

/**
 * Renders the tooltip's own floating host: a native `<div>` positioned
 * absolutely against its nearest positioned ancestor, reading its own
 * position from the `--ui-chart-tooltip-x`/`--ui-chart-tooltip-y` custom
 * properties a `chartTooltip()` mixin writes onto it — the bare pixel
 * position of the point or wedge currently hovered, not a fully offset
 * placement. This host's own `translate` lifts the surface above that
 * coordinate and centers it horizontally, so the mixin only ever supplies
 * the raw position. `left`/`top` read that position deliberately instead of
 * the logical inset properties this catalog otherwise favors: the
 * coordinate a mixin computes comes from the pointer's own physical screen
 * position, the same physical axis `left`/`top` already read from, so no
 * `dir`-based flip would be meaningful for it. Compose
 * {@link Chart.Tooltip.Swatch}, {@link Chart.Tooltip.Label}, and
 * {@link Chart.Tooltip.Value} inside it, matching the hovered point's
 * series color, label, and value.
 *
 * Renders fully transparent and inert at rest: `pointer-events: none` keeps
 * it from ever intercepting the pointer tracking it depends on, and its
 * `opacity`/`scale` stay collapsed until a `chartTooltip()` mixin toggles a
 * `data-open` attribute onto this same host alongside the position
 * properties above, on a point or wedge gaining and losing the pointer's
 * nearest hit. Composing this component without also attaching that mixin
 * to the chart root beside it leaves the surface permanently invisible —
 * the richer tooltip has no rendering of its own to fall back to, unlike
 * the plain hover tooltip and accessible name every point or wedge's native
 * `<title>` already supplies on its own. `aria-hidden="true"` applies by
 * default, since this surface only restates what that native `<title>`
 * already carries.
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
 * Renders a small circular color chip identifying which chart series the
 * tooltip's current point or wedge belongs to: a native `<span>` colored
 * through the `data-color` attribute contract, mapped onto the same
 * eight-slot categorical color sequence (`--ui-chart-1` through
 * `--ui-chart-8`) every series and wedge already render with. Defaults to
 * {@link DEFAULT_SWATCH_COLOR} when `color` is omitted.
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
 * point or wedge's own value, weighted more heavily than
 * {@link Chart.Tooltip.Label} so it reads as the surface's most prominent
 * figure.
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

Chart.Tooltip = ChartTooltip;

/**
 * Renders an area series: a filled `<path>` tracing `points` in order and
 * closing down to `baseline`, plus a reachable marker on a representative
 * spread of them. Every point's data-space `x`/`y` value is mapped to a
 * pixel position through {@link linearScale} built from the ancestor
 * {@link Chart}'s `xDomain` and `yDomain` — the exact same scale calls
 * {@link Chart.Line} makes — and the path's `d` string comes from feeding
 * those scaled positions, plus `baseline` mapped through that same vertical
 * scale, to {@link areaPath}. The path itself renders `aria-hidden`, since it
 * carries no accessible name of its own; each marker is a small focusable
 * `<circle>` nested with a `<title>`, giving assistive technology and hover
 * alike the point's `label`. Markers don't render one per raw point —
 * {@link ticks} generates a "nice", evenly spread set of `xDomain` values
 * first, and each snaps to whichever actual point sits closest to it,
 * keeping a dense series' keyboard and hover surface manageable.
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
						raw({
							fill: "currentColor",
							fillOpacity: "var(--ui-chart-area-fill-opacity, 0.25)",
							stroke: "currentColor",
							strokeWidth: "var(--ui-chart-area-width, 2px)",
							strokeLinejoin: "round",
							strokeLinecap: "round",
						}),
						parts?.path,
					]}
				/>
				{renderChartMarkers(points, scaledPoints, markerIndices, parts?.marker)}
			</g>
		);
	};
};

/**
 * Renders a pie or donut chart: an independent `<svg>` root — not nested
 * inside {@link Chart}, since a circular layout shares no `xDomain`/`yDomain`
 * with a Cartesian series — sized to its container's full inline size, its
 * internal coordinate system fixed by a `viewBox` built from `width` and
 * `height`. {@link pieAngles} allocates one angle span per entry in `data`,
 * proportional to its share of the total, and {@link arcPath} turns each
 * span into that wedge's `d` string: a solid slice by default, or a donut
 * segment once `innerRadius` is set above {@link DEFAULT_PIE_INNER_RADIUS}.
 * Every wedge carries a native SVG `<title>` sourced from its datum's own
 * `label`, plus `tabIndex={0}` and `role="img"`, so the same title that shows
 * as a hover tooltip also becomes the wedge's accessible name the moment
 * keyboard focus reaches it — every wedge is reachable and nameable with no
 * script involved. A wedge whose allocated span computes to nothing (a
 * `value` of `0` or less among otherwise-positive values) renders no `<path>`
 * at all, keeping an empty wedge out of both the drawing and the tab order.
 *
 * Each wedge's fill color reads its own `color` when its datum sets one, or
 * else its position in `data` modulo the palette's slot count — the same
 * `--ui-chart-1` through `--ui-chart-8` palette {@link Chart.Line} and
 * {@link Chart.Area} rotate through for their own series.
 *
 * Also carries the same static, position-keyed rules {@link Chart} itself
 * does: a paired {@link Chart.Legend} rendered as this root's later sibling
 * hides a wedge sharing an unchecked {@link Chart.Legend.Item}'s `data-color`
 * slot, read from that checkbox's position among its own `<label>` siblings
 * rather than any attribute on the checkbox itself.
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
				mix={[
					chartPalette("fill", " "),
					// A paired `Chart.Legend`'s checkboxes drive this — see
					// `Chart`'s own identical mixin for the full rationale;
					// every further independent chart root sharing this
					// `data-color` contract needs the same mixin.
					legendToggle(),
					block(),
					is("full"),
					bs("auto"),
					mix,
				]}
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
								focusVisible(outline({ color: "primary.ring", offset: 2 })),
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
 * Renders a categorical bar chart: an independent `<svg>` root — not nested
 * inside {@link Chart}, since a categorical band axis shares no continuous
 * `xDomain` with a Cartesian series — sized to its container's full inline
 * size, its internal coordinate system fixed by a `viewBox` built from
 * `width` and `height`. Every {@link Chart.BarRow} in `data` becomes one band
 * along the category axis, positioned and sized with {@link bandScale} —
 * subdivided into one inner band per key in `series` when a row plots more
 * than one — and every {@link Chart.BarValue} becomes a `<rect>` whose
 * block-axis position and size come from {@link linearScale} mapping its
 * numeric `value` against `domain`, the same convention
 * {@link Chart.Props.yDomain} uses. {@link ticks} generates the horizontal
 * gridlines drawn behind the bars, spanning that same `domain` at
 * `tickCount`'s approximate resolution.
 *
 * Every bar carries `data-color`, cycling through the same `--ui-chart-1`
 * through `--ui-chart-8` palette {@link Chart.Line}, {@link Chart.Area}, and
 * {@link Chart.Pie} rotate through by its position in `series` — the same
 * positional-cycling rule {@link Chart.Pie} applies to a datum with no
 * explicit color — plus `data-series-index`, that same raw position
 * unwrapped, so the `chartTooltip()` mixin can read a bar's series back off
 * whichever one a pointer lands nearest even past the eighth color. Also
 * carries the same static, position-keyed rules {@link Chart} and
 * {@link Chart.Pie} do: a paired {@link Chart.Legend} rendered as this root's
 * later sibling hides every bar sharing an unchecked
 * {@link Chart.Legend.Item}'s `data-color` slot, read from that checkbox's
 * position among its own `<label>` siblings rather than any attribute on the
 * checkbox itself.
 *
 * The chart needs no script to be useful on its own: every bar is an
 * already-computed `<rect>` reachable in the page's own Tab order, carrying
 * `tabIndex={0}`, `role="img"`, and a native `<title>` that supplies both its
 * hover tooltip and its accessible name on focus — the identical baseline
 * {@link Chart.Line}'s and {@link Chart.Area}'s own point markers, and
 * {@link Chart.Pie}'s own wedges, already establish. The `chartTooltip()`
 * mixin, applied separately, only adds a richer, pointer-positioned tooltip
 * surface on top of that same baseline.
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
				mix={[
					chartPalette("fill", " "),
					// A paired `Chart.Legend`'s checkboxes drive this — see
					// `Chart`'s own identical mixin for the full rationale;
					// every further independent chart root sharing this
					// `data-color` contract needs the same mixin.
					legendToggle(),
					block(),
					is("full"),
					bs("auto"),
					mix,
				]}
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
								raw({
									stroke: "var(--ui-neutral-border)",
									strokeWidth: "1",
									vectorEffect: "non-scaling-stroke",
								}),
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
									focusVisible(outline({ color: "primary.ring", offset: 2 })),
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
