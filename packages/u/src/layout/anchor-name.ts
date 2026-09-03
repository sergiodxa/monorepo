/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies `anchor-name`, the *declaring* half of anchor positioning: it goes
 * on the element anchored **to**, and {@link positionAnchor} points back at
 * this name. The leading `--` is prepended — an anchor name is a dashed-ident.
 *
 * @example u.anchorName("tooltip-trigger")
 * @example css({ anchorName: "--tooltip-trigger" })
 * @example u.anchorName("menu-button")
 * @example css({ anchorName: "--menu-button" })
 */
export function anchorName<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ anchorName: `--${name}` }));
}
