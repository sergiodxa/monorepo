/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies `counter-reset`, creating or resetting the element's CSS counter
 * named by the bare counter identifier `name`. `value` is the integer the
 * counter is set to; omit it to fall back to CSS's own default of `0`.
 *
 * @example u.counterReset("section")
 * @example css({ counterReset: "section" })
 * @example u.counterReset("section", 0)
 * @example css({ counterReset: "section 0" })
 */
export function counterReset<Node extends Element = Element>(name: string, value?: number) {
	return utility<Node>(() => ({
		counterReset: value === undefined ? name : `${name} ${value}`,
	}));
}
