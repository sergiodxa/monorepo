/**
 * View for the public bookmarks list page. Renders an intro, an RSS subscribe
 * link, and a dated list of bookmark rows with an optional suffix link (e.g. an
 * archive snapshot). Includes helpers to normalize bookmark URLs into safe hrefs
 * and to format dates. Exists to publish links the author read and liked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { listStyle } from "@pkg/u/general";
import { gap, grid, gridTemplate, hstack, items } from "@pkg/u/layout";
import { m, maxIs, mbs, mis, p } from "@pkg/u/size";
import { leading, nowrap, tabularNums, text, textDecoration } from "@pkg/u/typography";
import { Badge, Heading, Link } from "@pkg/ui";

import { BlogLayout } from "~/resources/layouts/blog";
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
 * Creates the bookmarks page renderer. The archive suffix is a native anchor
 * so the lone glyph renders free of the underline `@pkg/ui`'s Link always
 * applies.
 */
export function BookmarksView() {
	return ({ model }: { model: BookmarksView.Model }) => (
		<BlogLayout
			title="Bookmarks"
			description="Links that I read and liked."
			activePath={routes.bookmarks.href()}
		>
			<main mix={[grid(), gap(4)]}>
				<Heading level={1} mix={[text("3xl")]}>
					Bookmarks
				</Heading>
				<p mix={[m(0), maxIs("52ch"), text("lg"), fg("neutral")]}>Links that I read and liked.</p>
				<p mix={[m(0), text("lg"), fg("neutral")]}>
					Subscribe to my bookmarks using <Link href={routes.rss.bookmarks.href()}>RSS</Link>.
				</p>
				{model.items.length === 0 ? (
					<p mix={[m(0), text("base"), fg("neutral")]}>No bookmarks yet.</p>
				) : (
					<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(3), mbs(2)]}>
						{model.items.map((item) => (
							<li
								key={item.href}
								mix={[
									grid(),
									gridTemplate({ columns: "1fr auto" }),
									gap(3),
									items("baseline"),
									p(4),
									rounded("lg"),
									bg("neutral.tint"),
									border({ width: 1, color: "neutral" }),
								]}
							>
								<p mix={[m(0), text("lg"), fg("neutral.emphasis")]}>
									<Link href={normalizeBookmarkHref(item.href)}>{item.label}</Link>
									{item.preview && (
										<Badge color="warning" variant="secondary" mix={[mis(2)]}>
											Preview
										</Badge>
									)}
								</p>
								<div mix={[hstack({ gap: 2, align: "center" }), nowrap()]}>
									<time mix={[text("sm"), fg("neutral.muted"), tabularNums()]}>
										{formatDate(item.date)}
									</time>
									{item.suffixHref && item.suffixLabel && (
										<a
											href={normalizeBookmarkHref(item.suffixHref)}
											aria-label={item.suffixAriaLabel}
											title={item.suffixTitle}
											mix={[
												text("sm"),
												leading("none"),
												fg("neutral.muted"),
												textDecoration("none"),
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
