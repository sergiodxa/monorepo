/**
 * Individual doc page view (`/docs/*slug`). Renders the frontmatter title,
 * description, and last-updated date, followed by the Markdoc content rendered
 * through `@pkg/markdown-remix`'s `renderToRemix`. Calling `renderToRemix` directly
 * (instead of the package's `MarkdownView` JSX wrapper, which destructures its own
 * props React-style and so cannot be used as a `remix/ui` JSX component — see
 * `docs/adr/r3-uptime/ADR-001-port-uptime-to-remix-v3.md` §4.1) sidesteps that.
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
