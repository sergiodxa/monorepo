/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies `grid-area`, placing an element in a named area of its parent's
 * `grid-template-areas`.
 *
 * @example u.gridArea("header")
 * @example css({ gridArea: "header" })
 */
export function gridArea<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ gridArea: name }));
}
