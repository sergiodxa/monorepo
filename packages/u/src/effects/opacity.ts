/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies opacity from a 0-100 integer, matching Tailwind's convention,
 * rather than the CSS `opacity` property's own 0-1 range.
 *
 * @example u.opacity(50)
 * @example css({ opacity: 0.5 })
 */
export function opacity<Node extends Element = Element>(value: number) {
	return utility<Node>(() => ({ opacity: value / 100 }));
}
