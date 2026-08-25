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
	repeat?: BackgroundRepeatValue;
	attachment?: BackgroundAttachmentValue;
	/**
	 * Sets `background-clip`. `"content-box"` keeps the paint off the padding,
	 * which makes an inset scrollbar thumb read as a pill inside its track;
	 * `"text"` clips to the glyphs, so the text color must be transparent.
	 */
	clip?: BackgroundClipValue;
}

/**
 * Applies `background-color`, or the full set of background properties when
 * given an options object, of which only the given keys are set. A semantic
 * tone requires a `tint`/`solid` suffix so the call site states its weight.
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
