import { MarkdownView } from "@pkg/markdown/client/remix";
import { Frame, css } from "remix/component";

import type { PostViewModel } from "~/app/http/view-models/post";

import { BlogLayout } from "~/resources/components/layout/blog";
import prismStyles from "~/resources/css/prism.css?url";
import routes from "~/routes/web";

export namespace PostView {
	export interface Model extends PostViewModel.Page {}
}

function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
}

export function PostView() {
	return ({ model }: { model: PostView.Model }) => {
		let fileFormat = model.post.format ?? "html";

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
									flexDirection: "row",
									alignItems: "flex-start",
									width: "100%",
									gap: "0.5rem",
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
										marginLeft: "auto",
									}),
								]}
							>
								View as Markdown
							</a>
						</div>

						<hgroup mix={[css({ display: "contents" })]}>
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

							<h1
								mix={[
									css({
										margin: 0,
										fontSize: "2.1rem",
										lineHeight: 1.05,
										color: "var(--ui-neutral-fg-emphasis)",
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
								borderRadius: "0.6rem",
								backgroundColor: "var(--ui-neutral-bg-tint-hover)",
								margin: "0 -1.1rem",
							}),
						]}
					>
						{model.post.content ? (
							<MarkdownView content={model.post.content} />
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
								borderRadius: "0.8rem",
								backgroundColor: "var(--ui-accent-bg-tint)",
								display: "grid",
								gridTemplateColumns: "1fr auto",
								gap: "0.8rem",
								alignItems: "center",
							}),
						]}
					>
						<div>
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
							href="https://github.com/sponsors/sergiodxa"
							mix={[
								css({
									textDecoration: "none",
									backgroundColor: "var(--ui-accent-bg-solid)",
									color: "var(--ui-neutral-fg-on-solid)",
									padding: "0.7rem 1.1rem",
									borderRadius: "0.65rem",
									fontWeight: 700,
								}),
							]}
						>
							Sponsor me on GitHub
						</a>
					</section>

					{model.post.typePath === "tutorials" && (
						<Frame
							src={routes.postRelated.href({
								postType: model.post.typePath,
								postSlug: model.post.slug,
							})}
							fallback={
								<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>
									Loading related tutorials...
								</p>
							}
						/>
					)}

					<dl
						mix={[
							css({
								margin: 0,
								display: "grid",
								gridTemplateColumns: "max-content 1fr",
								gap: "0.5rem 0.9rem",
								padding: "0.9rem 1rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "0.6rem",
								backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							}),
						]}
					>
						<dt mix={[css({ fontWeight: 700, color: "var(--ui-neutral-fg)" })]}>Type</dt>
						<dd mix={[css({ margin: 0 })]}>{model.post.typePath}</dd>
						<dt mix={[css({ fontWeight: 700, color: "var(--ui-neutral-fg)" })]}>Slug</dt>
						<dd mix={[css({ margin: 0 })]}>{model.post.slug}</dd>
						<dt mix={[css({ fontWeight: 700, color: "var(--ui-neutral-fg)" })]}>Format</dt>
						<dd mix={[css({ margin: 0 })]}>{fileFormat}</dd>
						{model.post.publishedAt && (
							<>
								<dt mix={[css({ fontWeight: 700, color: "var(--ui-neutral-fg)" })]}>Published</dt>
								<dd mix={[css({ margin: 0 })]}>{formatDate(model.post.publishedAt)}</dd>
							</>
						)}
					</dl>
				</main>
			</BlogLayout>
		);
	};
}
