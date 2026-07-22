/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Balances line lengths across a wrapped block, best suited to short text
 * such as headings. Browsers cap balancing to a small number of lines, so
 * it has no effect on long-form body copy — reach for {@link pretty} there.
 *
 * @example u.balance()
 * @example css({ textWrap: "balance" })
 */
export function balance<Node extends Element = Element>() {
	return utility<Node>(() => ({ textWrap: "balance" }));
}
