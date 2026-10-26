/**
 * The footer every public blog page ends on: labeled columns of the places a reader reaches
 * once — every kind's topic to read, every topic, every feed and the Fediverse handle to
 * follow, the sponsors page, the author elsewhere — and, last and quietest, the CMS dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { borderEdge, fg } from "@sdxc/u/color";
import { listStyle, raw, userSelect } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { m, mbs, p, pbs } from "@sdxc/u/size";
import { text, textTransform, tracking } from "@sdxc/u/typography";
import { NavLink } from "@sdxc/ui";

import { KINDS, POST_KINDS } from "~/app/models/kinds";
import { ACTOR_ID } from "~/config/activitypub";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/** Types for {@link BlogFooter}'s columns. */
export namespace BlogFooter {
	/** One link in a column. */
	export interface Link {
		label: string;
		href: string;
		/** A muted line above the link naming what it is, for a label that is an identifier. */
		caption?: string;
	}

	/** One labeled column, rendered as its own navigation landmark named by `title`. */
	export interface Column {
		title: string;
		links: Array<Link>;
	}

	/** Props for one rendered column. */
	export interface ColumnProps {
		column: Column;
	}
}

/**
 * The address Fediverse software searches for and follows, read from the WebFinger resource
 * so the footer always names the account WebFinger answers for.
 */
export const FEDIVERSE_HANDLE = `@${PROFILE.canonical.resource.replace(/^acct:/, "")}`;

/**
 * The footer's tracks in reading order, each a stack of columns, so the short "Support" and
 * "Elsewhere" share one track and a wide screen holds every track on one row. "Read" lists
 * every kind's topic from the registry; any other destination is one entry in its column's `links`.
 */
export const FOOTER_TRACKS: Array<Array<BlogFooter.Column>> = [
	[
		{
			title: "Read",
			links: KINDS.map((kind) => ({
				label: POST_KINDS[kind].plural,
				href: `/${POST_KINDS[kind].topic}`,
			})),
		},
	],
	[
		{
			title: "Topics",
			links: [{ label: "All topics", href: routes.topics.href() }],
		},
		{
			title: "About",
			links: [
				{ label: "About me", href: routes.about.href() },
				{ label: "Press kit", href: routes.press.index.href() },
				{ label: "Now", href: routes.now.href() },
				{ label: "Uses", href: routes.uses.href() },
			],
		},
	],
	[
		{
			title: "Follow",
			links: [
				{ label: "RSS", href: routes.rss.feed.href() },
				{ label: "Atom", href: routes.atom.feed.href() },
				{ label: "JSON Feed", href: routes.jsonFeed.feed.href() },
				{ label: FEDIVERSE_HANDLE, href: ACTOR_ID, caption: "Fediverse" },
			],
		},
	],
	[
		{
			title: "Support",
			links: [{ label: "Sponsors", href: routes.sponsors.href() }],
		},
		{
			title: "Elsewhere",
			links: [
				{ label: "X", href: PROFILE.x.profile },
				{ label: "GitHub", href: PROFILE.github.profile },
				{ label: "sdxc.dev", href: "https://sdxc.dev" },
			],
		},
	],
];

/**
 * Renders the footer. Tracks flow into as many grid columns as the width holds, so a phone gets
 * two side by side and a wide screen gets them all on one row.
 */
export function BlogFooter(_handle: Handle) {
	return () => (
		<footer
			mix={[
				mbs(16),
				pbs(8),
				borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
				grid(),
				gap(8),
				gridTemplate({ columns: repeat("auto-fit", "minmax(min(100%, 9rem), 1fr)") }),
			]}
		>
			{FOOTER_TRACKS.map((track) => (
				<div key={track[0]?.title} mix={[vstack({ gap: 6, align: "start" })]}>
					{track.map((column) => (
						<FooterColumn key={column.title} column={column} />
					))}
				</div>
			))}
			<p mix={[m(0), raw({ gridColumn: "1 / -1" })]}>
				<NavLink href={routes.cms.dashboard.href()} mix={[text("xs")]}>
					Dashboard
				</NavLink>
			</p>
		</footer>
	);
}

/**
 * Renders one column as a navigation landmark named after its heading, so assistive
 * technology lists each column by name. A captioned link's label is an identifier, which
 * selects whole so a reader can paste it into their instance's search.
 */
function FooterColumn(handle: Handle<BlogFooter.ColumnProps>) {
	return () => {
		let { column } = handle.props;

		return (
			<nav aria-label={column.title} mix={[vstack({ gap: 3, align: "start" })]}>
				<h2
					mix={[
						m(0),
						text("xs"),
						textTransform("uppercase"),
						tracking("widest"),
						fg("neutral.muted"),
					]}
				>
					{column.title}
				</h2>
				<ul mix={[vstack({ gap: 2, align: "start" }), m(0), p(0), listStyle("none")]}>
					{column.links.map((link) => (
						<li key={link.href} mix={[vstack({ gap: 0.5, align: "start" })]}>
							{link.caption ? (
								<span mix={[text("xs"), fg("neutral.muted")]}>{link.caption}</span>
							) : null}
							<NavLink
								href={link.href}
								rel={isProfile(link.href) ? "me" : undefined}
								mix={[text("sm"), link.caption ? userSelect("all") : undefined]}
							>
								{link.label}
							</NavLink>
						</li>
					))}
				</ul>
			</nav>
		);
	};
}

/**
 * An absolute link off the canonical origin is one of the author's own profiles, marked
 * `rel="me"` because that is how IndieWeb and Mastodon verify them.
 */
function isProfile(href: string) {
	return /^https?:\/\//.test(href) && !href.startsWith(PROFILE.canonical.origin);
}
