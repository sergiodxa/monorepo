/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RadiusName } from "../types";

import { rounded } from "../effects/rounded";
import { compose } from "../internal/descriptor";

import { corner } from "./corner";

/**
 * A shape pattern for continuous rounded corners: sets a radius, then
 * refines it with `corner-shape` where supported, so every browser renders
 * at least the plain rounded shape. Composes `u.rounded()` and `u.corner()`.
 *
 * @example u.squircle("lg")
 * @example css({ borderRadius: "var(--ui-radius-lg, 0.5rem)", "@supports (corner-shape: squircle)": { cornerShape: "squircle" } })
 */
export function squircle<Node extends Element = Element>(name: RadiusName | (string & {}) = "md") {
	return compose<Node>([rounded<Node>(name), corner<Node>("squircle")], (styles) => styles);
}
