/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * The common `list-style` keywords. The `(string & {})` member keeps the type
 * a plain string, so the shorthand's other forms stay valid: a custom
 * `<counter-style>` name, a `url(...)` marker, or a type/position/image mix.
 */
export type ListStyleValue = "none" | "disc" | "decimal" | (string & {});

/**
 * Applies `list-style`. Defaults to `"none"`, the common case of a `<ul>` or
 * `<ol>` serving as a plain layout container.
 *
 * @example u.listStyle()
 * @example css({ listStyle: "none" })
 * @example u.listStyle("decimal")
 * @example css({ listStyle: "decimal" })
 */
export function listStyle<Node extends Element = Element>(value: ListStyleValue = "none") {
	return utility<Node>(() => ({ listStyle: value }));
}
