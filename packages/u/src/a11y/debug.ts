/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { merge, nest, utility } from "../internal/descriptor";

/**
 * Applies a clearly visible red outline to the host in development only, so
 * the call can be left in code without affecting production output. Passing
 * `"nested"` extends the same outline to every descendant through a `"& *"`
 * descendant rule, which is useful for inspecting a layout's full box model
 * rather than just its outer boundary. Outside development, this utility
 * resolves to an empty style tree rather than relying on tree-shaking to
 * remove it.
 *
 * @example u.debug()
 * @example css({ outline: "2px solid red", outlineOffset: "-2px" })
 * @example u.debug("nested")
 * @example css({
 *   outline: "2px solid red",
 *   outlineOffset: "-2px",
 *   "& *": { outline: "2px solid red", outlineOffset: "-2px" },
 * })
 */
export function debug<Node extends Element = Element>(mode: boolean | "nested" = false) {
	return utility<Node>(() => {
		if (!import.meta.env.DEV) return {};

		let host = { outline: "2px solid red", outlineOffset: "-2px" };
		if (mode !== "nested") return host;

		return merge(host, nest("& *", host));
	});
}
