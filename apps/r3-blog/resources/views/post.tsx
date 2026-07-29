/**
 * View for the blog post detail page. Renders the post's tags, eyebrow, title,
 * a "View as Markdown" link, and the Markdown-rendered body inside the shared
 * BlogLayout, plus a GitHub sponsor call-to-action and, for tutorials, an
 * embedded related-posts frame. The body's prose rhythm comes from the design
 * system's `Typeset` layer rather than from local type declarations, while the
 * code-block theme keeps overriding it from `prism.css`. Exists to present a
 * single article or tutorial.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MarkdownView } from "@pkg/markdown/client/remix";
import { Badge, Card, Heading, Link, LinkButton, Typeset } from "@pkg/r3-ui";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { basis, contents, flexWrap, gap, grid, grow, hstack, shrink } from "@pkg/u/layout";
import { bleed, is, m, mbs, mi, minIs, p } from "@pkg/u/size";
import { overflowWrap, tabSize, text, textTransform, tracking, weight } from "@pkg/u/typography";
import { Frame } from "remix/ui";

import type { PostViewModel } from "~/app/http/view-models/post";

import { PROFILE } from "~/config/profile";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Groups PostView types used by the post page renderer.
 */
export namespace PostView {
	/**
	 * Shape of the data required to render a post page.
	 */
	export interface Model extends PostViewModel.Page {}
}

/**
 * Builds a page renderer for a blog post detail view.
 */
export function PostView() {
	return ({ model }: { model: PostView.Model }) => {
		return (
			<BlogLayout
				title={model.title}
				description={model.description}
				activePath={model.activePath}
				canonical={model.canonical}
				meta={model.meta}
			>
				<main mix={[grid(), gap(4), mi("auto")]}>
					<header mix={[contents()]}>
						<div mix={[hstack({ gap: 2, align: "center" }), is("full"), flexWrap("wrap")]}>
							{model.post.tags.length > 0 && (
								<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
									{model.post.tags.map((tag) => (
										<Badge key={tag} color="brand" variant="secondary">
											{tag}
										</Badge>
									))}
								</div>
							)}
						</div>

						<hgroup mix={[contents()]}>
							<div
								mix={[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap")]}
							>
								<p
									mix={[
										m(0),
										textTransform("uppercase"),
										tracking("widest"),
										text("sm"),
										fg("neutral.muted"),
										weight("bold"),
									]}
								>
									{model.post.eyebrow}
								</p>

								<Link
									href={routes.post.href({
										postType: model.post.typePath,
										postSlug: model.post.slug,
										ext: "md",
									})}
									mix={[text("sm"), shrink(0)]}
								>
									View as Markdown
								</Link>
							</div>

							<Heading level={1} mix={[m(0), text("4xl"), overflowWrap("break-word")]}>
								{model.post.title}
							</Heading>
						</hgroup>
					</header>

					{/* `bleed(4)` cancels the layout wrapper's own inline padding exactly, so
					the tinted body panel runs edge to edge while its own padding puts the
					prose back on the same measure as the header above it. Corners now stay
					rounded at every width instead of collapsing to square below 800px. Type
					size, leading, and block rhythm are delegated to `Typeset` inside, so
					this element only owns the surface. */}
					<article
						mix={[
							p(4),
							border({ width: 1, color: "neutral" }),
							/* `lg`, not the `xl` a panel this size would otherwise take: the
							sponsor `Card` below is a sibling panel and its own radius is not
							overridable from a call site, so the article matches the component
							rather than sitting a step apart from the panel directly beneath it. */
							rounded("lg"),
							bg("neutral.bg-tint-hover"),
							bleed(4),
							overflowWrap("break-word"),
							tabSize(),
							minIs(0),
						]}
					>
						{model.post.content ? (
							<Typeset preset="reading">
								<MarkdownView content={model.post.content} />
							</Typeset>
						) : (
							<p mix={[m(0)]}>No content.</p>
						)}
					</article>

					<Card
						color="brand"
						mix={[
							bleed(4),
							p(4),
							hstack({ gap: 3, align: "center", justify: "between" }),
							flexWrap("wrap"),
						]}
					>
						<div mix={[minIs(0), grow(1), shrink(1), basis("30rem")]}>
							{/* `emphasis`/`fg`, not `muted`: the muted weight is the tone's 500 step,
							which lands around 3.5:1 on this tinted background — under AA for copy at
							this size. The two darker weights clear it at 15.6:1 and 5.3:1. */}
							<p mix={[m(0), fg("brand.emphasis"), text("base"), weight("bold")]}>
								Do you like my content?
							</p>
							<p mix={[m(0), mbs(1), fg("brand"), text("base")]}>
								Your sponsorship helps me create more tutorials, articles, and open-source tools.
							</p>
						</div>
						<LinkButton
							href={PROFILE.github.sponsor}
							color="brand"
							size="lg"
							mix={[shrink(0), weight("bold")]}
						>
							Sponsor me on GitHub
						</LinkButton>
					</Card>

					{model.post.typePath === "tutorials" && (
						<Frame
							name="related-posts"
							src={routes.postRelated.href({
								postType: model.post.typePath,
								postSlug: model.post.slug,
							})}
						/>
					)}
				</main>
			</BlogLayout>
		);
	};
}
