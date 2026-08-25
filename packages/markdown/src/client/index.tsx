/* @jsxImportSource remix/ui */

/**
 * Entry point for the Remix markdown client: renders a Markdoc AST into
 * Remix UI nodes and re-exports the fence and renderer helpers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode, Handle } from "remix/ui";

import { renderToRemix } from "./renderer.js";

/**
 * Custom tag renderers accepted by the Remix markdown view.
 */
export type MarkdownViewComponents = Record<
	string,
	(handle: Handle<{ children: RemixNode; [key: string]: unknown }>) => () => RemixNode
>;

/**
 * Groups the Remix markdown view types under one namespace.
 */
export namespace MarkdownView {
	/**
	 * Inputs accepted by the Remix markdown renderer.
	 */
	export interface Props {
		content: unknown;
		components?: MarkdownViewComponents;
	}
}

/**
 * Renders Markdoc content into the Remix UI runtime.
 */
export function MarkdownView({ props }: Handle<MarkdownView.Props>) {
	let { content, components } = props;

	return () => <>{renderToRemix(content, components)}</>;
}

export * from "./fence.js";
export * from "./renderer.js";
