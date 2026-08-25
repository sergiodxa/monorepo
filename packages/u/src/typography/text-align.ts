/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type TextAlignValue = "start" | "center" | "end" | "justify" | (string & {});

/**
 * Applies `text-align` using the logical `start`/`end` keywords so alignment
 * flips automatically under `dir="rtl"`. A raw value such as `"left"` or
 * `"right"` is also accepted for alignment that must stay physical.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values
 * @example u.textAlign("end")
 * @example css({ textAlign: "end" })
 * @example u.textAlign("left")
 * @example css({ textAlign: "left" })
 */
export function textAlign<Node extends Element = Element>(value: TextAlignValue = "start") {
	return utility<Node>(() => ({ textAlign: value }));
}
