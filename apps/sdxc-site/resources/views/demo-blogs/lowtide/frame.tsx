/**
 * The frame every demo blog page renders in: the blog's own theme, a header naming the
 * feed's types, search and the sign-up, the page between, and a footer that lists every way
 * into the archive. Built from the landing kit's header and footer.
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

import type { DemoBlogSite } from "~/resources/views/demo-blogs";

import DemoTheme from "~/resources/components/demo-theme";
import {
	ABOUT_PAGE,
	ARCHIVE_PAGE,
	demoBlogHref,
	FEED_PAGE,
	SEARCH_PAGE,
	SUBSCRIBE_PAGE,
	TAGS_PAGE,
} from "~/resources/views/demo-blogs";
import routes from "~/routes/web";

/** The widest a blog page's content runs, header and footer included. */
export const PAGE_MAX = "72rem";

namespace DemoBlogShell {
	export interface Props {
		site: DemoBlogSite;
		slug: string;
		/**
		 * The header link the page belongs to, as a path under the blog: a type's feed
		 * (`?type=notes`), the archive, the about page; none marks nothing current.
		 */
		current?: string;
		children: RemixNode;
	}
}

/** Renders the themed header, the page and the footer around it. */
export function DemoBlogShell(handle: Handle<DemoBlogShell.Props>) {
	return () => {
		let { children, current, site, slug } = handle.props;
		let href = demoBlogHref(slug);
		let items: SiteHeader.Link[] = [
			...Object.entries(site.kinds).map(([kind, entry]) => ({
				label: entry.label,
				href: `${href()}?type=${kind}`,
				current: current === `?type=${kind}`,
			})),
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
						brand={<Wordmark site={site} slug={slug} />}
						items={items}
						cta={{ label: "Subscribe", href: href(SUBSCRIBE_PAGE) }}
						tools={<HeaderTools site={site} slug={slug} />}
						navLabel={`${site.name} sections`}
						menuLabel="Open the menu"
						closeLabel="Close the menu"
						collapseAt="lg"
						sheet={<DialogDismiss />}
						mix={[raw({ "--ui-landing-measure": PAGE_MAX })]}
					/>
					<div mix={[raw({ flex: "1 0 auto" })]}>{children}</div>
					<BlogFooter site={site} slug={slug} />
				</div>
			</DemoTheme>
		);
	};
}

/**
 * Sets headings in the blog's display face, which its tokens name, so a blog can pair a
 * serif title with any body; a heading that sets its own face, such as a code term, keeps it.
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
		site: DemoBlogSite;
		slug: string;
	}
}

/** The blog's mark and name, home to the feed. */
function Wordmark(handle: Handle<Wordmark.Props>) {
	return () => {
		let { site, slug } = handle.props;
		return (
			<a
				href={demoBlogHref(slug)()}
				mix={[
					hstack({ gap: 2, align: "center" }),
					raw({
						textDecoration: "none",
						fontFamily: "var(--demo-blog-heading-font, inherit)",
						fontSize: "1.25rem",
						letterSpacing: "-0.01em",
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

/** Search and the feed, as icon links beside the sign-up. */
function HeaderTools(handle: Handle<Wordmark.Props>) {
	return () => {
		let { site, slug } = handle.props;
		let href = demoBlogHref(slug);
		return (
			<div mix={[hstack({ gap: 1, align: "center" })]}>
				<a href={href(SEARCH_PAGE)} aria-label={`Search ${site.name}`} mix={[iconLink()]}>
					<SearchIcon size={18} aria-hidden="true" />
				</a>
				<a href={href(FEED_PAGE)} aria-label="RSS feed" mix={[iconLink()]}>
					<RssIcon size={18} aria-hidden="true" />
				</a>
			</div>
		);
	};
}

/** A square, thumb-sized link around one icon. */
function iconLink() {
	return [
		hstack({ align: "center", justify: "center" }),
		raw({ inlineSize: "2.5rem", blockSize: "2.5rem", borderRadius: "var(--ui-radius-md, 0.5rem)" }),
		fg("neutral"),
		hover([fg("neutral.emphasis"), raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })]),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/** The footer: every type's feed, the ways to browse the archive, and where to follow. */
function BlogFooter(handle: Handle<Wordmark.Props>) {
	return () => {
		let { site, slug } = handle.props;
		let href = demoBlogHref(slug);
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
				title: "Browse",
				links: [
					{ label: "Archive", href: href(ARCHIVE_PAGE) },
					{ label: "Topics", href: href(TAGS_PAGE) },
					{ label: "Search", href: href(SEARCH_PAGE) },
				],
			},
			{
				title: "Follow",
				links: [
					{ label: "Newsletter", href: href(SUBSCRIBE_PAGE) },
					{ label: "RSS feed", href: href(FEED_PAGE) },
					...site.author.links,
				],
			},
		];

		return (
			<SiteFooter
				brand={<Wordmark site={site} slug={slug} />}
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
