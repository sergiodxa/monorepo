/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the CSS Anchor Positioning `anchor-name` property, naming the host
 * element as an anchor other elements can be positioned against. This is the
 * *declaring* half of anchor positioning — it goes on the element being
 * anchored **to** (the button, the trigger, the cell), not on the thing that
 * moves. The *referencing* half is {@link positionAnchor}, which goes on the
 * positioned element and points back at this name; without both halves
 * neither {@link positionArea} nor {@link positionTryFallbacks} has an anchor
 * to resolve against.
 *
 * The leading `--` is omitted from `name`, mirroring the convention `u.vars()`
 * and `u.var()` already use for custom properties, since an anchor name is a
 * dashed-ident just like a custom property.
 *
 * @example u.anchorName("tooltip-trigger")
 * @example css({ anchorName: "--tooltip-trigger" })
 * @example u.anchorName("menu-button")
 * @example css({ anchorName: "--menu-button" })
 */
export function anchorName<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ anchorName: `--${name}` }));
}
