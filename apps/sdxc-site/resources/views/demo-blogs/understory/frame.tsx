/**
 * The frame every Understory page renders in: the blog's theme, a floating header whose
 * "Read" panel offers each kind of post with what it holds, the page between, and a footer
 * listing every way into the garden. Built from the landing kit's header and footer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { RssIcon, SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { DialogDismiss } from "@sdxc/ui";
import { SiteFooter, SiteHeader } from "@sdxc/ui/landing";

import type { DemoBlogContext } from "~/resources/views/demo-blogs";

import DemoTheme from "~/resources/components/demo-theme";
import {
	ABOUT_PAGE,
	ARCHIVE_PAGE,
	FEED_PAGE,
	SEARCH_PAGE,
	SUBSCRIBE_PAGE,
	TAGS_PAGE,
} from "~/resources/views/demo-blogs";
import routes from "~/routes/web";

/** The widest an Understory page's content runs, header and footer included. */
export const PAGE_MAX = "76rem";

/** The first part of the blog's one series, which the header and the footer point newcomers to. */
const SERIES_START = "tutorials/sync-from-scratch-change-log";

/** The essay the header's "Start here" column leads with. */
const START_ESSAY = "articles/the-server-is-a-peer";

namespace UnderstoryShell {
	export interface Props {
		context: DemoBlogContext;
		/**
		 * The header entry the page belongs to, as a path under the blog: a type's feed
		 * (`?type=notes`), `tags`, `archive` or `about`; none marks nothing current.
		 */
		current?: string;
		children: RemixNode;
	}
}

/** Renders the themed header, the page and the footer around it. */
export function UnderstoryShell(handle: Handle<UnderstoryShell.Props>) {
	return () => {
		let { children, context, current } = handle.props;
		let { href, site } = context;
		let items: SiteHeader.Item[] = [
			{
				label: "Read",
				columns: [
					{
						title: "By type",
						links: Object.entries(site.kinds).map(([kind, entry]) => ({
							label: entry.label,
							href: `${href()}?type=${kind}`,
							description: entry.description,
							current: current === `?type=${kind}`,
						})),
					},
					{
						title: "Start here",
						links: [
							{
								label: "The server is just another peer",
								href: href(START_ESSAY),
								description: "The essay the rest of the garden grows from.",
							},
							{
								label: "Sync from scratch",
								href: href(SERIES_START),
								description: "A three-part tutorial: a log, a clock and a merge.",
							},
						],
					},
				],
				footer: { label: "Everything, newest first", href: href() },
			},
			{ label: "Topics", href: href(TAGS_PAGE), current: current === TAGS_PAGE },
			{ label: "Archive", href: href(ARCHIVE_PAGE), current: current === ARCHIVE_PAGE },
			{ label: "About", href: href(ABOUT_PAGE), current: current === ABOUT_PAGE },
		];

		return (
			<DemoTheme brand={site.theme.brand} neutral={site.theme.neutral} tokens={site.theme.tokens}>
				<div
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						raw({ minBlockSize: "100dvh", backgroundColor: "var(--ui-bg)" }),
						headingFace(),
					]}
				>
					<SiteHeader
						brand={<Wordmark context={context} />}
						items={items}
						cta={{ label: "Subscribe", href: href(SUBSCRIBE_PAGE) }}
						tools={<HeaderTools context={context} />}
						variant="floating"
						navLabel={`${site.name} sections`}
						menuLabel="Open the menu"
						closeLabel="Close the menu"
						collapseAt="lg"
						sheet={<DialogDismiss />}
						mix={[raw({ "--ui-landing-measure": PAGE_MAX })]}
					/>
					<div mix={[raw({ flex: "1 0 auto" })]}>{children}</div>
					<GardenFooter context={context} />
				</div>
			</DemoTheme>
		);
	};
}

/**
 * Sets headings in the blog's serif, which its tokens name; a heading that sets its own face,
 * such as a code term, keeps it.
 */
function headingFace() {
	return when(
		"& :where(h1, h2, h3)",
		raw({
			fontFamily: "var(--demo-blog-heading-font, inherit)",
			fontWeight: "var(--demo-blog-heading-weight, 600)",
		}),
	);
}

namespace Wordmark {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The fern mark and the blog's name in its serif, home to the feed. */
function Wordmark(handle: Handle<Wordmark.Props>) {
	return () => {
		let { href, site } = handle.props.context;
		return (
			<a
				href={href()}
				mix={[
					hstack({ gap: 2, align: "center" }),
					raw({
						textDecoration: "none",
						fontFamily: "var(--demo-blog-heading-font, inherit)",
						fontSize: "1.3rem",
						letterSpacing: "0.005em",
					}),
					fg("neutral.emphasis"),
					weight("semibold"),
				]}
			>
				{site.mark()}
				<span>{site.name}</span>
			</a>
		);
	};
}

/** Search and the RSS feed, as round icon links beside the sign-up. */
function HeaderTools(handle: Handle<Wordmark.Props>) {
	return () => {
		let { href, site } = handle.props.context;
		return (
			<div mix={[hstack({ gap: 1, align: "center" })]}>
				<a href={href(SEARCH_PAGE)} aria-label={`Search ${site.name}`} mix={[iconLink()]}>
					<SearchIcon size={18} aria-hidden="true" />
				</a>
				<a
					href={href(FEED_PAGE)}
					aria-label="RSS feed"
					mix={[iconLink(), media("(max-width: 29.99rem)", raw({ display: "none" }))]}
				>
					<RssIcon size={18} aria-hidden="true" />
				</a>
			</div>
		);
	};
}

/** A round, thumb-sized link around one icon. */
function iconLink() {
	return [
		hstack({ align: "center", justify: "center" }),
		raw({ inlineSize: "2.5rem", blockSize: "2.5rem", borderRadius: "999px" }),
		fg("neutral"),
		hover([fg("neutral.emphasis"), raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })]),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/** The footer: every type's feed, the ways to browse, and where to follow. */
function GardenFooter(handle: Handle<Wordmark.Props>) {
	return () => {
		let { context } = handle.props;
		let { href, site, slug } = context;
		let columns: SiteFooter.Column[] = [
			{
				title: "Read",
				links: [
					{ label: "Everything", href: href() },
					...Object.entries(site.kinds).map(([kind, entry]) => ({
						label: entry.label,
						href: `${href()}?type=${kind}`,
					})),
				],
			},
			{
				title: "Wander",
				links: [
					{ label: "Start here", href: href(START_ESSAY) },
					{ label: "Sync from scratch", href: href(SERIES_START) },
					{ label: "Topics", href: href(TAGS_PAGE) },
					{ label: "Archive", href: href(ARCHIVE_PAGE) },
					{ label: "Search", href: href(SEARCH_PAGE) },
				],
			},
			{
				title: "Follow",
				links: [
					{ label: "Newsletter", href: href(SUBSCRIBE_PAGE) },
					{ label: "RSS feed", href: href(FEED_PAGE) },
					{ label: "About", href: href(ABOUT_PAGE) },
					...site.author.links,
				],
			},
		];

		return (
			<SiteFooter
				brand={<Wordmark context={context} />}
				tagline={site.tagline}
				columns={columns}
				legal={
					<span mix={[text("sm"), fg("neutral.muted")]}>
						© 2026 {site.author.name}. An invented blog,{" "}
						<a
							href={routes.showcase.show.href({ slug })}
							mix={[fg("inherit"), media("(hover: hover)", hover(fg("neutral.emphasis")))]}
						>
							a demo built with @sdxc/ui
						</a>
						.
					</span>
				}
				ruled
				mix={[raw({ "--ui-landing-measure": PAGE_MAX })]}
			/>
		);
	};
}
