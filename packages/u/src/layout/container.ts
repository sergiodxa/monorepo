/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/** Accepted `container-type` keywords the `container` shorthand's second segment names. */
export type ContainerTypeValue = "size" | "inline-size" | "normal";

/**
 * Declares the host as a named container query context via the `container`
 * shorthand (`container-name` and `container-type` together), so a
 * descendant's `u.at(size, name, ...)` query can target it by name. This is
 * the declaring half of the container-query pair — `u.at()` is the querying
 * half, reading the `size` argument against whichever ancestor establishes a
 * matching container.
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
