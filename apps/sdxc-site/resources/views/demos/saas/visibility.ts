/**
 * Shows a part of the Keel demo only from a named container's breakpoint up. The hidden
 * base and the revealing query share one class, so the two `display` declarations keep
 * their source order wherever the page first uses either utility.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { combine, raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";

/**
 * Hides an element until the named container reaches `size`, then gives it `display`.
 *
 * @param size The container breakpoint (`sm`, `md`, `lg`, `xl`).
 * @param name The container the query reads.
 * @param display The display the element takes from that size up.
 * @returns One mixin holding both declarations.
 * @example <nav mix={[showFrom("lg", "keel-bar", "flex")]} />
 */
export function showFrom(size: "sm" | "md" | "lg" | "xl", name: string, display: string) {
	return combine([raw({ display: "none" }), at(size, name, raw({ display }))]);
}
