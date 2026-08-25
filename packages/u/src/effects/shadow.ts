/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ShadowName } from "../types";

import { boxShadowSlot } from "../internal/box-shadow";
import { shadow as shadowToken } from "../internal/tokens";

/**
 * Applies a box shadow from the shadow scale, written to the `elevation` slot
 * of the shared composite `boxShadow` declaration. Claiming only that slot lets
 * an elevation shadow and a `u.ringShadow()` render as two stacked layers.
 *
 * @example u.shadow("lg")
 * @example css({ "--ui-box-shadow-elevation": "var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))", boxShadow: "var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)" })
 */
export function shadow<Node extends Element = Element>(name: ShadowName | (string & {}) = "md") {
	return boxShadowSlot<Node>({ elevation: shadowToken(name) });
}
