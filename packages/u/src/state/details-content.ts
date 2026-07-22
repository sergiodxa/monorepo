/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies the given utilities to a `<details>` element's
 * `::details-content` pseudo-element — the collapsible region holding
 * everything after the `<summary>`. Sugar over
 * `when("&::details-content", input)`. Combine with `u.open()`'s selector
 * directly (`when("&[open]::details-content", input)`) for styles that
 * should only apply once the disclosure is open.
 *
 * @example u.detailsContent([u.overflow("clip"), u.bs(0)])
 * @example css({ "&::details-content": { overflow: "clip", blockSize: "0" } })
 */
export function detailsContent<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::details-content", input);
}
