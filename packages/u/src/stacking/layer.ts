/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { compose } from "../internal/descriptor";

import { isolate } from "./isolate";
import { z } from "./z";

/**
 * Composes {@link isolate} and {@link z} so a single call gets both a new
 * stacking context and a stacking order. Accepts only numeric values,
 * leaving named layers like `"toast"` or `"modal"` to app or component code.
 *
 * @example u.layer(10)
 * @example css({ isolation: "isolate", zIndex: 10 })
 */
export function layer<Node extends Element = Element>(value: number) {
	return compose<Node>([isolate<Node>(), z<Node>(value)], (styles) => styles);
}
