/**
 * The walk visitor for math in markdown: a ```math fence becomes a display
 * `math` tag and GitHub's $`…`$ form an inline one, each carrying its TeX. The
 * HTML tag renderer for those tags lives here too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";
import type { HTMLTagRenderer } from "@sdxc/markdown/html";

import { escapeText } from "./lib/serialize.js";

import { parseMath, toMathML } from "./index.js";

/** Options for {@link createMathVisitor}. */
export interface MathVisitorOptions {
	/**
	 * What happens to TeX that does not convert: `fail` ends the walk with the
	 * conversion's error, so a build catches a broken formula; `keep` leaves the
	 * code block or inline code as the author wrote it.
	 *
	 * @default "fail"
	 */
	invalid?: "fail" | "keep";
}

/**
 * Builds the visitor. Every handler is synchronous, so a walk with it answers
 * with a `Result` rather than a promise.
 *
 * @param options - What to do with TeX that does not convert
 * @returns A visitor for `Markdown.walk`
 * @example Markdown.walk(document, createMathVisitor({ invalid: "keep" }))
 */
export function createMathVisitor(options: MathVisitorOptions = {}) {
	let keep = options.invalid === "keep";

	return {
		code(node: Markdown.Code): Markdown.Code | Markdown.Tag {
			if (node.language !== "math") return node;
			let tex = node.content.replace(/\n$/, "");
			if (!converts(tex, true, keep)) return node;
			return mathTag(tex, true, node.position);
		},
		paragraph: (node: Markdown.Paragraph) => withInlineMath(node, keep),
		heading: (node: Markdown.Heading) => withInlineMath(node, keep),
		tableCell: (node: Markdown.TableCell) => withInlineMath(node, keep),
		emphasis: (node: Markdown.Emphasis) => withInlineMath(node, keep),
		strong: (node: Markdown.Strong) => withInlineMath(node, keep),
		strikethrough: (node: Markdown.Strikethrough) => withInlineMath(node, keep),
		link: (node: Markdown.Link) => withInlineMath(node, keep),
	} satisfies Markdown.Visitor;
}

/**
 * Walk a document with this to turn its math into `math` tags. A formula that
 * does not convert fails the walk, naming the formula's own line and column.
 *
 * @example Markdown.walk(document, math)
 */
export const math = createMathVisitor();

/**
 * Renders a `math` tag for `toHTML`'s `tags` option. A tag whose TeX does not
 * convert — one built by hand, or walked with `invalid: "keep"` elsewhere —
 * renders as its escaped TeX in a `<code>`.
 *
 * @example toHTML(document, { tags: { math: renderMath } })
 */
export const renderMath: HTMLTagRenderer = (tag) => {
	let tex = typeof tag.attributes.tex === "string" ? tag.attributes.tex : "";
	let result = toMathML(tex, { display: tag.attributes.display === true });
	if (result.status === "success") return result.data;
	return `<code>${escapeText(tex)}</code>`;
};

/**
 * Whether the TeX converts. With `keep` off, a failure throws, which is how a
 * walk handler reports one.
 */
function converts(tex: string, display: boolean, keep: boolean): boolean {
	let result = parseMath(tex, { display });
	if (result.status === "success") return true;
	if (keep) return false;
	throw result.error;
}

/** The tag both forms become. It has no children: the TeX is the whole content. */
function mathTag(tex: string, display: boolean, position: Markdown.Position): Markdown.Tag {
	return { type: "tag", name: "math", attributes: { tex, display }, children: [], position };
}

/**
 * Rewrites a parent's inline children, turning every inline code with a `$`
 * at the end of the text before it and the start of the text after it into an
 * inline tag. An untouched parent comes back as `undefined`, keeping the subtree shared.
 */
function withInlineMath<Parent extends { children: Markdown.Inline[] }>(
	node: Parent,
	keep: boolean,
): Parent | undefined {
	let pending = [...node.children];
	let output: Markdown.Inline[] = [];
	let changed = false;

	for (let index = 0; index < pending.length; index += 1) {
		let child = pending[index] as Markdown.Inline;
		let previous = output.at(-1);
		let following = pending[index + 1];

		if (
			child.type === "inlineCode" &&
			previous?.type === "text" &&
			previous.value.endsWith("$") &&
			following?.type === "text" &&
			following.value.startsWith("$") &&
			converts(child.value, false, keep)
		) {
			let start = shift(previous.position.end, -1);
			let end = shift(following.position.start, 1);
			output.pop();
			if (previous.value.length > 1) {
				output.push({
					...previous,
					value: previous.value.slice(0, -1),
					position: { start: previous.position.start, end: start },
				});
			}
			pending[index + 1] = {
				...following,
				value: following.value.slice(1),
				position: { start: end, end: following.position.end },
			};
			output.push(mathTag(child.value, false, { start, end }));
			changed = true;
			continue;
		}

		if (child.type === "text" && child.value === "") continue;
		output.push(child);
	}

	if (!changed) return undefined;
	return { ...node, children: output };
}

/** Moves a point along its line, which a single `$` never leaves. */
function shift(point: Markdown.Point, by: number): Markdown.Point {
	return { line: point.line, column: point.column + by, offset: point.offset + by };
}
