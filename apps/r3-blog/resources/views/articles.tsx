import { css } from "remix/component";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

/**
 * Groups type contracts for the articles list page.
 */
export namespace ArticlesView {
	/**
	 * Represents one article link rendered in the list.
	 */
	export interface Item {
		href: string;
		label: string;
		preview?: boolean;
	}

	/**
	 * Supplies all data needed to render the articles page.
	 */
	export interface Model {
		items: Array<Item>;
	}
}

/**
 * Builds the canonical URL path for an article slug.
 * @param slug Article slug used in the route.
 * @returns Resolved href for the article page.
 */
export function articlePath(slug: string) {
	return routes.post.href({ postType: "articles", postSlug: slug });
}

/**
 * Creates the articles page renderer with title, feed link, and item list.
 * @returns A view function that renders from an articles model.
 */
export function ArticlesView() {
	return ({ model }: { model: ArticlesView.Model }) => (
		<BlogLayout
			title="Articles"
			description="These are my articles."
			activePath={routes.articles.href()}
		>
			<main mix={[css({ display: "grid", gap: "0.85rem" })]}>
				<h1 mix={[css({ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
					Articles
				</h1>
				<p
					mix={[
						css({
							margin: 0,
							color: "var(--ui-neutral-fg)",
							maxWidth: "52ch",
							fontSize: "1.05rem",
							lineHeight: 1.35,
						}),
					]}
				>
					These are my articles.
				</p>
				<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)", fontSize: "1.05rem" })]}>
					Subscribe to my articles using <a href={routes.rss.articles.href()}>RSS</a>.
				</p>
				{model.items.length === 0 ? (
					<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>No articles yet.</p>
				) : (
					<ul
						mix={[
							css({ margin: "0.4rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem" }),
						]}
					>
						{model.items.map((item) => (
							<li key={item.href} mix={[css({ fontSize: "1.05rem", lineHeight: 1.25 })]}>
								<a href={item.href} mix={[css({ color: "var(--ui-accent-fg)" })]}>
									{item.label}
								</a>
								{item.preview && (
									<span
										mix={[
											css({
												marginLeft: "0.35rem",
												color: "var(--ui-accent-fg-emphasis)",
												fontSize: "0.8rem",
											}),
										]}
									>
										Preview
									</span>
								)}
							</li>
						))}
					</ul>
				)}
			</main>
		</BlogLayout>
	);
}
