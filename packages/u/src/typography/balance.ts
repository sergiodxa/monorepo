/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Balances line lengths across a wrapped block, best suited to short text
 * such as headings, since browsers cap balancing to a small number of
 * lines. Use {@link pretty} for long-form body copy.
 *
 * @example u.balance()
 * @example css({ textWrap: "balance" })
 */
export function balance<Node extends Element = Element>() {
	return utility<Node>(() => ({ textWrap: "balance" }));
}
