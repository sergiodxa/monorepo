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
import { balance, leading, text, tracking, weight } from "@sdxc/u/typography";

/** Seam treatment {@link StatStrip} applies when `variant` is omitted. */
const DEFAULT_VARIANT: StatStrip.Variant = "ruled";

/**
 * Prop types for {@link StatStrip} and its compound parts.
 */
export namespace StatStrip {
	/**
	 * How cells meet: a hairline between them, or a gap with no rule.
	 */
	export type Variant = "ruled" | "gap";

	/**
	 * Props accepted by {@link StatStrip}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Seam treatment. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
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
 * (48rem) of its own width. The host is the sizing container and fills its
 * parent's inline size, so a centering band still gives the tracks room.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the strip's markup.
 * @example
 * <StatStrip>
 * 	<StatStrip.Item label={t("stats.packages")}>42</StatStrip.Item>
 * 	<StatStrip.Item label={t("stats.apps")}>12</StatStrip.Item>
 * </StatStrip>
 */
export function StatStrip(handle: Handle<StatStrip.Props>) {
	return () => {
		let { children, mix, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let isRuled = resolvedVariant === "ruled";

		return (
			<div
				{...rest}
				data-variant={resolvedVariant}
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
 * One proof cell: the figure as `children`, and what it counts as `label`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the cell's markup.
 * @example
 * <StatStrip.Item label={t("stats.uptime")}>99.99%</StatStrip.Item>
 */
StatStrip.Item = function StatStripItem(handle: Handle<StatStrip.ItemProps>) {
	return () => {
		let { children, label, mix, ...rest } = handle.props;

		return (
			<div {...rest} data-slot="stat-strip-item" mix={[vstack({ gap: 1, align: "start" }), mix]}>
				<span
					mix={[
						text("3xl"),
						weight("medium"),
						tracking("tight"),
						leading("none"),
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
