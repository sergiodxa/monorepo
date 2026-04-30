/* @jsxImportSource remix/component */
import type { RemixNode } from "remix/component";

import { cn } from "@pkg/cn";
import { css } from "remix/component";

import type { Markdown } from "../../server/index.js";

import { renderToRemix } from "./renderer.js";

/**
 * Groups Remix markdown renderer types under the component namespace.
 */
export namespace MarkdownView {
	/**
	 * Describes a component factory for custom Remix tag renderers.
	 */
	export type Component = () => (
		props: Record<string, unknown> & { children?: RemixNode },
	) => RemixNode;

	/**
	 * Configures rendered markdown content, wrapper classes, and custom tag components.
	 */
	export interface Props {
		content: Markdown.AST;
		className?: cn.ClassName;
		components?: Record<string, Component>;
	}
}
/**
 * Creates a Remix component that renders markdown content with the package defaults.
 */
export function MarkdownView() {
	return ({ content, className, components }: MarkdownView.Props) => {
		return (
			<div
				className={cn(className)}
				mix={[
					css({
						color: "#262626",
						fontSize: "1rem",
						lineHeight: 1.7,
						maxWidth: "85ch",
					}),
				]}
			>
				{renderToRemix(content, components)}
			</div>
		);
	};
}
