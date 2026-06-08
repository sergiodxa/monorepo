/* @jsxImportSource remix/ui */
import type { Handle, RemixNode } from "remix/ui";

import { cn } from "@pkg/cn";
import { css } from "remix/ui";

import type { Markdown } from "../../server/index.js";

import { renderToRemix } from "./renderer.js";

/**
 * Groups Remix markdown renderer types under the component namespace.
 */
export namespace MarkdownView {
	/**
	 * Describes a component factory for custom Remix tag renderers.
	 */
	export type Component = (
		handle: Handle<Record<string, unknown> & { children?: RemixNode }>,
	) => () => RemixNode;

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
export function MarkdownView(handle: Handle<MarkdownView.Props>) {
	return () => {
		let { content, className, components } = handle.props;

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
