/**
 * View for the public bookmarks list page. Renders an intro, an RSS subscribe
 * link, and a dated list of bookmark links with an optional suffix link (e.g. an
 * archive snapshot). Includes helpers to normalize bookmark URLs into safe hrefs
 * and to format dates. Exists to publish links the author read and liked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/ui";

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
		date: string;
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
 * Formats a bookmark date for compact list display.
 * @param value ISO-like timestamp used by the row.
 * @returns Short English date or an empty string when invalid.
 */
function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
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
									<a href={normalizeBookmarkHref(item.href)}>{item.label}</a>
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
								<div
									mix={[
										css({
											display: "inline-flex",
											gap: "0.4rem",
											alignItems: "center",
											justifySelf: "end",
											whiteSpace: "nowrap",
											marginTop: "0.1rem",
										}),
									]}
								>
									<time
										mix={[
											css({
												color: "var(--ui-neutral-fg-muted)",
												fontSize: "0.95rem",
											}),
										]}
									>
										{formatDate(item.date)}
									</time>
									{item.suffixHref && item.suffixLabel && (
										<a
											href={normalizeBookmarkHref(item.suffixHref)}
											aria-label={item.suffixAriaLabel}
											title={item.suffixTitle}
											mix={[
												css({
													textDecoration: "none",
													lineHeight: 1,
												}),
											]}
										>
											{item.suffixLabel}
										</a>
									)}
								</div>
							</li>
						))}
					</ol>
				)}
			</main>
		</BlogLayout>
	);
}
