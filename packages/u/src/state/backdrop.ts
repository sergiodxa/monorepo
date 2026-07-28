/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { UtilityInput, UtilityMixin } from "../internal/descriptor";

import { when } from "./when";

/**
 * Applies the given utilities to a top-layer element's `::backdrop`. Sugar
 * over `when("&::backdrop", input)`.
 *
 * The backdrop is the layer the browser paints behind an element promoted to
 * the top layer — a `<dialog>` opened as a modal, or a popover — covering the
 * whole viewport beneath it. It is the correct way to dim the page behind a
 * modal: no extra overlay element, no z-index bookkeeping, and no scroll
 * container to fight, because the browser owns the stacking.
 *
 * It only exists while the element is actually in the top layer, so it pairs
 * with `u.open()` when a dialog also needs styling in its closed state.
 *
 * @example u.backdrop(u.bg("neutral.solid"))
 * @example css({ "&::backdrop": { backgroundColor: "..." } })
 */
export function backdrop<Node extends Element = Element>(
	input: UtilityInput<Node>,
): UtilityMixin<Node> {
	return when<Node>("&::backdrop", input);
}
