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
 * `lines` is stringified rather than passed as a number: the CSS serializer
 * appends `px` to any unitless number whose property isn't on its unitless
 * allow-list, and `-webkit-line-clamp` isn't on it. `-webkit-line-clamp: 3px`
 * is invalid, so the declaration is dropped and nothing clamps. Do not
 * "simplify" the `String()` away.
 *
 * @example u.lineClamp(3)
 * @example css({ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: "3", overflow: "hidden" })
 */
export function lineClamp<Node extends Element = Element>(lines: number) {
	return utility<Node>(() => ({
		display: "-webkit-box",
		WebkitBoxOrient: "vertical",
		WebkitLineClamp: String(lines),
		overflow: "hidden",
	}));
}
