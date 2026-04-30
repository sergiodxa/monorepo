import { renderers } from "@markdoc/markdoc";
import { cn } from "@pkg/cn";
import * as React from "react";

import type { Markdown } from "../../server/index.js";

import { Fence } from "./fence.js";

/**
 * Groups React markdown renderer types under the component namespace.
 */
export namespace MarkdownView {
	/**
	 * Configures rendered markdown content, wrapper classes, and custom components.
	 */
	export interface Props {
		content: Markdown.AST;
		className?: cn.ClassName;
		components?: Record<string, React.ComponentType>;
	}
}

/**
 * Renders a Markdoc AST with the shared React fence component.
 *
 * @param props - Markdown content and optional rendering overrides
 */
export function MarkdownView({ content, className, components }: MarkdownView.Props) {
	return (
		<div className={cn("prose prose-neutral dark:prose-invert max-w-none", className)}>
			{renderers.react(content, React, { components: { ...components, Fence } })}
		</div>
	);
}
