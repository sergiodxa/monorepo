/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

/** Common named aspect ratios, resolved without a width/height pair. */
export type AspectRatioName = "square" | "video" | "widescreen" | "portrait" | "story" | "photo";

const ASPECT_RATIOS: Record<AspectRatioName, string> = {
	square: "1 / 1",
	video: "16 / 9",
	widescreen: "21 / 9",
	portrait: "3 / 4",
	story: "9 / 16",
	photo: "4 / 3",
};

/**
 * Applies `aspect-ratio`, either from a width and height pair or one of a
 * handful of common named ratios. Aspect ratios otherwise vary too
 * continuously for a full token family to pay for itself, so only these few
 * common shapes get names:
 *
 * - `"square"` — 1 / 1
 * - `"video"` — 16 / 9, standard widescreen video
 * - `"widescreen"` — 21 / 9, ultrawide/cinema
 * - `"portrait"` — 3 / 4, print/photo portrait orientation
 * - `"story"` — 9 / 16, vertical video (Stories, Reels, Shorts)
 * - `"photo"` — 4 / 3, standard print/photo landscape orientation
 *
 * @example u.aspect(16, 9)
 * @example css({ aspectRatio: "16 / 9" })
 * @example u.aspect("square")
 * @example css({ aspectRatio: "1 / 1" })
 */
export function aspect<Node extends Element = Element>(ratio: AspectRatioName): UtilityMixin<Node>;
export function aspect<Node extends Element = Element>(
	width: number,
	height: number,
): UtilityMixin<Node>;
export function aspect<Node extends Element = Element>(
	widthOrRatio: number | AspectRatioName,
	height?: number,
): UtilityMixin<Node> {
	return utility<Node>(() => ({
		aspectRatio:
			typeof widthOrRatio === "number"
				? `${widthOrRatio} / ${height}`
				: ASPECT_RATIOS[widthOrRatio],
	}));
}
