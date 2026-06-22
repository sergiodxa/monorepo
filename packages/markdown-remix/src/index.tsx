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
 *
 * @param props - Markdown content and optional custom tag components
 */
export function MarkdownView({ content, components }: MarkdownView.Props) {
	return <>{renderToRemix(content, components)}</>;
}

export * from "./fence.js";
export * from "./renderer.js";
