import { MarkdownView } from "@pkg/markdown/client/remix";
import { Frame, css } from "remix/ui";

import type { PostViewModel } from "~/app/http/view-models/post";

import { PROFILE } from "~/config/profile";
import { BlogLayout } from "~/resources/components/layout/blog";
import prismStyles from "~/resources/css/prism.css?url";
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
				stylesheets={[{ href: prismStyles }]}
				canonical={model.canonical}
				meta={model.meta}
			>
				<main mix={[css({ display: "grid", gap: "0.9rem", margin: "0 auto" })]}>
					<header mix={[css({ display: "contents" })]}>
						<div
							mix={[
								css({
									display: "flex",
									alignItems: "center",
									width: "100%",
									gap: "0.5rem",
									flexWrap: "wrap",
								}),
							]}
						>
							{model.post.tags.length > 0 && (
								<div mix={[css({ display: "flex", gap: "0.5rem", flexWrap: "wrap" })]}>
									{model.post.tags.map((tag) => (
										<span
											key={tag}
											mix={[
												css({
													padding: "0.2rem 0.6rem",
													borderRadius: "999px",
													backgroundColor: "var(--ui-accent-bg-tint)",
													color: "var(--ui-accent-fg-emphasis)",
													fontSize: "0.9rem",
												}),
											]}
										>
											{tag}
										</span>
									))}
								</div>
							)}
						</div>

						<hgroup mix={[css({ display: "contents" })]}>
							<div
								mix={[
									css({
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "0.75rem",
										flexWrap: "wrap",
									}),
								]}
							>
								<p
									mix={[
										css({
											margin: 0,
											textTransform: "uppercase",
											letterSpacing: "0.12em",
											fontSize: "0.8rem",
											color: "var(--ui-neutral-fg-muted)",
											fontWeight: 700,
										}),
									]}
								>
									{model.post.eyebrow}
								</p>

								<a
									href={routes.post.href({
										postType: model.post.typePath,
										postSlug: model.post.slug,
										ext: "md",
									})}
									mix={[
										css({
											fontSize: "0.9rem",
											lineHeight: "1.4",
											fontFamily: "inherit",
											color: "var(--ui-accent-fg-emphasis)",
											flexShrink: 0,
										}),
									]}
								>
									View as Markdown
								</a>
							</div>

							<h1
								mix={[
									css({
										margin: 0,
										fontSize: "2.1rem",
										lineHeight: 1.05,
										color: "var(--ui-neutral-fg-emphasis)",
										overflowWrap: "break-word",
									}),
								]}
							>
								{model.post.title}
							</h1>
						</hgroup>
					</header>

					<article
						mix={[
							css({
								lineHeight: 1.7,
								color: "var(--ui-neutral-fg-emphasis)",
								fontSize: "1rem",
								padding: "1rem 1.1rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "clamp(0px, calc((100vw - 800px) * 999), 0.6rem)",
								backgroundColor: "var(--ui-neutral-bg-tint-hover)",
								margin: "0 -1.1rem",
								overflowWrap: "break-word",
								minWidth: 0,
							}),
						]}
					>
						{model.post.content ? (
							MarkdownView({ content: model.post.content })
						) : (
							<p mix={[css({ margin: 0 })]}>No content.</p>
						)}
					</article>

					<section
						mix={[
							css({
								margin: "0 -1.1rem",
								padding: "1rem 1.1rem",
								border: "1px solid var(--ui-accent-border)",
								borderRadius: "clamp(0px, calc((100vw - 800px) * 999), 0.8rem)",
								backgroundColor: "var(--ui-accent-bg-tint)",
								display: "flex",
								flexWrap: "wrap",
								justifyContent: "space-between",
								gap: "0.8rem",
								alignItems: "center",
							}),
						]}
					>
						<div mix={[css({ minWidth: 0, flex: "1 1 30rem" })]}>
							<p
								mix={[
									css({
										margin: 0,
										color: "var(--ui-accent-fg-muted)",
										fontSize: "1rem",
										fontWeight: 700,
									}),
								]}
							>
								Do you like my content?
							</p>
							<p
								mix={[
									css({
										margin: "0.2rem 0 0",
										color: "var(--ui-accent-fg-muted)",
										fontSize: "1rem",
									}),
								]}
							>
								Your sponsorship helps me create more tutorials, articles, and open-source tools.
							</p>
						</div>
						<a
							href={PROFILE.github.sponsor}
							mix={[
								css({
									textDecoration: "none",
									backgroundColor: "var(--ui-accent-bg-solid)",
									color: "var(--ui-neutral-fg-on-solid)",
									padding: "0.7rem 1.1rem",
									borderRadius: "0.65rem",
									fontWeight: 700,
									flexShrink: 0,
								}),
							]}
						>
							Sponsor me on GitHub
						</a>
					</section>

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
