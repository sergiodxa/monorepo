/**
 * View for the public bookmarks list page. Renders an intro, an RSS subscribe
 * link, and a dated list of bookmark rows with an optional suffix link (e.g. an
 * archive snapshot). Includes helpers to normalize bookmark URLs into safe hrefs
 * and to format dates. Exists to publish links the author read and liked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Heading, Link } from "@pkg/r3-ui";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { listStyle } from "@pkg/u/general";
import { gap, grid, gridTemplate, hstack, items } from "@pkg/u/layout";
import { m, maxIs, mbs, mis, p } from "@pkg/u/size";
import { leading, nowrap, tabularNums, text, textDecoration } from "@pkg/u/typography";

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
							/* The shared list-row treatment used by every public index page: a
							tinted, hairline-bordered card on the `lg` radius, one padding step
							on all sides, with the title claiming the free track and the date
							sitting in an auto track beside it. Baseline alignment replaces the
							old hand-tuned nudge that pushed the date down to meet the title. */
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
								{/* The date and the optional archive link share the row's auto
								track, so they stay glued together on one line no matter how far
								the title beside them wraps. */}
								<div mix={[hstack({ gap: 2, align: "center" }), nowrap()]}>
									<time mix={[text("sm"), fg("neutral.muted"), tabularNums()]}>
										{formatDate(item.date)}
									</time>
									{item.suffixHref && item.suffixLabel && (
										/* The suffix is a bare glyph rather than prose, so it keeps
										native anchor markup: r3-ui's Link always underlines, which
										would draw a rule under a lone icon. */
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
