/**
 * A pure tree-walk over a `children` value, answering whether it resolves to
 * any visible text once fully rendered. Backs the dev-mode contract check
 * shared by every icon-capable interactive component: a control whose
 * content is entirely icons and other non-text elements has no accessible
 * name unless an explicit `aria-label`/`aria-labelledby` supplies one, and
 * this walk is how a component tells that case apart from one whose visible
 * content already gives it a name.
 *
 * A string counts as accessible text only once trimmed of whitespace — an
 * empty or whitespace-only string renders nothing a screen reader would
 * announce. A number or a bigint always counts, since either renders as a
 * visible digit sequence. An array recurses into every entry, so a `children`
 * value composed of several siblings counts as soon as any one of them
 * carries text. An element-like object — anything with a `props` key —
 * recurses into its own `props.children`, so nested markup (a `<span>`
 * wrapping a label, for instance) still resolves through to its innermost
 * text. Anything else — `undefined`, a boolean, or a bare object with no
 * `props` (an icon component instance, for instance) — carries no accessible
 * text on its own.
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
