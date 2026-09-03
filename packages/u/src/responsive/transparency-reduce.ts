/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor.js";

import { media } from "./media.js";

/**
 * Sugar over `media("(prefers-reduced-transparency: reduce)", input)`.
 *
 * Supplies an explicit solid fallback — an opaque background, a stronger
 * border — for a surface styled only inside the no-preference branch.
 *
 * @example u.transparencyReduce(u.bg())
 * @example css({ "@media (prefers-reduced-transparency: reduce)": { backgroundColor: "var(--ui-bg, Canvas)" } })
 */
export function transparencyReduce<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return media("(prefers-reduced-transparency: reduce)", input);
}
