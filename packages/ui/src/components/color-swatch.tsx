/**
 * A static preview box rendering one color value as a filled, shaped
 * swatch, backed by a fixed checkerboard so a translucent value always
 * reads correctly against whatever sits behind it on the page rather than
 * blending invisibly away. The value paints through two stacked layers: a
 * checkerboard base and a color fill on top, clipped together to a circular,
 * square, or softly rounded shape at one of three fixed sizes. Every other
 * color preview in this component family composes this box for its own
 * preview instead of redrawing the checkerboard-plus-fill technique itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw, userSelect } from "@sdxc/u/general";
import { absolute, inlineFlex, inset, items, justify, relative, shrink } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is } from "@sdxc/u/size";
import { after, before, data } from "@sdxc/u/state";
import { verticalAlign } from "@sdxc/u/typography";
import { attrs } from "remix/ui";

import { mergeStyle } from "../utils/merge-style.js";

/** Shape variant {@link ColorSwatch} falls back to when `shape` is omitted. */
const DEFAULT_SHAPE: ColorSwatch.Shape = "rounded";

/** Size variant {@link ColorSwatch} falls back to when `size` is omitted. */
const DEFAULT_SIZE: ColorSwatch.Size = "md";

/**
 * Applied through {@link attrs} so the host is hidden from assistive
 * technology by default, since composed uses supply their own accessible
 * name; pass `aria-hidden={false}` and `aria-label` to render standalone.
 */
const DEFAULT_ARIA_HIDDEN = "true";

/**
 * Prop types for {@link ColorSwatch}.
 */
export namespace ColorSwatch {
	/**
	 * Shape variant controlling the swatch's corner rounding: `"circle"`
	 * renders a fully rounded disc, `"square"` renders sharp corners, and
	 * `"rounded"` renders a softly rounded square.
	 */
	export type Shape = "circle" | "square" | "rounded";

	/**
	 * Size variant controlling the swatch's rendered dimensions.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Props accepted by {@link ColorSwatch}.
	 */
	export interface Props extends TagProps<"span"> {
		/**
		 * The color to preview, already resolved to a literal CSS value — a hex
		 * string, `rgb()`/`hsl()`/`oklch()` function, or named color. Required,
		 * since a swatch with nothing to preview has no reason to render.
		 */
		value: string;
		/** Shape variant. Defaults to {@link DEFAULT_SHAPE}. */
		shape?: Shape;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
	}
}

/**
 * Renders a fixed-size `<span>` that paints `value` through a local
 * `--ui-color-swatch-value` custom property, layered over a `::before`
 * checkerboard so any transparency in `value` reads correctly.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the swatch's markup.
 * @example
 * <ColorSwatch value="#3b82f6" />
 * @example
 * <ColorSwatch value="rgb(16 185 129 / 0.4)" shape="circle" size="lg" />
 */
export function ColorSwatch(handle: Handle<ColorSwatch.Props>) {
	return () => {
		let { value, shape, size, mix, style, ...rest } = handle.props;
		let resolvedShape = shape ?? DEFAULT_SHAPE;
		let resolvedSize = size ?? DEFAULT_SIZE;
		let resolvedStyle = mergeStyle(style, { "--ui-color-swatch-value": value });

		return (
			<span
				{...rest}
				data-slot="swatch"
				data-shape={resolvedShape}
				data-size={resolvedSize}
				style={resolvedStyle}
				mix={[
					attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN }),
					relative(),
					inlineFlex(),
					items("center"),
					justify("center"),
					overflow("hidden"),
					border({ width: 1, color: "neutral" }),
					is("var(--ui-color-swatch-size-md, 1.75rem)"),
					bs("var(--ui-color-swatch-size-md, 1.75rem)"),
					rounded("md"),
					data("size", "sm", [
						is("var(--ui-color-swatch-size-sm, 1.25rem)"),
						bs("var(--ui-color-swatch-size-sm, 1.25rem)"),
					]),
					data("size", "lg", [
						is("var(--ui-color-swatch-size-lg, 2.5rem)"),
						bs("var(--ui-color-swatch-size-lg, 2.5rem)"),
					]),
					data("shape", "circle", rounded("full")),
					shrink(),
					verticalAlign("middle"),
					userSelect(),
					data("shape", "square", rounded("none")),
					before([
						absolute(),
						inset(0),
						bg({
							image:
								"repeating-conic-gradient(var(--ui-neutral-border) 0% 25%, var(--ui-neutral-bg-tint) 0% 50%)",
							size: "var(--ui-color-swatch-checker-size, 0.625rem) var(--ui-color-swatch-checker-size, 0.625rem)",
						}),
						raw({ content: '""' }),
					]),
					after([
						absolute(),
						inset(0),
						bg("var(--ui-color-swatch-value, transparent)"),
						raw({ content: '""' }),
					]),
					mix,
				]}
			/>
		);
	};
}
