/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlurName } from "../types";

import { backdropFilterFunction } from "../internal/backdrop-filter";
import { blur } from "../internal/tokens";

/**
 * Applies a `backdrop-filter: blur(...)` from the blur scale. This is a bare
 * primitive with no accessibility gating: unlike `u.translucent()`, it always
 * applies the blur, even when the user has requested reduced transparency.
 * Call sites that need the accessible, gated pattern — a solid background
 * fallback under `prefers-reduced-transparency` — should use
 * `u.translucent()` instead of composing this primitive by hand.
 *
 * Composable with `u.backdropSaturate()` — both set the shared composite
 * `backdropFilter` declaration, so applying both to the same element
 * combines blur and saturation instead of the last one overwriting the
 * other.
 *
 * @example u.backdropBlur("lg")
 * @example css({ "--ui-backdrop-blur": "var(--ui-blur-lg, 24px)", backdropFilter: "blur(var(--ui-backdrop-blur, 0px)) saturate(var(--ui-backdrop-saturate, 1))", WebkitBackdropFilter: "blur(var(--ui-backdrop-blur, 0px)) saturate(var(--ui-backdrop-saturate, 1))" })
 */
export function backdropBlur<Node extends Element = Element>(
	name: BlurName | (string & {}) = "md",
) {
	return backdropFilterFunction<Node>({ blur: blur(name) });
}
