/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { utility } from "../internal/descriptor.js";

/**
 * Sets custom properties on the host element, with the leading `--` omitted
 * from each key so call sites read as plain option names.
 *
 * @example u.vars({ "sidebar-width": "18rem" })
 * @example css({ "--sidebar-width": "18rem" })
 */
export function vars<Node extends Element = Element>(
	values: Record<string, string | number>,
): UtilityMixin<Node> {
	return utility<Node>(() => {
		let styles: Record<string, string | number> = {};
		for (let [key, value] of Object.entries(values)) {
			styles[`--${key}`] = value;
		}
		return styles as CSSStyles;
	});
}
