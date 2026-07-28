/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { media } from "./media";

/**
 * Sugar over `media("(prefers-reduced-transparency: reduce)", input)`.
 *
 * The inverse of `u.transparencySafe()`, for supplying a solid fallback
 * explicitly — an opaque background, a stronger border — when the styles
 * that would have carried the surface are only declared inside the
 * no-preference branch.
 *
 * @example u.transparencyReduce(u.bg())
 * @example css({ "@media (prefers-reduced-transparency: reduce)": { backgroundColor: "var(--ui-bg, Canvas)" } })
 */
export function transparencyReduce<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-transparency: reduce)", input);
}
