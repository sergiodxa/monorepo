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
		date: string;
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
 * Formats an article date for compact list display.
 * @param value ISO-like timestamp used by the row.
 * @returns Short English date or an empty string when invalid.
 */
function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
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
					<ol
						mix={[
							css({
								margin: "0.4rem 0 0",
								padding: 0,
								listStyle: "none",
								display: "grid",
								gap: "0.9rem",
							}),
						]}
					>
						{model.items.map((item) => (
							<li
								key={item.href}
								mix={[
									css({
										display: "grid",
										gridTemplateColumns: "1fr auto",
										gap: "0.8rem",
										alignItems: "start",
									}),
								]}
							>
								<p
									mix={[
										css({
											margin: 0,
											fontSize: "1.05rem",
											color: "var(--ui-neutral-fg-emphasis)",
											lineHeight: 1.4,
										}),
									]}
								>
									<a href={item.href}>{item.label}</a>
									{item.preview && (
										<span
											mix={[
												css({
													marginLeft: "0.4rem",
													fontSize: "0.85rem",
													color: "var(--ui-accent-fg-emphasis)",
												}),
											]}
										>
											Preview
										</span>
									)}
								</p>
								<time
									mix={[
										css({
											color: "var(--ui-neutral-fg-muted)",
											fontSize: "0.95rem",
											whiteSpace: "nowrap",
											marginTop: "0.1rem",
										}),
									]}
								>
									{formatDate(item.date)}
								</time>
							</li>
						))}
					</ol>
				)}
			</main>
		</BlogLayout>
	);
}
