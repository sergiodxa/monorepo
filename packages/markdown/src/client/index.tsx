import type { RenderableTreeNodes } from "@markdoc/markdoc";

import { renderers } from "@markdoc/markdoc";
import { cn } from "@pkg/cn";
import * as React from "react";

import { Fence } from "./fence.js";

export namespace MarkdownView {
	export type Content = RenderableTreeNodes;

	export interface Props {
		content: Content;
		className?: cn.ClassName;
		components?: Record<string, React.ComponentType>;
	}
}

export function MarkdownView({ content, className, components }: MarkdownView.Props) {
	return (
		<div className={cn("prose prose-neutral dark:prose-invert max-w-none", className)}>
			{renderers.react(content, React, { components: { ...components, Fence } })}
		</div>
	);
}
