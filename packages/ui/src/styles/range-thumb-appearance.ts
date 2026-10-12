/**
 * The `rangeThumbAppearance()` style-mixin factory: the circular thumb a
 * native `<input type="range">` paints through its own
 * `::-webkit-slider-thumb` and `::-moz-range-thumb` pseudo-elements — the
 * appearance reset, fill and border colors, elevation shadow, pressed scale,
 * focus-visible ring, and disabled dimming shared by every single-channel
 * range control in the catalog, whichever pair of custom properties that
 * control reads its own thumb size and border width from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/component";

import { bg, border, outline } from "@sdxc/u/color";
import { rounded, shadow, transition, transitionDuration } from "@sdxc/u/effects";
import { combine, cursor, raw } from "@sdxc/u/general";
import { appearance } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { scaleProperty } from "@sdxc/u/transform";

import type { CSSStyles } from "../utils/css-styles.js";

/**
 * The declarations shared by both engines' thumb pseudo-elements; the
 * webkit-only appearance reset is composed separately by the caller. The
 * lift reads the theme's `--ui-shadow-base`, so it follows the app's shadow scale.
 */
function thumbBase<Node extends Element = Element>(size: string, borderWidth: string) {
	return combine<Node>([
		is<Node>(size),
		bs<Node>(size),
		rounded<Node>("full"),
		border<Node>({ color: "brand.solid", width: borderWidth }),
		bg<Node>("neutral.tint"),
		shadow<Node>("base"),
		cursor<Node>("pointer"),
		transition<Node>("box-shadow, scale", {
			duration: 150,
			easing: "cubic-bezier(0.4, 0, 0.2, 1)",
		}),
	]);
}

/**
 * Composes the range thumb's shared appearance recipe — reset, shape, border,
 * fill, shadow, pressed scale, focus ring, and disabled dimming — identical
 * across every control except the size and border-width properties given here.
 *
 * @param sizeVariable Custom property (with its leading `--`) the thumb reads its own inline and block size from, falling back to `1.25rem`.
 * @param borderWidthVariable Custom property (with its leading `--`) the thumb reads its own border width from, falling back to `2px`.
 * @returns A mixin ready for a host element's `mix` prop.
 * @example
 * <input
 * 	type="range"
 * 	mix={[
 * 		rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
 * 		css({
 * 			position: "absolute",
 * 			inset: "0",
 * 			// ...the control's own reset and track declarations
 * 		}),
 * 	]}
 * />;
 */
export function rangeThumbAppearance<Node extends Element = Element>(
	sizeVariable: string,
	borderWidthVariable: string,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let size = `var(${sizeVariable}, 1.25rem)`;
	let borderWidth = `var(${borderWidthVariable}, 2px)`;

	return combine<Node>([
		when<Node>(
			"&::-webkit-slider-thumb",
			combine<Node>([appearance<Node>("none", { moz: false }), thumbBase<Node>(size, borderWidth)]),
		),
		when<Node>("&::-moz-range-thumb", thumbBase<Node>(size, borderWidth)),
		when<Node>("&:active::-webkit-slider-thumb", scaleProperty<Node>(1.1)),
		when<Node>("&:active::-moz-range-thumb", scaleProperty<Node>(1.1)),
		when<Node>(
			"&:focus-visible::-webkit-slider-thumb",
			outline<Node>({ color: "brand.ring", offset: 2 }),
		),
		when<Node>(
			"&:focus-visible::-moz-range-thumb",
			outline<Node>({ color: "brand.ring", offset: 2 }),
		),
		when<Node>("&:disabled::-webkit-slider-thumb", [
			cursor<Node>("not-allowed"),
			raw<Node>({ boxShadow: "none" }),
			border<Node>("neutral"),
		]),
		when<Node>("&:disabled::-moz-range-thumb", [
			cursor<Node>("not-allowed"),
			raw<Node>({ boxShadow: "none" }),
			border<Node>("neutral"),
		]),
		media<Node>("(prefers-reduced-motion: reduce)", [
			when<Node>("&::-webkit-slider-thumb", transitionDuration<Node>("0s")),
			when<Node>("&::-moz-range-thumb", transitionDuration<Node>("0s")),
		]),
	]);
}
