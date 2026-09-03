/**
 * View for the `/mcp` page. Renders the parsed Markdown body inside the
 * design system's `Typeset` reading rhythm, the same presentation a post
 * uses for its own prose. The server picks the reader's translation before
 * the view runs, so it renders exactly that language's content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown as MarkdownType } from "@sdxc/markdown/server";

import { MarkdownView } from "@sdxc/markdown/client";
import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { contents, flexWrap, gap, grid, hstack, shrink } from "@sdxc/u/layout";
import { bleed, m, mi, minIs, p } from "@sdxc/u/size";
import { overflowWrap, tabSize, text } from "@sdxc/u/typography";
import { Heading, Link, Typeset } from "@sdxc/ui";

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
