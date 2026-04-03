import { css } from "remix/component";

import { BlogLayout } from "~/resources/components/layout/blog";
import routes from "~/routes/web";

/**
 * Types for the bookmarks page data consumed by the view renderer.
 */
export namespace BookmarksView {
	/**
	 * A single bookmark entry rendered in the list.
	 */
	export interface Item {
		href: string;
		label: string;
		preview?: boolean;
		suffixHref?: string;
		suffixLabel?: string;
		suffixAriaLabel?: string;
		suffixTitle?: string;
	}

	/**
	 * Data model required to render the bookmarks page.
	 */
	export interface Model {
		items: Array<Item>;
	}
}

/**
 * Normalizes bookmark URLs so links always resolve correctly.
 */
function normalizeBookmarkHref(rawHref: string) {
	if (rawHref.startsWith("http://") || rawHref.startsWith("https://")) {
		return rawHref;
	}

	if (rawHref.startsWith("/")) {
		return rawHref;
	}

	return `https://${rawHref}`;
}

/**
 * Creates the bookmarks page renderer using the provided view model.
 */
export function BookmarksView() {
	return ({ model }: { model: BookmarksView.Model }) => (
		<BlogLayout
			title="Bookmarks"
			description="Links that I read and liked."
			activePath={routes.bookmarks.href()}
		>
			<main mix={[css({ display: "grid", gap: "0.85rem" })]}>
				<h1 mix={[css({ margin: 0, fontSize: "2rem", color: "var(--ui-neutral-fg-emphasis)" })]}>
					Bookmarks
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
					Links that I read and liked.
				</p>
				<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)", fontSize: "1.05rem" })]}>
					Subscribe to my bookmarks using <a href={routes.rss.bookmarks.href()}>RSS</a>.
				</p>
				{model.items.length === 0 ? (
					<p mix={[css({ margin: 0, color: "var(--ui-neutral-fg)" })]}>No bookmarks yet.</p>
				) : (
					<ul
						mix={[
							css({ margin: "0.4rem 0 0", paddingLeft: "1.1rem", display: "grid", gap: "0.55rem" }),
						]}
					>
						{model.items.map((item) => (
							<li key={item.href} mix={[css({ fontSize: "1.05rem", lineHeight: 1.25 })]}>
								<a
									href={normalizeBookmarkHref(item.href)}
									mix={[css({ color: "var(--ui-accent-fg)" })]}
								>
									{item.label}
								</a>
								{item.suffixHref && item.suffixLabel && (
									<>
										{" - "}
										<a
											href={normalizeBookmarkHref(item.suffixHref)}
											aria-label={item.suffixAriaLabel}
											title={item.suffixTitle}
											mix={[css({ color: "var(--ui-accent-fg)", textDecoration: "none" })]}
										>
											{item.suffixLabel}
										</a>
									</>
								)}
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
