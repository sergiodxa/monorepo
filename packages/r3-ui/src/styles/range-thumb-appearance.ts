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

import { css } from "remix/ui";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Composes the circular range-thumb painting recipe every single-channel
 * range control in the catalog composes directly in its own `mix` array: the
 * thumb's appearance reset, `radius-full` shape, primary border over a
 * neutral fill, elevation shadow, a pressed scale of `1.1`, a primary
 * focus-visible ring, and disabled dimming, plus the reduced-motion override
 * collapsing its transition to an instant change. `sizeVariable` and
 * `borderWidthVariable` are the only two declarations that vary between
 * controls — which custom properties the thumb reads its own diameter and
 * border thickness from — every other declaration stays identical regardless
 * of which control composes this factory.
 *
 * Composed at the top level of a host's `mix` array alongside a separate
 * `css()` call carrying that host's own reset, track, and orientation
 * declarations, so the shared thumb recipe and the host's local styling stay
 * as two distinct mixins instead of one merged object.
 *
 * @param sizeVariable Custom property (with its leading `--`) the thumb reads its own inline and block size from, falling back to `1.25rem`.
 * @param borderWidthVariable Custom property (with its leading `--`) the thumb reads its own border width from, falling back to `2px`.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
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

	let webkitThumb: CSSStyles = {
		WebkitAppearance: "none",
		appearance: "none",
		inlineSize: size,
		blockSize: size,
		borderRadius: "var(--ui-radius-full, 9999px)",
		borderWidth,
		borderStyle: "solid",
		borderColor: "var(--ui-primary-bg-solid)",
		backgroundColor: "var(--ui-neutral-bg-tint)",
		boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
		cursor: "pointer",
		transitionProperty: "box-shadow, scale",
		transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
		transitionDuration: "150ms",
	};

	let mozThumb: CSSStyles = {
		inlineSize: size,
		blockSize: size,
		borderRadius: "var(--ui-radius-full, 9999px)",
		borderWidth,
		borderStyle: "solid",
		borderColor: "var(--ui-primary-bg-solid)",
		backgroundColor: "var(--ui-neutral-bg-tint)",
		boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
		cursor: "pointer",
		transitionProperty: "box-shadow, scale",
		transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
		transitionDuration: "150ms",
	};

	return css<Node>({
		"&::-webkit-slider-thumb": webkitThumb,
		"&::-moz-range-thumb": mozThumb,
		"&:active::-webkit-slider-thumb": { scale: "1.1" },
		"&:active::-moz-range-thumb": { scale: "1.1" },
		"&:focus-visible::-webkit-slider-thumb": {
			outlineWidth: "2px",
			outlineStyle: "solid",
			outlineOffset: "2px",
			outlineColor: "var(--ui-primary-ring)",
		},
		"&:focus-visible::-moz-range-thumb": {
			outlineWidth: "2px",
			outlineStyle: "solid",
			outlineOffset: "2px",
			outlineColor: "var(--ui-primary-ring)",
		},
		"&:disabled::-webkit-slider-thumb": {
			cursor: "not-allowed",
			boxShadow: "none",
			borderColor: "var(--ui-neutral-border)",
		},
		"&:disabled::-moz-range-thumb": {
			cursor: "not-allowed",
			boxShadow: "none",
			borderColor: "var(--ui-neutral-border)",
		},
		"@media (prefers-reduced-motion: reduce)": {
			"&::-webkit-slider-thumb": { transitionDuration: "0s" },
			"&::-moz-range-thumb": { transitionDuration: "0s" },
		},
	});
}
