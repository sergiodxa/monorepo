/**
 * Draws a code block as a `<pre>` with an optional header for the file path and
 * title an annotation wrote. Painted runs arrive as tokens and become spans a
 * stylesheet colours; plain source renders as the text it is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/* @jsxImportSource remix/ui */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

/**
 * Groups the code fence's types under the component name.
 */
export namespace Fence {
	/**
	 * One painted run of source. The shape is structural so a document painted
	 * elsewhere renders here without this package knowing who painted it.
	 */
	export interface Token {
		type: string;
		value: string;
	}

	/**
	 * `content` is the source as written, drawn whenever `tokens` is empty, so a
	 * document that was never painted still shows its code.
	 */
	export interface Props {
		tokens: Token[];
		content: string;
		language: string;
		path?: string;
		title?: string;
	}
}

/**
 * Renders a code block, headed by whatever metadata the fence carried.
 */
export function Fence({ props }: Handle<Fence.Props>) {
	let { tokens, content, language, path, title } = props;
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
											color: "var(--highlight-comment)",
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

				<code className={`language-${language}`}>
					{tokens.length > 0
						? tokens.map((token, index) =>
								token.type === "plain" ? (
									token.value
								) : (
									<span key={index} className={`token ${token.type}`}>
										{token.value}
									</span>
								),
							)
						: content}
				</code>
			</pre>
		</div>
	);
}
