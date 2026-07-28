/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `transition-delay` property on its own, for adding a delay to a
 * transition already declared elsewhere. The real use is staggering a group of
 * reveals: same `u.transition()` on every item, an increasing delay per item,
 * so a list or menu animates in as a sequence rather than all at once.
 *
 * A delay is asymmetric in practice. On the *enter* transition it reads as
 * choreography; on the *leave* transition the element sits there doing nothing
 * after the user has already acted, which reads as an unresponsive UI. So a
 * stagger almost always belongs on the entering state only, with the leaving
 * state left at `0s`.
 *
 * String-only, matching the sibling `u.transitionDuration()`. `u.transition()`'s
 * numeric `duration` option is the asymmetric one in this family — it accepts a
 * bare number as milliseconds; these two standalone overrides take a CSS time
 * string with its unit spelled out.
 *
 * @example u.transitionDelay()
 * @example css({ transitionDelay: "0s" })
 * @example u.transitionDelay("120ms")
 * @example css({ transitionDelay: "120ms" })
 */
export function transitionDelay<Node extends Element = Element>(value: string = "0s") {
	return utility<Node>(() => ({ transitionDelay: value }));
}
