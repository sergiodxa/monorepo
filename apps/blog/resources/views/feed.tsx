/**
 * View for the site home/feed page. Renders the author intro, an RSS link, and
 * a chronological "Activity" timeline of posts as an `h-feed` of `h-entry` rows, each
 * an activity row with an optional preview badge. Exists as the landing page of the
 * public blog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mf } from "@sdxc/microformats/ui";
import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { m, maxIs, mbs, mis, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Badge, Heading, Link } from "@sdxc/ui";

import { ACTOR_ID } from "~/config/activitypub";
import { ActivityRow } from "~/resources/components/activity-row";
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
		/** Which emoji the row leads with; a bookmark's `href` is marked up as `u-bookmark-of`. */
		kind: ActivityRow.Kind;
	}

	/**
	 * Contains all data required to render the feed page.
	 */
	export interface Model {
		activity: Array<ActivityItem>;
	}
}

/**
 * Builds the feed page renderer used by the feed route response: the intro, the
 * subscription links, and the activity timeline as an `h-feed` of `h-entry` rows.
 */
export function FeedView() {
	return ({ model }: { model: FeedView.Model }) => (
		<BlogLayout
			title="Sergio Xalambrí"
			description="Sergio Xalambrí"
			activePath="/"
			activity={ACTOR_ID}
		>
			<main mix={[mf("h-feed"), grid(), gap(4)]}>
				<Heading level={1} mix={[mf("p-name"), m(0), text("4xl")]}>
					Sergio Xalambrí
				</Heading>
				<p mix={[m(0), fg("neutral"), maxIs("60ch"), text("lg")]}>
					Web Developer from Buenos Aires with 10+ years of experience. I work at
					<strong> Daffy</strong> and maintain several open-source libraries around React Router and
					OAuth2.
				</p>
				<p mix={[m(0), mbs(1), fg("neutral"), text("lg")]}>
					Subscribe to my content using <Link href={routes.rss.feed.href()}>RSS</Link>,{" "}
					<Link href={routes.atom.feed.href()}>Atom</Link>, or{" "}
					<Link href={routes.jsonFeed.feed.href()}>JSON Feed</Link>.
				</p>

				<Heading level={2} mix={[m(0), mbs(2), text("2xl")]}>
					Activity
				</Heading>

				<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(4)]}>
					{model.activity.map((item, index) => (
						<ActivityRow
							key={item.href + String(index)}
							kind={item.kind}
							href={item.href}
							date={item.date}
							mix={[mf("h-entry")]}
							linkMix={[mf(item.kind === "bookmark" ? "u-bookmark-of" : "u-url", "p-name")]}
							dateMix={[mf("dt-published")]}
							badge={
								item.preview ? (
									<Badge color="warning" variant="secondary" mix={[mis(2)]}>
										Preview
									</Badge>
								) : undefined
							}
						>
							{item.label}
						</ActivityRow>
					))}
				</ol>
			</main>
		</BlogLayout>
	);
}
