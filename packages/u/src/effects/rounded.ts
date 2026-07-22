/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RadiusName } from "../types";

import { utility } from "../internal/descriptor";
import { radius } from "../internal/tokens";

/**
 * Applies a corner radius from the radius scale or a raw CSS length.
 *
 * @example u.rounded("lg")
 * @example css({ borderRadius: "var(--ui-radius-lg, 0.5rem)" })
 */
export function rounded<Node extends Element = Element>(name: RadiusName | (string & {}) = "md") {
	return utility<Node>(() => ({ borderRadius: radius(name) }));
}
