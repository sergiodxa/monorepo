/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RadiusName } from "../types.js";

import { utility } from "../internal/descriptor.js";
import { radius } from "../internal/tokens.js";

/**
 * Applies a corner radius from the radius scale or a raw CSS length.
 *
 * @example u.rounded("lg")
 * @example css({ borderRadius: "var(--ui-radius-lg, 0.5rem)" })
 * @example u.rounded("inherit")
 * @example css({ borderRadius: "inherit" })
 */
export function rounded<Node extends Element = Element>(name: RadiusName | (string & {}) = "md") {
	if (name === "inherit") {
		return utility<Node>(() => ({ borderRadius: "inherit" }));
	}

	return utility<Node>(() => ({ borderRadius: radius(name) }));
}
