/**
 * View for the public tutorials list page. Renders an intro, an RSS subscribe
 * link, and a dated list of tutorial rows (with optional preview badges) inside
 * the shared BlogLayout. Exports helpers to build a tutorial href from a slug
 * and to format list dates. Exists to index all published tutorials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Heading, Link } from "@pkg/r3-ui";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { listStyle } from "@pkg/u/general";
import { gap, grid, gridTemplate, items } from "@pkg/u/layout";
import { m, maxIs, mbs, mis, p } from "@pkg/u/size";
import { nowrap, tabularNums, text } from "@pkg/u/typography";

import { BlogLayout } from "~/resources/layouts/blog";
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
			<main mix={[grid(), gap(4)]}>
				<Heading level={1} mix={[text("3xl")]}>
					Tutorials
				</Heading>
				<p mix={[m(0), maxIs("52ch"), text("lg"), fg("neutral")]}>
					Learn about Remix, React, and more.
				</p>
				<p mix={[m(0), text("lg"), fg("neutral")]}>
					Subscribe to my tutorials using <Link href={routes.rss.tutorials.href()}>RSS</Link>.
				</p>
				{model.items.length === 0 ? (
					<p mix={[m(0), text("base"), fg("neutral")]}>No tutorials yet.</p>
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
									<Link href={item.href}>{item.label}</Link>
									{item.preview && (
										<Badge color="warning" variant="secondary" mix={[mis(2)]}>
											Preview
										</Badge>
									)}
								</p>
								<time mix={[text("sm"), fg("neutral.muted"), nowrap(), tabularNums()]}>
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
