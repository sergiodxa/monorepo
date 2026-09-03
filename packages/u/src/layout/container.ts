/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** Accepted `container-type` keywords the `container` shorthand's second segment names. */
export type ContainerTypeValue = "size" | "inline-size" | "normal";

/**
 * Declares the host as a named container query context via the `container`
 * shorthand (`container-name` and `container-type` together), so a
 * descendant's `u.at(size, name, ...)` query can target it by name.
 *
 * @example u.container("sidebar")
 * @example css({ container: "sidebar / inline-size" })
 * @example u.container("sidebar", "size")
 * @example css({ container: "sidebar / size" })
 */
export function container<Node extends Element = Element>(
	name: string,
	type: ContainerTypeValue = "inline-size",
) {
	return utility<Node>(() => ({ container: `${name} / ${type}` }));
}
