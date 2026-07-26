/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies a CSS mask image, mirrored onto the `-webkit-mask-image`
 * vendor-prefixed property as well — Safari still requires its own prefixed
 * property to render an element mask, the same vendor-prefix-mirroring
 * precedent `u.appearance()` already established for form-control resets.
 * Accepts anything valid in `mask-image`: a gradient (an edge fade), a
 * `url(...)` reference (an alpha-channel image mask), or any other
 * mask-image value.
 *
 * @example u.mask("linear-gradient(to bottom, transparent, black)")
 * @example css({ maskImage: "linear-gradient(to bottom, transparent, black)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black)" })
 */
export function mask<Node extends Element = Element>(image: string) {
	return utility<Node>(() => ({ maskImage: image, WebkitMaskImage: image }));
}
