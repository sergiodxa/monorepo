/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Truncates text via the `-webkit-line-clamp` trick. `lines` is
 * stringified because the CSS serializer appends `px` to unlisted unitless
 * properties, which would invalidate the declaration and clamp nothing.
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
