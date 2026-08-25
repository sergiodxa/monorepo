/**
 * Tree-walk that answers whether a `children` value resolves to visible
 * text once rendered — the shared dev-mode contract check behind every
 * icon-capable interactive component, distinguishing an icon-only control
 * needing an explicit `aria-label` from one whose visible content already
 * names it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A `children` value counts as accessible once it flattens — recursively
 * through arrays and `props.children` — to a non-whitespace string, or to
 * any number or bigint, since either always renders as visible content.
 *
 * @param node A `children` value, or any nested value reached while walking one.
 * @returns Whether `node` resolves to visible text once rendered.
 */
export function hasAccessibleText(node: unknown): boolean {
	if (typeof node === "string") return node.trim().length > 0;
	if (typeof node === "number" || typeof node === "bigint") return true;
	if (Array.isArray(node)) return node.some(hasAccessibleText);
	if (node && typeof node === "object" && "props" in node) {
		return hasAccessibleText((node as { props?: { children?: unknown } }).props?.children);
	}
	return false;
}
