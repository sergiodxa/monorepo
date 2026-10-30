/**
 * A numeric proof strip for marketing bands: each cell carries a value and a
 * label supplied by the page, laid out as a responsive grid with ruled or
 * gapped seams.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { p, width } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import {
	balance,
	leading,
	tabularNums,
	text,
	textAlign,
	tracking,
	weight,
} from "@sdxc/u/typography";

/** Seam treatment {@link StatStrip} applies when `variant` is omitted. */
const DEFAULT_VARIANT: StatStrip.Variant = "ruled";

/** Edge every figure and label share when `align` is omitted. */
const DEFAULT_ALIGN: StatStrip.Align = "start";

/** Figure step {@link StatStrip} applies when `size` is omitted. */
const DEFAULT_SIZE: StatStrip.Size = "base";

/**
 * Prop types for {@link StatStrip} and its compound parts.
 */
export namespace StatStrip {
	/**
	 * How cells meet: a hairline between them, or a gap with no rule.
	 */
	export type Variant = "ruled" | "gap";

	/**
	 * Edge each cell's figure and label share: `start`, or `center` for a strip in a
	 * centred band that should read centred too.
	 */
	export type Align = "start" | "center";

	/**
	 * Figure step: `base` at 1.875rem, or `display`, a fluid 2.5–4.5rem numeral that
	 * scales with the strip's width for a strip that is the band's headline.
	 */
	export type Size = "base" | "display";

	/**
	 * Value {@link StatStrip} provides so every item draws for the strip's alignment and size.
	 */
	export interface Context {
		/** Edge every item's figure and label share. */
		align: Align;
		/** Figure step every item draws. */
		size: Size;
	}

	/**
	 * Props accepted by {@link StatStrip}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Seam treatment. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/**
		 * Edge each figure and its label share, whatever text alignment the band
		 * around the strip sets. Defaults to {@link DEFAULT_ALIGN}.
		 */
		align?: Align;
		/** Figure step. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/** One or more {@link StatStrip.Item} cells. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link StatStrip.Item}.
	 */
	export interface ItemProps extends TagProps<"div"> {
		/** What the number counts — always supplied by the page. */
		label: RemixNode;
		/** The figure itself. */
		children: RemixNode;
	}
}

/**
 * Lays {@link StatStrip.Item} children in two columns, then in one row from `lg`
 * (48rem) of its own width. The host is the sizing container and fills its parent,
 * and each cell sets its own text alignment, so a centring band never re-aligns labels.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the strip's markup.
 * @example
 * <StatStrip>
 * 	<StatStrip.Item label={t("stats.packages")}>42</StatStrip.Item>
 * 	<StatStrip.Item label={t("stats.apps")}>12</StatStrip.Item>
 * </StatStrip>
 */
export function StatStrip(handle: Handle<StatStrip.Props, StatStrip.Context>) {
	return () => {
		let { align, children, mix, size, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedAlign = align ?? DEFAULT_ALIGN;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let isRuled = resolvedVariant === "ruled";

		handle.context.set({ align: resolvedAlign, size: resolvedSize });

		return (
			<div
				{...rest}
				data-variant={resolvedVariant}
				data-align={resolvedAlign}
				data-size={resolvedSize}
				data-slot="stat-strip"
				mix={[container("ui-marketing-stat-strip"), width("full"), mix]}
			>
				<div
					mix={[
						grid(),
						isRuled ? gap(0) : gap(6),
						/**
						 * Two columns on a phone with an odd last figure spanning the row, then
						 * every figure in one row from the `lg` container, whatever the count, so
						 * no figure is ever left alone on a row or beside an empty track. One rule
						 * owns `grid-column`, so the reset at `lg` wins in any stylesheet order.
						 */
						combine([
							gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
							when("& > :last-child:nth-child(odd)", raw({ gridColumn: "1 / -1" })),
							at("lg", "ui-marketing-stat-strip", [
								raw({
									gridTemplateColumns: "none",
									gridAutoFlow: "column",
									gridAutoColumns: "minmax(0, 1fr)",
								}),
								when("& > :last-child:nth-child(odd)", raw({ gridColumn: "auto" })),
							]),
						]),
						when("& > *", [p(6, 5), at("lg", "ui-marketing-stat-strip", p(8, 8))]),
						isRuled
							? when(
									"& > * + *",
									at(
										"lg",
										"ui-marketing-stat-strip",
										raw({
											borderInlineStartWidth: "1px",
											borderInlineStartStyle: "solid",
											borderInlineStartColor: "var(--ui-marketing-hairline)",
										}),
									),
								)
							: [],
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * One proof cell: the figure as `children` in tabular digits, and what it counts as
 * `label`, both on the strip's `align` edge.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the cell's markup.
 * @example
 * <StatStrip.Item label={t("stats.uptime")}>99.99%</StatStrip.Item>
 */
StatStrip.Item = function StatStripItem(handle: Handle<StatStrip.ItemProps>) {
	return () => {
		let { children, label, mix, ...rest } = handle.props;
		let context = handle.context.get(StatStrip) as StatStrip.Context | undefined;
		let align = context?.align ?? DEFAULT_ALIGN;
		let isDisplay = context?.size === "display";

		return (
			<div
				{...rest}
				data-slot="stat-strip-item"
				mix={[vstack({ gap: isDisplay ? 2 : 1, align }), textAlign(align), mix]}
			>
				<span
					data-slot="stat-strip-figure"
					mix={[
						isDisplay
							? raw({
									fontSize: "clamp(2.5rem, 1.6rem + 3.5cqi, 4.5rem)",
									lineHeight: "1",
									letterSpacing: "-0.04em",
								})
							: [text("3xl"), tracking("tight"), leading("none")],
						weight("medium"),
						tabularNums(),
						fg("neutral.emphasis"),
					]}
				>
					{children}
				</span>
				<span mix={[text("sm"), leading("snug"), balance(), fg("neutral")]}>{label}</span>
			</div>
		);
	};
};
