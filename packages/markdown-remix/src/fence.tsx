/** @jsxImportSource remix/ui */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

/**
 * Groups Remix code fence types under the component namespace.
 */
export namespace Fence {
	/**
	 * Describes the highlighted code block and optional header metadata.
	 */
	export interface Props {
		content: string;
		language: string;
		path?: string;
		title?: string;
	}
}

/**
 * Creates a Remix renderer for highlighted code fences.
 */
export function Fence({ props }: Handle<Fence.Props>) {
	let { content, language, path, title } = props;
	let hasHeader = Boolean(path || title);

	return () => (
		<div>
			<pre
				className={`language-${language}`}
				mix={[
					css({
						overflowX: "auto",
						overflowY: "hidden",
						overscrollBehaviorX: "contain",
						overscrollBehaviorInline: "contain",
						borderRadius: "0.5rem",
						border: "1px solid var(--ui-neutral-border)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						padding: "1rem",
						fontSize: "0.875rem",
					}),
				]}
			>
				{hasHeader && (
					<header
						mix={[
							css({
								marginBottom: "0.75rem",
								borderBottom: "1px solid var(--ui-neutral-border)",
								paddingBottom: "0.5rem",
							}),
						]}
					>
						<div
							mix={[
								css({
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
									fontSize: "0.75rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{title && <span mix={[css({ fontWeight: 500 })]}>{title}</span>}
							{path && (
								<span
									mix={[
										css({
											color: "var(--color-highlight-comment)",
											fontFamily:
												'"Bradley Hand", "Segoe Print", "Comic Sans MS", "Apple Chancery", cursive',
											fontWeight: 500,
											fontSize: "1.1em",
										}),
									]}
								>
									// {path}
								</span>
							)}
						</div>
					</header>
				)}

				<code className={`language-${language}`} innerHTML={content} />
			</pre>
		</div>
	);
}
