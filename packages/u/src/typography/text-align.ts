/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type TextAlignValue = "start" | "center" | "end" | "justify";

/**
 * Applies `text-align` using the logical `start`/`end` keywords instead of
 * `left`/`right`, so alignment flips automatically in right-to-left writing
 * modes through the standard `dir` attribute — see
 * [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 *
 * @example u.textAlign("end")
 * @example css({ textAlign: "end" })
 */
export function textAlign<Node extends Element = Element>(value: TextAlignValue = "start") {
	return utility<Node>(() => ({ textAlign: value }));
}
