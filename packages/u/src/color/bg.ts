/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";
import type { ColorValue } from "../types";

import { var as varUtility } from "../general/var";
import { utility } from "../internal/descriptor";
import { color } from "../internal/tokens";

export type BackgroundRepeatValue =
	| "repeat"
	| "no-repeat"
	| "repeat-x"
	| "repeat-y"
	| "round"
	| "space";

export type BackgroundAttachmentValue = "scroll" | "fixed" | "local";

export type BackgroundClipValue = "border-box" | "padding-box" | "content-box" | "text";

export interface BgOptions {
	/** Sets `background-color`. Same accepted shapes as `u.bg(value)`. */
	color?: ColorValue | (string & {});
	/** Sets `background-image` — a `url(...)` reference or a CSS gradient. */
	image?: string;
	/** Sets `background-size` (e.g. `"cover"`, `"contain"`, `"100% auto"`). */
	size?: "auto" | "cover" | "contain" | (string & {});
	/** Sets `background-position` (e.g. `"center"`, `"top left"`, `"50% 50%"`). */
	position?: string;
	/** Sets `background-repeat`. */
	repeat?: BackgroundRepeatValue;
	/** Sets `background-attachment`. */
	attachment?: BackgroundAttachmentValue;
	/**
	 * Sets `background-clip`, the area the background is actually painted in:
	 *
	 * - `"border-box"` — out to the outer edge of the border, the initial value,
	 *   so a translucent or dashed border shows the background through its gaps.
	 * - `"padding-box"` — stops at the outer edge of the padding, so the border
	 *   sits over the page instead of over the background.
	 * - `"content-box"` — stops at the content edge, leaving the padding
	 *   unpainted.
	 * - `"text"` — clips the background to the shape of the element's glyphs.
	 *
	 * Two of these carry real weight. `"content-box"` is how a background is
	 * kept from painting under the padding, which is what draws an inset
	 * scrollbar thumb: a thumb with padding and a content-box background reads
	 * as a narrow pill floating inside its track rather than filling it.
	 * `"text"` is how a gradient fills text — it needs a transparent text color
	 * for the clipped background to be visible at all, and the text underneath
	 * must stay real, selectable text rather than becoming an image, so it is
	 * still readable to assistive technology, searchable, and translatable.
	 */
	clip?: BackgroundClipValue;
}

/**
 * Applies `background-color`, or a full set of background properties when
 * given an options object instead of a bare color. Called with no argument
 * it resolves the tiny system default (`var(--ui-bg, Canvas)`); called with
 * a semantic tone it requires the `tint`/`solid` suffix so the call site
 * states which background weight it means (`u.bg("brand.tint")`,
 * `u.bg("brand.solid")`). Called with an options object, only the given
 * keys are set — `color` alone still requires the same explicit suffix.
 *
 * @example u.bg()
 * @example css({ backgroundColor: "var(--ui-bg, Canvas)" })
 * @example u.bg("brand.tint")
 * @example css({ backgroundColor: "var(--ui-brand-bg-tint)" })
 * @example u.bg({ image: "url(/hero.jpg)", size: "cover", position: "center" })
 * @example css({ backgroundImage: "url(/hero.jpg)", backgroundSize: "cover", backgroundPosition: "center" })
 * @example u.bg({ color: "brand.solid", clip: "content-box" })
 * @example css({ backgroundColor: "var(--ui-brand-bg-solid)", backgroundClip: "content-box" })
 */
export function bg<Node extends Element = Element>(
	value?: ColorValue | (string & {}),
): UtilityMixin<Node>;
export function bg<Node extends Element = Element>(options: BgOptions): UtilityMixin<Node>;
export function bg<Node extends Element = Element>(
	valueOrOptions?: ColorValue | (string & {}) | BgOptions,
): UtilityMixin<Node> {
	if (valueOrOptions === undefined || typeof valueOrOptions === "string") {
		return utility<Node>(() => ({
			backgroundColor: valueOrOptions ? color(valueOrOptions) : varUtility("ui-bg", "Canvas"),
		}));
	}

	let options = valueOrOptions;
	return utility<Node>(() => {
		let result: Record<string, string> = {};
		if (options.color !== undefined) result.backgroundColor = color(options.color);
		if (options.image !== undefined) result.backgroundImage = options.image;
		if (options.size !== undefined) result.backgroundSize = options.size;
		if (options.position !== undefined) result.backgroundPosition = options.position;
		if (options.repeat !== undefined) result.backgroundRepeat = options.repeat;
		if (options.attachment !== undefined) result.backgroundAttachment = options.attachment;
		if (options.clip !== undefined) result.backgroundClip = options.clip;
		return result as CSSStyles;
	});
}
