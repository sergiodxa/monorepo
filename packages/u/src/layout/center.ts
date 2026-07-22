/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { compose } from "../internal/descriptor";

import { flex } from "./flex";
import { items } from "./items";
import { justify } from "./justify";

/**
 * A zero-argument convenience pattern that centers content both ways.
 * Composes `u.flex()`, `u.items("center")`, and `u.justify("center")` —
 * no declaration of its own beyond what those three already produce.
 *
 * @example u.center()
 * @example css({ display: "flex", alignItems: "center", justifyContent: "center" })
 */
export function center<Node extends Element = Element>() {
	return compose<Node>(
		[flex<Node>(), items<Node>("center"), justify<Node>("center")],
		(styles) => styles,
	);
}
