/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Truncates text to a fixed number of lines with an ellipsis, using the
 * standard `-webkit-line-clamp` trick (a `-webkit-box` with vertical box
 * orientation). Widely supported despite the vendor prefix; there is no
 * unprefixed equivalent with comparable support yet.
 *
 * @example u.lineClamp(3)
 * @example css({ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" })
 */
export function lineClamp<Node extends Element = Element>(lines: number) {
	return utility<Node>(() => ({
		display: "-webkit-box",
		WebkitBoxOrient: "vertical",
		WebkitLineClamp: lines,
		overflow: "hidden",
	}));
}
