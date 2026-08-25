/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `counter-increment` to the element's CSS counter, named by the
 * bare counter identifier `name`. `value` is the integer the counter is
 * incremented by; omit it to fall back to CSS's own default of `1`.
 *
 * @example u.counterIncrement("section")
 * @example css({ counterIncrement: "section" })
 * @example u.counterIncrement("section", 2)
 * @example css({ counterIncrement: "section 2" })
 */
export function counterIncrement<Node extends Element = Element>(name: string, value?: number) {
	return utility<Node>(() => ({
		counterIncrement: value === undefined ? name : `${name} ${value}`,
	}));
}
