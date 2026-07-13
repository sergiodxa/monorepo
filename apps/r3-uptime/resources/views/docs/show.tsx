/**
 * Individual doc page view (`/docs/*slug`). Renders the frontmatter title,
 * description, and last-updated date, followed by the Markdoc content rendered
 * through `@pkg/markdown-remix`'s `renderToRemix`, called directly rather than via
 * the package's `MarkdownView` component, since this view already composes the
 * result into its own layout rather than needing a standalone wrapper element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { renderToRemix } from "@pkg/markdown-remix";
import { css } from "remix/ui";

import type { DocFrontmatter } from "~/app/services/docs";

import { neutral } from "~/resources/theme";

namespace DocShowView {
	export interface Props {
		content: unknown;
		frontmatter: DocFrontmatter;
	}
}

/** Renders a single doc's frontmatter header followed by its Markdoc `content`. */
export default function DocShowView(handle: Handle<DocShowView.Props>) {
	return () => {
		let { content, frontmatter } = handle.props;

		return (
			<article>
				<header>
					<h1>{frontmatter.title}</h1>
					<p
						mix={[
							css({
								fontSize: "1.0625rem",
								color: "oklch(0.52 0.01 145)",
								margin: "8px 0 32px",
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						{frontmatter.description}
					</p>
					{frontmatter.lastUpdated && (
						<p
							mix={[
								css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": {
										color: neutral[400],
									},
								}),
							]}
						>
							Last updated: {frontmatter.lastUpdated}
						</p>
					)}
				</header>

				{renderToRemix(content)}
			</article>
		);
	};
}
