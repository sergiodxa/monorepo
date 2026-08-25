/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { compose, utility } from "../internal/descriptor";
import { overflow } from "../overflow/overflow";

import { nowrap } from "./nowrap";

/**
 * Truncates single-line text with an ellipsis once it overflows its box;
 * requires a bounded inline size (`max-inline-size`, a flex/grid item with
 * `min-inline-size: 0`, or similar) or there is nothing to overflow against.
 *
 * @example u.truncate()
 * @example css({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })
 */
export function truncate<Node extends Element = Element>() {
	return compose<Node>(
		[overflow<Node>("hidden"), nowrap<Node>(), utility<Node>(() => ({ textOverflow: "ellipsis" }))],
		(styles) => styles,
	);
}
