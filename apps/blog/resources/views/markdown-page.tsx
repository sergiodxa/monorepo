/**
 * View for a standalone page written in Markdown, such as `/mcp` or a privacy policy.
 * Renders the parsed body inside the design system's `Typeset` reading rhythm, the same
 * presentation a post uses for its own prose, with a link to the page's Markdown source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Markdown } from "@sdxc/markdown";

import { toRemix } from "@sdxc/markdown/remix";
import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { contents, flexWrap, gap, grid, hstack, shrink } from "@sdxc/u/layout";
import { bleed, m, mi, minIs, p } from "@sdxc/u/size";
import { overflowWrap, tabSize, text } from "@sdxc/u/typography";
import { Heading, Link, Typeset } from "@sdxc/ui";

import { BlogLayout } from "~/resources/layouts/blog";

/**
 * Types used by the Markdown page renderer.
 */
export namespace MarkdownPageView {
	/** Data required to render the page. */
	export interface Model {
		title: string;
		description: string;
		/** The navigation entry to mark current, when the page has one. */
		activePath?: string;
		/** The page's body, parsed from its Markdown source. */
		document: Markdown.Document;
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
export function MarkdownPageView() {
	return ({ model }: { model: MarkdownPageView.Model }) => (
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
					<Typeset preset="reading">{toRemix(model.document)}</Typeset>
				</article>
			</main>
		</BlogLayout>
	);
}
