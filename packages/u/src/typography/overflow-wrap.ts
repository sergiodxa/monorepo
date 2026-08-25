/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type OverflowWrapValue = "normal" | "break-word" | "anywhere";

/**
 * Applies `overflow-wrap`, breaking a word only when it would otherwise
 * overflow a bounded inline size, while ordinary text keeps its normal
 * break points — ideal for a long URL, hash, or identifier in a narrow column.
 *
 * @param value `"break-word"` keeps `min-content` sized from the unbroken
 * word, so a flex or grid item still resists shrinking below it;
 * `"anywhere"` counts the break toward `min-content`, letting it shrink.
 * @example u.overflowWrap()
 * @example css({ overflowWrap: "break-word" })
 * @example u.overflowWrap("anywhere")
 * @example css({ overflowWrap: "anywhere" })
 */
export function overflowWrap<Node extends Element = Element>(
	value: OverflowWrapValue = "break-word",
) {
	return utility<Node>(() => ({ overflowWrap: value }));
}
