/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the CSS `content` property, almost always on a `::before`/`::after`
 * pseudo-element. The `pseudo` prefix keeps the name distinct from
 * `@sdxc/u/layout`'s `content()`, which sets `align-content`.
 *
 * @example u.pseudoContent('""')
 * @example css({ content: '""' })
 * @example u.pseudoContent('"→"')
 * @example css({ content: '"→"' })
 */
export function pseudoContent<Node extends Element = Element>(value: string) {
	return utility<Node>(() => ({ content: value }));
}
