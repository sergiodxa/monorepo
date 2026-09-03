/**
 * The primitive `@keyframes` emitter: it produces the keyframes rule alone,
 * leaving the host declarations that run the animation to the call site or to
 * `u.animation()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles.js";
import type { UtilityMixin } from "../internal/descriptor.js";

import { nest, utility } from "../internal/descriptor.js";

/**
 * Emits an `@keyframes` rule under `name` at the top level, where the
 * serializer reads stop keys (`from`, `to`, `50%`) as stop selectors. Pair it
 * with a `css()` call that sets `animationName` and `animationDuration`.
 *
 * @example
 * <div
 *   mix={[
 *     u.keyframes("fade-in", {
 *       from: { opacity: 0 },
 *       to: { opacity: 1 },
 *     }),
 *     css({
 *       animationName: "fade-in",
 *       animationDuration: "150ms",
 *     }),
 *   ]}
 * />
 * @example
 * // Equivalent at the top level of a `css()` call.
 * css({ "@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } } })
 */
export function keyframes<Node extends Element = Element>(
	name: string,
	frames: Record<string, CSSStyles>,
): UtilityMixin<Node> {
	return utility<Node>(() => nest(`@keyframes ${name}`, frames as CSSStyles));
}
