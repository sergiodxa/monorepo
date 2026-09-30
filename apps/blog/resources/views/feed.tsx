/**
 * View for the site home/feed page. Renders the author intro, an RSS link, and
 * a chronological "Activity" timeline of posts as an `h-feed` of `h-entry` rows, each
 * with an icon, label, date, and optional preview badge. Exists as the landing page
 * of the public blog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColorValue } from "@sdxc/u";

import { formatParts, parseDate } from "@sdxc/dates";
import { mf } from "@sdxc/microformats/ui";
import { isFailure } from "@sdxc/result";
import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, inlineFlex, items, justify } from "@sdxc/u/layout";
import { bs, is, m, maxIs, mbs, mis, p } from "@sdxc/u/size";
import { spacing } from "@sdxc/u/tokens";
import { nowrap, text } from "@sdxc/u/typography";
import { Badge, Heading, Link } from "@sdxc/ui";

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
		/** Whether `href` is a saved external page, marked up as `u-bookmark-of`. */
		bookmark: boolean;
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
 * Formats an activity date for the timeline on the UTC calendar, so the day shown
 * is the same wherever the page renders; an unparseable value yields an
 * empty string so the row still renders.
 */
function formatDate(value: string) {
	let parsed = parseDate(value);
	if (isFailure(parsed)) return "";
	return formatParts(parsed.data, {
		locale: "en",
		timeZone: "UTC",
		month: "short",
		day: "2-digit",
		year: "2-digit",
	})
		.map((part) => part.value)
		.join("");
}

/**
 * The machine-readable instant for `<time datetime>`, which carries the `dt-published`
 * a microformats parser reads; `undefined` for an unparseable value, omitting it.
 */
function isoDate(value: string) {
	let parsed = parseDate(value);
	if (isFailure(parsed)) return undefined;
	return parsed.data.toISOString();
}

/**
 * Builds the feed page renderer used by the feed route response. A fixed icon
 * column keeps every row's label at the same inline offset whatever the
 * emoji's intrinsic width.
 */
export function FeedView() {
	return ({ model }: { model: FeedView.Model }) => (
		<BlogLayout title="Sergio Xalambrí" description="Sergio Xalambrí" activePath="/">
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
						<li
							key={item.href + String(index)}
							mix={[
								mf("h-entry"),
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
								<Link
									href={item.href}
									mix={[mf(item.bookmark ? "u-bookmark-of" : "u-url", "p-name")]}
								>
									{item.label}
								</Link>
								{item.preview && (
									<Badge color="warning" variant="secondary" mix={[mis(2)]}>
										Preview
									</Badge>
								)}
							</p>
							<time
								datetime={isoDate(item.date)}
								mix={[mf("dt-published"), fg("neutral.muted"), text("sm"), nowrap(), mbs(1)]}
							>
								{formatDate(item.date)}
							</time>
						</li>
					))}
				</ol>
			</main>
		</BlogLayout>
	);
}
