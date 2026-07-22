/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { BlurName } from "../types";

import { utility } from "../internal/descriptor";
import { blur } from "../internal/tokens";

/**
 * Applies a `backdrop-filter: blur(...)` from the blur scale. This is a bare
 * primitive with no accessibility gating: unlike `u.translucent()`, it always
 * applies the blur, even when the user has requested reduced transparency.
 * Call sites that need the accessible, gated pattern — a solid background
 * fallback under `prefers-reduced-transparency` — should use
 * `u.translucent()` instead of composing this primitive by hand.
 *
 * @example u.backdropBlur("lg")
 * @example css({ backdropFilter: "blur(var(--ui-blur-lg, 24px))" })
 */
export function backdropBlur<Node extends Element = Element>(
	name: BlurName | (string & {}) = "md",
) {
	return utility<Node>(() => ({ backdropFilter: `blur(${blur(name)})` }));
}
