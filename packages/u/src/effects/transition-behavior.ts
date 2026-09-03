/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

export type TransitionBehaviorValue = "normal" | "allow-discrete";

/**
 * Applies the `transition-behavior` property on its own; `"allow-discrete"`
 * lets a discrete property such as `display` or `content-visibility` animate
 * across a transition, commonly paired with `@starting-style`.
 *
 * @example u.transitionBehavior("allow-discrete")
 * @example css({ transitionBehavior: "allow-discrete" })
 */
export function transitionBehavior<Node extends Element = Element>(value: TransitionBehaviorValue) {
	return utility<Node>(() => ({ transitionBehavior: value }));
}
