/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Points an absolutely or fixed positioned element (a tooltip, popover, or
 * menu) at the anchor name {@link anchorName} declared on its target. Pass
 * `name` bare; the `--` custom-property prefix is added here.
 *
 * @see {@link positionArea} and {@link positionTryFallbacks}, which resolve
 * placement against this anchor.
 * @example u.positionAnchor("tooltip-trigger")
 * @example css({ positionAnchor: "--tooltip-trigger" })
 * @example u.positionAnchor("menu-button")
 * @example css({ positionAnchor: "--menu-button" })
 */
export function positionAnchor<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ positionAnchor: `--${name}` }));
}
