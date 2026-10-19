/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { merge, nest, utility } from "../internal/descriptor.js";

/**
 * Outlines the host in red during development and resolves to an empty style
 * tree elsewhere, so the call is safe to leave in committed code. `false` turns
 * it off from a flag; `"nested"` outlines every descendant to inspect a box model.
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
export function debug<Node extends Element = Element>(mode: boolean | "nested" = true) {
	return utility<Node>(() => {
		if (!mode || !import.meta.env?.DEV) return {};

		let host = { outline: "2px solid red", outlineOffset: "-2px" };
		if (mode !== "nested") return host;

		return merge(host, nest("& *", host));
	});
}
