/**
 * Walks the tag AST `html-parse-stringify` parses out of an already-`t()`-ed
 * translation string (e.g. `"Hello <0>Bob</0>, click <articleLink>here</articleLink>"`)
 * and rebuilds it as a `RemixNode` tree, splicing each tag's own children in
 * as the matching `components` entry's children. A tag name with no matching
 * `components` entry renders its children unwrapped instead of disappearing
 * or throwing, so an un-mapped tag degrades to plain text.
 *
 * A tag name that matches a real HTML void element (`link`, `br`, `img`,
 * `hr`, ...) is parsed as self-closing regardless of how the translation
 * actually wrote it — `html-parse-stringify` checks tag names against the
 * real HTML void-element list, not against `components`. Pick a `components`
 * key that isn't one of those names (`articleLink`, not `link`) for a tag
 * meant to wrap children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HtmlAstNode } from "html-parse-stringify";
import type { RemixElement, RemixNode } from "remix/ui";

import HTML from "html-parse-stringify";
import { createElement } from "remix/ui";

/**
 * Rebuilds a translated string containing `<tagName>...</tagName>` markers
 * into a `RemixNode` tree, replacing each tag with its `components` entry and
 * keeping the tag's own inner text/nesting as that entry's children.
 *
 * @example
 * parseTrans("Click <articleLink>here</articleLink>", { articleLink: <a href="/" /> });
 * // ["Click ", <a href="/">here</a>]
 */
export function parseTrans(
	translation: string,
	components: Record<string, RemixElement>,
): RemixNode {
	return renderNodes(HTML.parse(translation), components);
}

function renderNodes(nodes: HtmlAstNode[], components: Record<string, RemixElement>): RemixNode[] {
	return nodes.map((node) => renderNode(node, components));
}

function renderNode(node: HtmlAstNode, components: Record<string, RemixElement>): RemixNode {
	if (node.type === "text") return node.content;
	if (node.type === "comment") return null;

	let children = renderNodes(node.children, components);
	let component = components[node.name];

	if (!component) {
		console.warn(
			`Trans: no components["${node.name}"] entry for <${node.name}> in the translation; rendering its children unwrapped.`,
		);
		return children;
	}

	return createElement(component.type, component.props, ...children);
}
