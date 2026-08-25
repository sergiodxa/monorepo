/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { merge, nest, utility } from "../internal/descriptor";

/**
 * Outlines the host in red during development and resolves to an empty style
 * tree elsewhere, so the call is safe to leave in committed code. `"nested"`
 * extends the outline to every descendant to inspect a full box model.
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
