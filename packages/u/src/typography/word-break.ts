/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type WordBreakValue = "normal" | "break-all" | "keep-all" | "break-word";

/**
 * Applies `word-break`.
 *
 * @example u.wordBreak("break-all")
 * @example css({ wordBreak: "break-all" })
 */
export function wordBreak<Node extends Element = Element>(value: WordBreakValue = "normal") {
	return utility<Node>(() => ({ wordBreak: value }));
}
