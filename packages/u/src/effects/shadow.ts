/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ShadowName } from "../types";

import { utility } from "../internal/descriptor";
import { shadow as shadowToken } from "../internal/tokens";

/**
 * Applies a box shadow from the shadow scale.
 *
 * @example u.shadow("lg")
 * @example css({ boxShadow: "var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))" })
 */
export function shadow<Node extends Element = Element>(name: ShadowName | (string & {}) = "md") {
	return utility<Node>(() => ({ boxShadow: shadowToken(name) }));
}
