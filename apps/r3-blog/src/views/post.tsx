import type { Markdown } from "@pkg/markdown/server";

import { MarkdownView } from "@pkg/markdown/client/remix";

import routes from "~/routes";

export namespace PostView {
	export interface Related {
		href: string;
		label: string;
		reason: string;
	}

	export interface Props {
		typePath: string;
		title: string;
		eyebrow: string;
		slug: string;
		content: Markdown.AST | null;
		format?: string;
		publishedAt?: string | null;
		tags?: Array<string>;
		related?: Array<Related>;
	}
}

function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
}

export function PostView() {
	return ({
		content,
		eyebrow,
		format,
		publishedAt,
		related = [],
		slug,
		tags = [],
		title,
		typePath,
	}: PostView.Props) => {
		let fileFormat = format ?? "html";

		return (
			<main css={{ display: "grid", gap: "0.9rem", margin: "0 auto" }}>
				<header css={{ display: "contents" }}>
					<div
						css={{
							display: "flex",
							flexDirection: "row",
							alignItems: "flex-start",
							width: "100%",
							gap: "0.5rem",
						}}
					>
						{tags.length > 0 && (
							<div css={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
								{tags.map((tag) => (
									<span
										key={tag}
										css={{
											padding: "0.2rem 0.6rem",
											borderRadius: "999px",
											backgroundColor: "var(--ui-accent-bg-tint)",
											color: "var(--ui-accent-fg-emphasis)",
											fontSize: "0.9rem",
										}}
									>
										{tag}
									</span>
								))}
							</div>
						)}

						<a
							href={routes.post.href({ postType: typePath, postSlug: slug, ext: "md" })}
							css={{
								fontSize: "0.9rem",
								lineHeight: "1.4",
								fontFamily: "inherit",
								color: "var(--ui-accent-fg-emphasis)",
								flexShrink: 0,
								marginLeft: "auto",
							}}
						>
							View as Markdown
						</a>
					</div>

					<hgroup css={{ display: "contents" }}>
						<p
							css={{
								margin: 0,
								textTransform: "uppercase",
								letterSpacing: "0.12em",
								fontSize: "0.8rem",
								color: "var(--ui-neutral-fg-muted)",
								fontWeight: 700,
							}}
						>
							{eyebrow}
						</p>

						<h1
							css={{
								margin: 0,
								fontSize: "2.1rem",
								lineHeight: 1.05,
								color: "var(--ui-neutral-fg-emphasis)",
							}}
						>
							{title}
						</h1>
					</hgroup>
				</header>

				<article
					css={{
						lineHeight: 1.7,
						color: "var(--ui-neutral-fg-emphasis)",
						fontSize: "1rem",
						padding: "1rem 1.1rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.6rem",
						backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						margin: "0 -1.1rem",
					}}
				>
					{content ? <MarkdownView content={content} /> : <p css={{ margin: 0 }}>No content.</p>}
				</article>

				<section
					css={{
						margin: "0 -1.1rem",
						padding: "1rem 1.1rem",
						border: "1px solid var(--ui-accent-border)",
						borderRadius: "0.8rem",
						backgroundColor: "var(--ui-accent-bg-tint)",
						display: "grid",
						gridTemplateColumns: "1fr auto",
						gap: "0.8rem",
						alignItems: "center",
					}}
				>
					<div>
						<p
							css={{
								margin: 0,
								color: "var(--ui-accent-fg-muted)",
								fontSize: "1rem",
								fontWeight: 700,
							}}
						>
							Do you like my content?
						</p>
						<p css={{ margin: "0.2rem 0 0", color: "var(--ui-accent-fg-muted)", fontSize: "1rem" }}>
							Your sponsorship helps me create more tutorials, articles, and open-source tools.
						</p>
					</div>
					<a
						href="https://github.com/sponsors/sergiodxa"
						css={{
							textDecoration: "none",
							backgroundColor: "var(--ui-accent-bg-solid)",
							color: "var(--ui-neutral-fg-on-solid)",
							padding: "0.7rem 1.1rem",
							borderRadius: "0.65rem",
							fontWeight: 700,
						}}
					>
						Sponsor me on GitHub
					</a>
				</section>

				{related.length > 0 && (
					<section css={{ display: "grid", gap: "1rem" }}>
						<h2 css={{ margin: 0, color: "var(--ui-neutral-fg-emphasis)", fontSize: "1.5rem" }}>
							Related tutorials
						</h2>
						<div
							css={{
								display: "grid",
								gap: "0.9rem",
								gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
							}}
						>
							{related.map((item) => (
								<article
									key={item.href}
									css={{
										border: "1px solid var(--ui-neutral-border)",
										borderRadius: "0.8rem",
										padding: "0.9rem",
										backgroundColor: "var(--ui-neutral-bg-tint)",
									}}
								>
									<a
										href={item.href}
										css={{
											fontSize: "1.05rem",
											fontWeight: 700,
											color: "var(--ui-accent-fg)",
										}}
									>
										{item.label}
									</a>
									<p css={{ margin: "0.6rem 0 0", color: "var(--ui-neutral-fg)" }}>{item.reason}</p>
								</article>
							))}
						</div>
					</section>
				)}

				<dl
					css={{
						margin: 0,
						display: "grid",
						gridTemplateColumns: "max-content 1fr",
						gap: "0.5rem 0.9rem",
						padding: "0.9rem 1rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "0.6rem",
						backgroundColor: "var(--ui-neutral-bg-tint-hover)",
					}}
				>
					<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Type</dt>
					<dd css={{ margin: 0 }}>{typePath}</dd>
					<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Slug</dt>
					<dd css={{ margin: 0 }}>{slug}</dd>
					<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Format</dt>
					<dd css={{ margin: 0 }}>{fileFormat}</dd>
					{publishedAt && (
						<>
							<dt css={{ fontWeight: 700, color: "var(--ui-neutral-fg)" }}>Published</dt>
							<dd css={{ margin: 0 }}>{formatDate(publishedAt)}</dd>
						</>
					)}
				</dl>
			</main>
		);
	};
}
