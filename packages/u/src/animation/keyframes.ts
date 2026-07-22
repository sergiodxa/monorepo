/**
 * The primitive `@keyframes` emitter. It only produces the keyframes rule
 * itself; it never sets `animationName`, `animationDuration`, or any other
 * host declaration. This package draws the line between CSS primitives and
 * animation opinions here: pairing keyframes with a running animation is a
 * call-site decision (or `u.animation()`'s job), not this utility's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { CSSStyles } from "../internal/css-styles";
import type { UtilityMixin } from "../internal/descriptor";

import { nest, utility } from "../internal/descriptor";

/**
 * Emits an `@keyframes` rule under `name`. It does not style the host
 * element at all, so pair it with a plain `css()` call (or reach for
 * `u.animation()` instead) that sets `animationName` and `animationDuration`
 * at the use site.
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
 * css({ "@keyframes fade-in": { from: { opacity: 0 }, to: { opacity: 1 } } })
 */
export function keyframes<Node extends Element = Element>(
	name: string,
	frames: Record<string, CSSStyles>,
): UtilityMixin<Node> {
	return utility<Node>(() => nest(`@keyframes ${name}`, frames as CSSStyles));
}
