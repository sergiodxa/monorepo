/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/** How a mask image tiles when it's smaller than the element it masks. */
export type MaskRepeatValue = "repeat" | "no-repeat" | "repeat-x" | "repeat-y" | "round" | "space";

/** Which channel of the mask image is read as the alpha value. */
export type MaskModeValue = "alpha" | "luminance" | "match-source";

export interface MaskOptions {
	/** Sets `mask-image`. Same accepted shapes as `u.mask(image)`. */
	image?: string;
	/** Sets `mask-size` (e.g. `"cover"`, `"contain"`, `"24px 24px"`). */
	size?: string;
	/** Sets `mask-position` (e.g. `"center"`, `"top left"`, `"50% 50%"`). */
	position?: string;
	/** Sets `mask-repeat`. Defaults, per CSS, to `repeat` — pass `"no-repeat"` for a single-instance mask. */
	repeat?: MaskRepeatValue;
	/** Sets `mask-mode`, choosing whether the mask's alpha or its luminance drives the masking. */
	mode?: MaskModeValue;
}

/**
 * Applies a CSS mask image, or the given subset of mask properties when
 * passed an options object. Every property is mirrored onto its `-webkit-`
 * prefixed twin, which Safari requires to render an element mask.
 *
 * @example u.mask("linear-gradient(to bottom, transparent, black)")
 * @example css({ maskImage: "linear-gradient(to bottom, transparent, black)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black)" })
 * @example u.mask({ image: "url(/badge.png)", size: "contain", position: "center", repeat: "no-repeat" })
 * @example css({ maskImage: "url(/badge.png)", WebkitMaskImage: "url(/badge.png)", maskSize: "contain", WebkitMaskSize: "contain", maskPosition: "center", WebkitMaskPosition: "center", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" })
 */
export function mask<Node extends Element = Element>(image: string): UtilityMixin<Node>;
export function mask<Node extends Element = Element>(options: MaskOptions): UtilityMixin<Node>;
export function mask<Node extends Element = Element>(
	imageOrOptions: string | MaskOptions,
): UtilityMixin<Node> {
	if (typeof imageOrOptions === "string") {
		let image = imageOrOptions;
		return utility<Node>(() => ({ maskImage: image, WebkitMaskImage: image }));
	}

	let options = imageOrOptions;
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		if (options.image !== undefined) {
			result.maskImage = options.image;
			result.WebkitMaskImage = options.image;
		}
		if (options.size !== undefined) {
			result.maskSize = options.size;
			result.WebkitMaskSize = options.size;
		}
		if (options.position !== undefined) {
			result.maskPosition = options.position;
			result.WebkitMaskPosition = options.position;
		}
		if (options.repeat !== undefined) {
			result.maskRepeat = options.repeat;
			result.WebkitMaskRepeat = options.repeat;
		}
		if (options.mode !== undefined) {
			result.maskMode = options.mode;
			result.WebkitMaskMode = options.mode;
		}
		return result as CSSStyles;
	});
}
