/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies the given utilities to a list item's marker or a `<summary>`
 * disclosure triangle via `::marker`; only `color`, `font-*`, and `content`
 * apply. Use `u.listStyle("none")` to remove the marker along with its space.
 *
 * @example u.marker(u.fg("neutral.muted"))
 * @example css({ "&::marker": { color: "..." } })
 */
export function marker<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::marker", input);
}
