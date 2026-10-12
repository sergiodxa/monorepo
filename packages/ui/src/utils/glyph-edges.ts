/**
 * Reports which edges of a labelled control's content are elements rather than text,
 * so a button can trim the padding beside a leading or trailing glyph — a question a
 * selector cannot answer, since `:first-child` and `:last-child` skip text nodes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Which edges of a control's rendered children are elements.
 */
export interface GlyphEdges {
	start: boolean;
	end: boolean;
}

/**
 * Whether a rendered child is an element: a non-array object, which is the shape a JSX
 * element takes, as opposed to text, numbers, or a nested list.
 *
 * @param child One rendered child.
 * @returns Whether `child` renders an element.
 */
function isElementNode(child: unknown): boolean {
	return typeof child === "object" && child !== null && !Array.isArray(child);
}

/**
 * Whether a child renders anything: `null`, `undefined`, booleans, and whitespace-only
 * strings occupy a JSX slot but draw nothing, so they never count as an edge.
 *
 * @param child One child slot.
 * @returns Whether `child` renders visible content.
 */
function rendersSomething(child: unknown): boolean {
	if (child === null || child === undefined || typeof child === "boolean") return false;
	return !(typeof child === "string" && child.trim() === "");
}

/**
 * Reports whether the first and last rendered children are elements. A lone child has
 * no label to balance, so it reports neither edge — an icon-only control is its own case.
 *
 * @param children A control's own `children` value.
 * @returns Which edges hold an element beside a label.
 * @example glyphEdges([<PlusIcon />, "Add"]) // { start: true, end: false }
 */
export function glyphEdges(children: unknown): GlyphEdges {
	if (!Array.isArray(children)) return { start: false, end: false };
	let rendered = children.filter(rendersSomething);
	if (rendered.length < 2) return { start: false, end: false };
	return { start: isElementNode(rendered[0]), end: isElementNode(rendered[rendered.length - 1]) };
}
