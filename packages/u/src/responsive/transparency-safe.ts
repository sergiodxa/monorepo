/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-reduced-transparency: no-preference)", input)`.
 *
 * This is the exact gate `u.translucent()` applies internally, exposed for
 * the case where other translucency-dependent styles need to sit behind the
 * same condition. It matters for `u.backdropBlur()` and
 * `u.backdropSaturate()`, which are ungated primitives: composing either one
 * directly with `u.translucent()` would leave a reduced-transparency user
 * with the saturation still applied but no blur behind it.
 *
 * @example u.transparencySafe(u.backdropSaturate(1.4))
 * @example css({ "@media (prefers-reduced-transparency: no-preference)": { "--ui-backdrop-saturate": "1.4", backdropFilter: "blur(var(--ui-backdrop-blur, 0px)) ...", WebkitBackdropFilter: "blur(var(--ui-backdrop-blur, 0px)) ..." } })
 */
export function transparencySafe<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-transparency: no-preference)", input);
}
