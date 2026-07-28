/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the CSS Anchor Positioning `position-anchor` property, pointing the
 * host element at the anchor it should be positioned against. This is the
 * *referencing* half of anchor positioning — it goes on the absolutely
 * positioned element (the tooltip, the popover, the menu), and the name it
 * references is the one {@link anchorName} declared on the element being
 * anchored to.
 *
 * The host element needs `position: absolute` or `position: fixed` for this
 * to do anything at all — see `u.absolute()` and `u.fixed()`. Once both are
 * in place, this is the anchor {@link positionArea} resolves its placement
 * against, and the one {@link positionTryFallbacks} re-resolves against when
 * the preferred placement overflows.
 *
 * The leading `--` is omitted from `name`, mirroring the convention
 * `u.vars()` and `u.var()` already use for custom properties, and matching
 * {@link anchorName} on the other side.
 *
 * @example u.positionAnchor("tooltip-trigger")
 * @example css({ positionAnchor: "--tooltip-trigger" })
 * @example u.positionAnchor("menu-button")
 * @example css({ positionAnchor: "--menu-button" })
 */
export function positionAnchor<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ positionAnchor: `--${name}` }));
}
