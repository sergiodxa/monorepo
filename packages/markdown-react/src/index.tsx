/** @jsxImportSource react */

import type { RenderableTreeNodes } from "@markdoc/markdoc";

import { renderers } from "@markdoc/markdoc";
import * as React from "react";

import { Fence } from "./fence.js";

/**
 * Groups Markdown React types under the component namespace.
 */
export namespace MarkdownView {
	/**
	 * Supplies Markdoc output and optional custom component overrides.
	 */
	export interface Props {
		content: RenderableTreeNodes;
		components?: Record<string, React.ComponentType<any>>;
	}
}

/**
 * Renders parsed Markdoc content with the package's default React components.
 *
 * @param props - Parsed content and optional custom component overrides
 */
export function MarkdownView({ content, components }: MarkdownView.Props) {
	return <>{renderers.react(content, React, { components: { Fence, ...components } })}</>;
}

export { CopyButton } from "./copy-button.js";
export { Fence } from "./fence.js";
