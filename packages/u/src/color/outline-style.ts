/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { utility } from "../internal/descriptor";

import type { OutlineStyleValue } from "./outline";

/**
 * Sets only `outline-style`, leaving `outline-color`/`outline-width`
 * untouched. Use this over `u.outline()` when a state needs to override just
 * the style without forcing a color/width that wasn't already set.
 *
 * @example u.outlineStyle("dashed")
 * @example css({ outlineStyle: "dashed" })
 */
export function outlineStyle<Node extends Element = Element>(
	value: OutlineStyleValue,
): UtilityMixin<Node> {
	return utility<Node>(() => ({ outlineStyle: value }) as CSSStyles);
}
