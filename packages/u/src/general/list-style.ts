/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The common `list-style` keywords. The `(string & {})` member keeps the
 * type a plain string for the shorthand's many other valid forms — a custom
 * `<counter-style>` name, a `url(...)` image marker, or a combination of
 * type/position/image — so it only adds autocomplete for the common cases
 * rather than narrowing what's accepted.
 */
export type ListStyleValue = "none" | "disc" | "decimal" | (string & {});

/**
 * Applies `list-style`. Defaults to `"none"`, the common case of a `<ul>` or
 * `<ol>` used as a layout container rather than an actual bulleted/numbered
 * list.
 *
 * @example u.listStyle()
 * @example css({ listStyle: "none" })
 * @example u.listStyle("decimal")
 * @example css({ listStyle: "decimal" })
 */
export function listStyle<Node extends Element = Element>(value: ListStyleValue = "none") {
	return utility<Node>(() => ({ listStyle: value }));
}
