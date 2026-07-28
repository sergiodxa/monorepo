/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies the given utilities to a list item's marker — its bullet or number —
 * and to a `<summary>`'s disclosure triangle, via `::marker`. Sugar over
 * `when("&::marker", input)`.
 *
 * Only a small set of properties apply here: `color`, the `font-*` family, and
 * `content`. Everything else in the wrapped utilities is ignored, so the
 * marker cannot be padded or positioned through this wrapper.
 *
 * To remove the marker entirely rather than restyle it, use
 * `u.listStyle("none")` — recolouring it to match the background only hides
 * it, leaving the space it occupies in the line box behind.
 *
 * @example u.marker(u.fg("neutral.muted"))
 * @example css({ "&::marker": { color: "..." } })
 */
export function marker<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::marker", input);
}
