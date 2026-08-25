/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlurName } from "../types";

import { backdropFilterFunction } from "../internal/backdrop-filter";
import { blur } from "../internal/tokens";

/**
 * Blurs the backdrop by a step from the blur scale, whatever the user's
 * transparency preference; `u.translucent()` is the gated variant with a solid
 * fallback. Sibling utilities combine through the shared composite filter.
 *
 * @example u.backdropBlur("lg")
 * @example css({ "--ui-backdrop-blur": "var(--ui-blur-lg, 24px)", backdropFilter: "blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1)) ...", WebkitBackdropFilter: "blur(var(--ui-backdrop-blur, 0px)) brightness(var(--ui-backdrop-brightness, 1)) ..." })
 */
export function backdropBlur<Node extends Element = Element>(
	name: BlurName | (string & {}) = "md",
) {
	return backdropFilterFunction<Node>({ blur: blur(name) });
}
