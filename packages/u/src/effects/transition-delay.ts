/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies `transition-delay` on its own, so items sharing one transition can
 * stagger by giving each an increasing delay. Keep the stagger on the entering
 * state and leave the leaving state at `0s`, so dismissal stays immediate.
 *
 * @param value A CSS time string, unit included.
 * @example u.transitionDelay()
 * @example css({ transitionDelay: "0s" })
 * @example u.transitionDelay("120ms")
 * @example css({ transitionDelay: "120ms" })
 */
export function transitionDelay<Node extends Element = Element>(value: string = "0s") {
	return utility<Node>(() => ({ transitionDelay: value }));
}
