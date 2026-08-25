/**
 * Walks the tag AST `html-parse-stringify` parses out of a translation
 * string and rebuilds it as a `RemixNode` tree, splicing each tag's own
 * children into the matching `components` entry; an unmatched tag renders
 * unwrapped as plain text. A `components` key matching a real HTML void
 * element (`link`, `br`, ...) parses as self-closing regardless of intent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

// oxlint-disable-next-line typescript/triple-slash-reference -- TS only loads this local ambient module via a reference.
/// <reference path="./html-parse-stringify.d.ts" />

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
