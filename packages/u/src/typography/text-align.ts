/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

export type TextAlignValue = "start" | "center" | "end" | "justify" | (string & {});

/**
 * Applies `text-align` using the logical `start`/`end` keywords instead of
 * `left`/`right`, so alignment flips automatically in right-to-left writing
 * modes through the standard `dir` attribute — see
 * [MDN: logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values).
 * The typed, autocompleted values are the logical ones; a raw string escape
 * (e.g. `"left"`/`"right"`) is also accepted for the rare case where the
 * alignment is genuinely meant to stay physical regardless of writing
 * direction — mirrors the same physical-exception pattern `u.width()`/
 * `u.height()` use alongside their logical defaults.
 *
 * @example u.textAlign("end")
 * @example css({ textAlign: "end" })
 * @example u.textAlign("left")
 * @example css({ textAlign: "left" })
 */
export function textAlign<Node extends Element = Element>(value: TextAlignValue = "start") {
	return utility<Node>(() => ({ textAlign: value }));
}
