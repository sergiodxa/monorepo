/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * `none` never hyphenates; `manual` breaks only at an explicit `&shy;` or
 * `<wbr>`; `auto` hyphenates using the browser's dictionary for the
 * element's language.
 */
export type HyphensValue = "none" | "manual" | "auto";

/**
 * Lets long words break with a hyphen instead of forcing the line short.
 * `"auto"` hyphenates only when the element or an ancestor carries a `lang`
 * attribute to pick a dictionary from — omit it and nothing hyphenates.
 *
 * @example u.hyphens()
 * @example css({ hyphens: "auto" })
 * @example u.hyphens("manual")
 * @example css({ hyphens: "manual" })
 * @example u.hyphens("none")
 * @example css({ hyphens: "none" })
 * @see u.overflowWrap for strings with no dictionary entry, like URLs or hashes.
 */
export function hyphens<Node extends Element = Element>(value: HyphensValue = "auto") {
	return utility<Node>(() => ({ hyphens: value }));
}
