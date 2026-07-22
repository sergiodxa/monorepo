/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { compose } from "../internal/descriptor";

import { isolate } from "./isolate";
import { z } from "./z";

/**
 * Composes {@link isolate} and {@link z} so a single call gets both a new
 * stacking context and a stacking order. Only numbers are accepted — this
 * package doesn't define named component layers such as `"toast"` or
 * `"modal"`, since stacking order for those is an app or component concern,
 * not a lower-level styling primitive.
 *
 * @example u.layer(10)
 * @example css({ isolation: "isolate", zIndex: 10 })
 */
export function layer<Node extends Element = Element>(value: number) {
	return compose<Node>([isolate<Node>(), z<Node>(value)], (styles) => styles);
}
