/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-reduced-transparency: no-preference)", input)`,
 * the same gate `u.translucent()` uses internally. Wrap `u.backdropBlur()`
 * or `u.backdropSaturate()` in it directly to keep both effects gated together.
 *
 * @example u.transparencySafe(u.backdropSaturate(1.4))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-saturate": "1.4", backdropFilter: "blur(var(--ui-backdrop-blur, 0px)) ...", WebkitBackdropFilter: "blur(var(--ui-backdrop-blur, 0px)) ..." } })
 */
export function transparencySafe<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-transparency: no-preference)", input);
}
