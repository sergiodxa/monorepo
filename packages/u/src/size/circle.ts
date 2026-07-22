import { rounded } from "../effects/rounded";
/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { compose } from "../internal/descriptor";

import { aspect } from "./aspect";

/**
 * A shape pattern for circular boxes: a square aspect ratio plus full
 * radius — an avatar frame, a status dot, an icon badge. Composes
 * `u.aspect("square")` and `u.rounded("full")`.
 *
 * @example u.circle()
 * @example css({ aspectRatio: "1 / 1", borderRadius: "var(--ui-radius-full, 9999px)" })
 */
export function circle<Node extends Element = Element>() {
	return compose<Node>([aspect<Node>("square"), rounded<Node>("full")], (styles) => styles);
}
