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
