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
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { bg, border, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { combine, raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";

import type { CSSStyles } from "../utils/css-styles";

/**
 * The declarations shared by both engines' thumb pseudo-elements; the
 * webkit-only appearance reset is composed separately by the caller. Its
 * box-shadow stays raw; no shared shadow-scale entry matches this value.
 */
function thumbBase<Node extends Element = Element>(size: string, borderWidth: string) {
	return combine<Node>([
		is<Node>(size),
		bs<Node>(size),
		rounded<Node>("full"),
		border<Node>({ color: "brand.solid", width: borderWidth }),
		bg<Node>("neutral.tint"),
		raw<Node>({
			boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
			cursor: "pointer",
		}),
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
			combine<Node>([
				raw<Node>({ WebkitAppearance: "none", appearance: "none" }),
				thumbBase<Node>(size, borderWidth),
			]),
		),
		when<Node>("&::-moz-range-thumb", thumbBase<Node>(size, borderWidth)),
		when<Node>("&:active::-webkit-slider-thumb", raw<Node>({ scale: "1.1" })),
		when<Node>("&:active::-moz-range-thumb", raw<Node>({ scale: "1.1" })),
		when<Node>(
			"&:focus-visible::-webkit-slider-thumb",
			outline<Node>({ color: "brand.ring", offset: 2 }),
		),
		when<Node>(
			"&:focus-visible::-moz-range-thumb",
			outline<Node>({ color: "brand.ring", offset: 2 }),
		),
		when<Node>("&:disabled::-webkit-slider-thumb", [
			raw<Node>({ cursor: "not-allowed", boxShadow: "none" }),
			border<Node>("neutral"),
		]),
		when<Node>("&:disabled::-moz-range-thumb", [
			raw<Node>({ cursor: "not-allowed", boxShadow: "none" }),
			border<Node>("neutral"),
		]),
		media<Node>("(prefers-reduced-motion: reduce)", [
			when<Node>("&::-webkit-slider-thumb", raw<Node>({ transitionDuration: "0s" })),
			when<Node>("&::-moz-range-thumb", raw<Node>({ transitionDuration: "0s" })),
		]),
	]);
}
