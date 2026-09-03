/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SpacingValue } from "../internal/tokens.js";

import { spacing } from "../internal/tokens.js";
import { transformFunction } from "../internal/transform.js";

/**
 * Translates the element along the block axis using the spacing scale or a
 * raw CSS length. Composable with every other `transform/` utility.
 *
 * @example u.translateY(4)
 * @example css({ "--ui-translate-y": "calc(var(--ui-spacing, 0.25rem) * 4)", transform: "translate(var(--ui-translate-x, 0), var(--ui-translate-y, 0)) ..." })
 */
export function translateY<Node extends Element = Element>(value: SpacingValue) {
	return transformFunction<Node>({ translateY: spacing(value) });
}
