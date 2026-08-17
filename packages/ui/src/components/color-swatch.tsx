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

import { bg, border } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw, userSelect } from "@pkg/u/general";
import { absolute, inlineFlex, inset, items, justify, relative, shrink } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { bs, is } from "@pkg/u/size";
import { after, before, data } from "@pkg/u/state";
import { verticalAlign } from "@pkg/u/typography";
import { attrs } from "remix/ui";

import { mergeStyle } from "../utils/merge-style";

/** Shape variant {@link ColorSwatch} falls back to when `shape` is omitted. */
const DEFAULT_SHAPE: ColorSwatch.Shape = "rounded";

/** Size variant {@link ColorSwatch} falls back to when `size` is omitted. */
const DEFAULT_SIZE: ColorSwatch.Size = "md";

/**
 * Applied through {@link attrs} so the host is hidden from assistive
 * technology by default: the swatch's fill is a raw color value with no
 * text alternative of its own, and every composed use pairs it with a
 * control or label that already carries the accessible name (a field's
 * typed value, a radio swatch's surrounding label). A consumer rendering
 * the swatch on its own and relying on it to carry meaning overrides this
 * with an explicit `aria-hidden={false}` plus an `aria-label` describing the
 * color.
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
		 * The color to preview, already resolved to a literal CSS color value
		 * (a hex string, `rgb()`/`hsl()`/`oklch()` function, or named color) —
		 * never a semantic color role. Required, since a swatch with nothing to
		 * preview has no reason to render.
		 */
		value: string;
		/** Shape variant. Defaults to {@link DEFAULT_SHAPE}. */
		shape?: Shape;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
	}
}

/**
 * Renders a fixed-size `<span>` filled with `value`, sized through the
 * `data-size` attribute contract (`"sm"`, `"md"`, or `"lg"`) and shaped
 * through `data-shape` (`"circle"`, `"square"`, or `"rounded"`). `value`
 * never touches `theme.css` — it carries no semantic meaning the theme's
 * color roles could express — and instead lands on a local, per-instance
 * `--ui-color-swatch-value` custom property, set through the inherited
 * `style` prop on every render so the swatch paints correctly on first
 * paint and after every re-render with no script involved.
 *
 * A `::before` layer paints a fixed checkerboard through a
 * `repeating-conic-gradient`, and a `::after` layer stacks
 * `background-color: var(--ui-color-swatch-value)` on top of it, clipped to
 * the same shape as the host. Where `value` is fully opaque the fill layer
 * hides the checkerboard entirely; where it carries any transparency, the
 * checkerboard shows through exactly where the platform's own compositing
 * says it should, so a translucent value reads correctly regardless of
 * whatever background happens to sit behind the swatch on the page.
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
