/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Keywords for `contain`, each a promise about the reach of the element's
 * subtree. Plain `string` stays assignable so space-separated combinations
 * such as `"layout paint"` type-check, since the keywords compose freely.
 */
export type ContainValue =
	| "none"
	| "strict"
	| "content"
	| "size"
	| "inline-size"
	| "layout"
	| "style"
	| "paint"
	| (string & {});

/**
 * Applies `contain`, letting the browser skip layout and paint work it can
 * prove stays inside the subtree. Defaults to `"content"`; every value beyond
 * `"none"` makes the element a containing block and a stacking context.
 *
 * @example u.contain()
 * @example css({ contain: "content" })
 * @example u.contain("layout paint")
 * @example css({ contain: "layout paint" })
 * @example u.contain("strict")
 * @example css({ contain: "strict" })
 * @example u.contain("none")
 * @example css({ contain: "none" })
 */
export function contain<Node extends Element = Element>(value: ContainValue = "content") {
	return utility<Node>(() => ({ contain: value }));
}
