/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { utility } from "../internal/descriptor.js";

import type { OutlineStyleValue } from "./outline.js";

/**
 * Sets `outline-style` alone, so a state can override the style while the
 * color and width already in effect stay in force.
 *
 * @example u.outlineStyle("dashed")
 * @example css({ outlineStyle: "dashed" })
 */
export function outlineStyle<Node extends Element = Element>(
	value: OutlineStyleValue,
): UtilityMixin<Node> {
	return utility<Node>(() => ({ outlineStyle: value }) as CSSStyles);
}
