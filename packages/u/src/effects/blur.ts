/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlurName } from "../types";

import { utility } from "../internal/descriptor";
import { blur as blurToken } from "../internal/tokens";

/**
 * Applies a `filter: blur(...)` from the blur scale.
 *
 * @example u.blur("lg")
 * @example css({ filter: "blur(var(--ui-blur-lg, 24px))" })
 */
export function blur<Node extends Element = Element>(name: BlurName | (string & {}) = "md") {
	return utility<Node>(() => ({ filter: `blur(${blurToken(name)})` }));
}
