/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type OverflowWrapValue = "normal" | "break-word" | "anywhere";

/**
 * Applies `overflow-wrap`, which allows a word to be broken *only* when it
 * would otherwise overflow its line — ordinary text keeps breaking at its
 * normal opportunities and stays intact. This is the right tool for a long
 * URL, hash, or identifier sitting in a narrow column.
 *
 * Not to be confused with `u.wordBreak("break-all")`, which breaks *every*
 * line at whatever character happens to land at the edge, mangling normal
 * prose along with the one long token you were trying to contain. Reach for
 * this utility first; `word-break` is for CJK line-breaking rules.
 *
 * `"break-word"` breaks the overflowing word but leaves the element's
 * intrinsic `min-content` size computed from the unbroken word, so a flex or
 * grid item still refuses to shrink below it. `"anywhere"` lets the break
 * count toward `min-content` too, which is what actually lets such an item
 * shrink.
 *
 * There must be a bounded inline size for anything to overflow in the first
 * place — an auto-width element just grows instead. And `u.nowrap()` removes
 * the wrapping opportunities this creates, so the two cancel out.
 *
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
