/**
 * Frames marketing content in a ruled column: 1px hairline rails down both sides of the
 * content measure, an optional top rule, and "+" marks where the rules meet. Stacked rails
 * read as one continuous column, the way an engineered product page draws its grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";

import type { MarketingSectionSpacing } from "../styles/marketing.js";

import { marketingSectionSpace } from "../styles/marketing.js";

import { Crosshair } from "./crosshair.js";

/** Container the column queries, sized to the full width the rails sit in. */
const RAILS_CONTAINER = "ui-rails";

/** Translucent ink the rails and the top rule draw with. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** A rail or rule: one solid hairline. */
const RULE = `1px solid ${HAIRLINE}`;

/** Block padding {@link Rails} applies when `spacing` is omitted. */
const DEFAULT_SPACING: Rails.Spacing = "normal";

/**
 * Prop types for {@link Rails}.
 */
export namespace Rails {
	/** A marketing band's block padding step, or `flush` for none. */
	export type Spacing = MarketingSectionSpacing | "flush";

	/** `corners` draws a {@link Crosshair} where each rail meets the top and bottom edge. */
	export type Marks = "none" | "corners";

	/**
	 * Props accepted by {@link Rails}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Draws a hairline across the top of the column so stacked rails read as one grid. */
		ruled?: boolean;
		/** Registration marks at the column's corners. Defaults to `none`. */
		marks?: Marks;
		/** Block padding inside the column. Defaults to {@link DEFAULT_SPACING}. */
		spacing?: Spacing;
		/** Content to frame. */
		children: RemixNode;
	}
}

/**
 * Wraps content in a column at `--ui-marketing-measure` whose hairline rails run its full
 * height. From the `md` container up each rail takes 1px out of the gutter, so text inside
 * lines up with a `marketingContainer()` band above or below; below `md` the rails and
 * marks hide and the column keeps the full phone width.
 *
 * @param handle Runtime handle carrying the outer `<div>`'s props.
 * @returns The render function producing the framed column.
 * @example
 * <Rails ruled marks="corners">
 * 	<MarketingHeader eyebrow={t("grid.eyebrow")}>{t("grid.title")}</MarketingHeader>
 * </Rails>
 */
export function Rails(handle: Handle<Rails.Props>) {
	return () => {
		let { children, marks, mix, ruled, spacing, ...rest } = handle.props;
		let resolvedSpacing = spacing ?? DEFAULT_SPACING;

		return (
			<div
				{...rest}
				data-slot="rails"
				data-ruled={ruled ? "true" : undefined}
				data-marks={marks ?? "none"}
				mix={[container(RAILS_CONTAINER), raw({ inlineSize: "100%" }), mix]}
			>
				<div
					data-slot="rails-column"
					mix={[
						raw({
							position: "relative",
							maxInlineSize: "var(--ui-marketing-measure, 72rem)",
							marginInline: "auto",
							paddingInline: "var(--ui-marketing-gutter, 1rem)",
						}),
						ruled ? raw({ borderBlockStart: RULE }) : [],
						resolvedSpacing === "flush" ? [] : marketingSectionSpace(resolvedSpacing),
						at(
							"md",
							RAILS_CONTAINER,
							raw({ borderInline: RULE, paddingInline: "calc(1.5rem - 1px)" }),
						),
						at("lg", RAILS_CONTAINER, raw({ paddingInline: "calc(2rem - 1px)" })),
					]}
				>
					{children}
					{marks === "corners" ? <CornerMarks /> : null}
				</div>
			</div>
		);
	};
}

/**
 * The four corner marks, on a layer pulled out half a pixel past the column's padding edge
 * so each mark's centre lands on the middle of a rail pixel and its arms stay crisp.
 * Hidden with the rails below the `md` container.
 *
 * @param _handle Runtime handle; the marks take no props.
 * @returns The render function producing the mark layer.
 */
function CornerMarks(_handle: Handle<Record<string, never>>) {
	return () => (
		<span
			aria-hidden="true"
			data-slot="rails-marks"
			mix={[
				raw({ display: "none", position: "absolute", inset: "-0.5px", pointerEvents: "none" }),
				at("md", RAILS_CONTAINER, raw({ display: "block" })),
			]}
		>
			<Crosshair corner="start-start" />
			<Crosshair corner="start-end" />
			<Crosshair corner="end-start" />
			<Crosshair corner="end-end" />
		</span>
	);
}
