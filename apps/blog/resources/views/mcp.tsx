/**
 * View for the `/mcp` page.
 *
 * Renders the way a post does: title, a "view as Markdown" link, and the body inside the
 * design system's `Typeset` reading rhythm, because it is the same kind of thing, prose
 * written in Markdown. It is not the post view itself, since that one builds its links from
 * a post type and slug this page has neither of.
 *
 * The page carries no language chrome. Which translation a reader gets is settled before the
 * view runs, and a label naming it, or a link offering the other one, would be the only
 * furniture on the page that exists to explain the page rather than the server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown as MarkdownType } from "@pkg/markdown/server";

import { MarkdownView } from "@pkg/markdown/client";
import { bg, border } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { contents, flexWrap, gap, grid, hstack, shrink } from "@pkg/u/layout";
import { bleed, m, mi, minIs, p } from "@pkg/u/size";
import { overflowWrap, tabSize, text } from "@pkg/u/typography";
import { Heading, Link, Typeset } from "@pkg/ui";

import { BlogLayout } from "~/resources/layouts/blog";

/**
 * Types used by the MCP page renderer.
 */
export namespace McpView {
	/** Data required to render the page. */
	export interface Model {
		title: string;
		description: string;
		activePath: string;
		/** The page's own render tree, parsed from its Markdown source. */
		content: MarkdownType.Parsed<{ title: string; description: string }>["content"];
		/** Where the same page is served as Markdown. */
		markdownHref: string;
		/** BCP 47 tag for the language this page is written in. */
		locale: string;
	}
}

/**
 * Builds the page renderer.
 *
 * The body panel bleeds over the layout's inline padding and takes the same tinted card as
 * a post's, so a reader arriving from an article finds the same shape.
 *
 * @returns View function that renders the page from its parsed Markdown.
 */
export function McpView() {
	return ({ model }: { model: McpView.Model }) => (
		<BlogLayout
			locale={model.locale}
			title={model.title}
			description={model.description}
			activePath={model.activePath}
		>
			<main mix={[grid(), gap(4), mi("auto")]}>
				<header mix={[contents()]}>
					<hgroup mix={[contents()]}>
						<div mix={[hstack({ gap: 3, align: "center", justify: "end" }), flexWrap("wrap")]}>
							<Link href={model.markdownHref} mix={[text("sm"), shrink(0)]}>
								View as Markdown
							</Link>
						</div>

						<Heading level={1} mix={[m(0), text("4xl"), overflowWrap("break-word")]}>
							{model.title}
						</Heading>
					</hgroup>
				</header>

				<article
					mix={[
						p(4),
						border({ width: 1, color: "neutral" }),
						rounded("lg"),
						bg("neutral.bg-tint-hover"),
						bleed(4),
						overflowWrap("break-word"),
						tabSize(),
						minIs(0),
					]}
				>
					<Typeset preset="reading">
						<MarkdownView content={model.content} />
					</Typeset>
				</article>
			</main>
		</BlogLayout>
	);
}
