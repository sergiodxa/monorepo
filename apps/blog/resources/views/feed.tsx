/**
 * View for the site home/feed page. Renders the author intro, an RSS link, and
 * a chronological "Activity" timeline of posts, each with an icon, label, date,
 * and optional preview badge. Includes a helper to format activity dates for
 * compact display. Exists as the landing page of the public blog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColorValue } from "@pkg/u";

import { fg } from "@pkg/u/color";
import { listStyle } from "@pkg/u/general";
import { gap, grid, gridTemplate, inlineFlex, items, justify } from "@pkg/u/layout";
import { bs, is, m, maxIs, mbs, mis, p } from "@pkg/u/size";
import { spacing } from "@pkg/u/tokens";
import { nowrap, text } from "@pkg/u/typography";
import { Badge, Heading, Link } from "@pkg/ui";

import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Shapes the feed page model consumed by the view renderer.
 */
export namespace FeedView {
	/**
	 * One activity entry in the feed list.
	 */
	export interface ActivityItem {
		href: string;
		label: string;
		date: string;
		preview: boolean;
		icon: string;
		/** Semantic tone the icon is tinted with, resolved through `fg()` at render. */
		iconTint: ColorValue;
	}

	/**
	 * Contains all data required to render the feed page.
	 */
	export interface Model {
		activity: Array<ActivityItem>;
	}
}

/**
 * Formats an activity date for the timeline; an unparseable value yields an
 * empty string so the row still renders.
 */
function formatDate(value: string) {
	let date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString("en", { month: "short", day: "2-digit", year: "2-digit" });
}

/**
 * Builds the feed page renderer used by the feed route response. A fixed icon
 * column keeps every row's label at the same inline offset whatever the
 * emoji's intrinsic width.
 */
export function FeedView() {
	return ({ model }: { model: FeedView.Model }) => (
		<BlogLayout title="Sergio Xalambrí" description="Sergio Xalambrí" activePath="/">
			<main mix={[grid(), gap(4)]}>
				<Heading level={1} mix={[m(0), text("4xl")]}>
					Sergio Xalambrí
				</Heading>
				<p mix={[m(0), fg("neutral"), maxIs("60ch"), text("lg")]}>
					Web Developer from Buenos Aires with 10+ years of experience. I work at
					<strong> Daffy</strong> and maintain several open-source libraries around React Router and
					OAuth2.
				</p>
				<p mix={[m(0), mbs(1), fg("neutral"), text("lg")]}>
					Subscribe to my content using <Link href={routes.rss.feed.href()}>RSS</Link>.
				</p>

				<Heading level={2} mix={[m(0), mbs(2), text("2xl")]}>
					Activity
				</Heading>

				<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(4)]}>
					{model.activity.map((item, index) => (
						<li
							key={item.href + String(index)}
							mix={[
								grid(),
								gridTemplate({ columns: `${spacing(7)} 1fr auto` }),
								gap(3),
								items("start"),
							]}
						>
							<span
								aria-hidden="true"
								mix={[
									inlineFlex(),
									justify("center"),
									items("center"),
									is(7),
									bs(7),
									text("xl"),
									fg(item.iconTint),
								]}
							>
								{item.icon}
							</span>
							<p mix={[m(0), text("lg"), fg("neutral.emphasis")]}>
								<Link href={item.href}>{item.label}</Link>
								{item.preview && (
									<Badge color="warning" variant="secondary" mix={[mis(2)]}>
										Preview
									</Badge>
								)}
							</p>
							<time mix={[fg("neutral.muted"), text("sm"), nowrap(), mbs(1)]}>
								{formatDate(item.date)}
							</time>
						</li>
					))}
				</ol>
			</main>
		</BlogLayout>
	);
}
