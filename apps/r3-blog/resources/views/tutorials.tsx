import { css } from "remix/component";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

/**
 * Types used by the tutorials page view.
 */
export namespace TutorialsView {
	/**
	 * A tutorial link shown in the list.
	 */
	export interface Item {
		href: string;
		label: string;
		date: string;
		preview?: boolean;
	}

	/**
	 * Data required to render the tutorials page.
	 */
	export interface Model {
		items: Array<Item>;
	}
}

/**
 * Builds the tutorial URL for a given slug.
 * @param slug Tutorial slug used in the route.
 * @returns Absolute path to the tutorial page.
 */
export function tutorialPathFromSlug(slug: string) {
	return routes.post.href({ postType: "tutorials", postSlug: slug });
}

/**
 * Formats a tutorial date for compact list display.
 * @param value ISO-like timestamp used by the row.
 * @returns Short English date or an empty string when invalid.
 */
function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
}

/**
 * Creates the tutorials page renderer using blog layout styles.
 * @returns A view function that renders the tutorials model.
 */
export function TutorialsView() {
	return ({ model }: { model: TutorialsView.Model }) => (
		<BlogLayout
			title="Tutorials"
			description="Learn about Remix, React, and more."
			activePath={routes.tutorials.href()}
		>
			<main mix={[css({ display: "grid", gap: "0.85rem" })]}>
				<h1 mix={[css({ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
					Tutorials
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
					Learn about Remix, React, and more.
				</p>
				<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)", fontSize: "1.05rem" })]}>
					Subscribe to my tutorials using <a href={routes.rss.tutorials.href()}>RSS</a>.
				</p>
				{model.items.length === 0 ? (
					<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>No tutorials yet.</p>
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
