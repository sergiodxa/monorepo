/**
 * View for the blog post detail page, marked up as an `h-entry` (name, byline, date,
 * content) so IndieWeb readers see who wrote it and when, followed by a sponsor
 * call-to-action and, for tutorials, an embedded related-posts frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { toRemix } from "@sdxc/markdown/remix";
import { MicroTime, mf } from "@sdxc/microformats/ui";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { basis, contents, flexWrap, gap, grid, grow, hstack, shrink } from "@sdxc/u/layout";
import { bleed, bs, is, m, mbs, mi, minIs, p } from "@sdxc/u/size";
import { overflowWrap, tabSize, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { Badge, Card, Heading, Link, LinkButton, Typeset } from "@sdxc/ui";
import { Frame, unsafeHTML } from "remix/component";

import type { PostViewModel } from "~/app/http/view-models/post";

import { PROFILE } from "~/config/profile";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Types used by the post page renderer.
 */
export namespace PostView {
	/**
	 * Shape of the data required to render a post page.
	 */
	export interface Model extends PostViewModel.Page {}
}

/** What each kind of mention says its author did, completing "<author> …". */
const MENTION_VERBS: Record<PostViewModel.Mention["kind"], string> = {
	reply: "replied",
	mention: "mentioned this",
	like: "liked this",
	repost: "reposted this",
	bookmark: "bookmarked this",
};

/**
 * The approved Webmentions under a post: reactions as a row of author avatars, and
 * responses with their content, each an `h-cite` naming its author. Content was
 * sanitized when the mention was verified; photos load without a referrer at a fixed size.
 * Renders nothing for a post nobody has mentioned yet.
 */
function PostMentions(handle: Handle<{ mentions: PostViewModel.Page["mentions"] }>) {
	return () => {
		let { reactions, responses } = handle.props.mentions;
		if (reactions.length === 0 && responses.length === 0) return null;

		return (
			<section aria-labelledby="webmentions" mix={[grid(), gap(3)]}>
				<Heading level={2} id="webmentions" mix={[m(0), text("2xl")]}>
					Webmentions
				</Heading>

				{reactions.length > 0 && (
					<ul mix={[m(0), p(0), listStyle("none"), hstack({ gap: 2 }), flexWrap("wrap")]}>
						{reactions.map((reaction) => (
							<li key={reaction.url} mix={[mf("h-cite")]}>
								<a
									href={reaction.url}
									title={`${reaction.authorName} ${MENTION_VERBS[reaction.kind]}`}
									mix={[mf("u-url"), text("sm")]}
								>
									<span mix={[mf("p-author", "h-card")]}>
										{reaction.authorPhoto ? (
											<img
												src={reaction.authorPhoto}
												alt={reaction.authorName}
												width={32}
												height={32}
												loading="lazy"
												referrerpolicy="no-referrer"
												mix={[mf("u-photo", "p-name"), is(8), bs(8), rounded("full")]}
											/>
										) : (
											<span mix={[mf("p-name")]}>{reaction.authorName}</span>
										)}
									</span>
								</a>
							</li>
						))}
					</ul>
				)}

				{responses.length > 0 && (
					<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(3)]}>
						{responses.map((response) => (
							<li key={response.url} mix={[mf("h-cite")]}>
								<Card mix={[p(4), grid(), gap(2), overflowWrap("break-word"), minIs(0)]}>
									<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
										<a
											href={response.authorUrl ?? response.url}
											mix={[mf("p-author", "h-card"), fg("neutral.emphasis"), weight("bold")]}
										>
											{response.authorName}
										</a>{" "}
										<a href={response.url} mix={[mf("u-url"), fg("neutral.muted")]}>
											{MENTION_VERBS[response.kind]}
											{response.publishedLabel && ` on ${response.publishedLabel}`}
										</a>
									</p>
									{response.contentHtml && (
										<div
											mix={[mf("e-content"), text("base")]}
											innerHTML={unsafeHTML(response.contentHtml)}
										/>
									)}
								</Card>
							</li>
						))}
					</ol>
				)}
			</section>
		);
	};
}

/**
 * Builds a page renderer for a blog post detail view. The body panel bleeds over
 * the layout's inline padding and matches the sponsor card's fixed `lg` radius;
 * sponsor copy uses the darker tone weights to clear AA on the tint.
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
					<article mix={[mf("h-entry"), contents()]}>
						<header mix={[contents()]}>
							<div mix={[hstack({ gap: 2, align: "center" }), is("full"), flexWrap("wrap")]}>
								{model.post.tags.length > 0 && (
									<div mix={[hstack({ gap: 2 }), flexWrap("wrap")]}>
										{model.post.tags.map((tag) => (
											<Badge key={tag} color="brand" variant="secondary" mix={[mf("p-category")]}>
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

								<Heading
									level={1}
									mix={[mf("p-name"), m(0), text("4xl"), overflowWrap("break-word")]}
								>
									{model.post.title}
								</Heading>

								<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
									By{" "}
									<a
										href={PROFILE.canonical.origin}
										mix={[mf("p-author", "h-card"), fg("neutral.muted")]}
									>
										{PROFILE.name}
									</a>
									{model.post.published && (
										<>
											{" · "}
											<a href={model.post.url} mix={[mf("u-url", "u-uid"), fg("neutral.muted")]}>
												<MicroTime property="dt-published" value={model.post.published}>
													{model.post.publishedLabel}
												</MicroTime>
											</a>
										</>
									)}
								</p>
							</hgroup>
						</header>

						<div
							mix={[
								mf("e-content"),
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
							{model.post.document ? (
								<Typeset preset="reading">{toRemix(model.post.document)}</Typeset>
							) : (
								<p mix={[m(0)]}>No content.</p>
							)}
						</div>
					</article>

					<PostMentions mentions={model.mentions} />

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
