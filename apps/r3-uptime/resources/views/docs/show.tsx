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

import type { DocFrontmatter } from "~/app/services/docs";

import * as s from "~/resources/styles";

namespace DocShowView {
	export interface Props {
		content: unknown;
		frontmatter: DocFrontmatter;
	}
}

export default function DocShowView(handle: Handle<DocShowView.Props>) {
	return () => {
		let { content, frontmatter } = handle.props;

		return (
			<article>
				<header>
					<h1>{frontmatter.title}</h1>
					<p mix={[s.docsIntro]}>{frontmatter.description}</p>
					{frontmatter.lastUpdated && (
						<p mix={[s.mutedSmall]}>Last updated: {frontmatter.lastUpdated}</p>
					)}
				</header>

				{renderToRemix(content)}
			</article>
		);
	};
}
