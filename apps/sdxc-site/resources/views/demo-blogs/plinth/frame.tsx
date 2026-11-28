/**
 * The frame every Plinth page renders in: the blog's theme, a signal rule over a header whose
 * Index menu opens every type's feed, the page between, and a footer listing every way into
 * the archive. Built from the landing kit's header and footer.
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
import { text, tracking, weight } from "@sdxc/u/typography";
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

/** The widest a Plinth page runs, header and footer included. */
export const PAGE_MAX = "76rem";

namespace PlinthShell {
	export interface Props {
		context: DemoBlogContext;
		/**
		 * The header link the page belongs to: `index` for any feed, `archive`, `tags` or
		 * `about`; none marks nothing current.
		 */
		current?: "index" | "archive" | "tags" | "about";
		children: RemixNode;
	}
}

/** Renders the themed header, the page and the footer around it. */
export function PlinthShell(handle: Handle<PlinthShell.Props>) {
	return () => {
		let { children, context, current } = handle.props;
		let { href, site } = context;
		let items: SiteHeader.Item[] = [
			{
				label: "Index",
				columns: [
					{
						title: "By type",
						links: Object.entries(site.kinds).map(([kind, entry]) => ({
							label: entry.label,
							href: `${href()}?type=${kind}`,
							description: entry.description,
						})),
					},
				],
				footer: { label: "Everything, newest first", href: href() },
			},
			{ label: "Archive", href: href(ARCHIVE_PAGE), current: current === "archive" },
			{ label: "Topics", href: href(TAGS_PAGE), current: current === "tags" },
			{ label: "About", href: href(ABOUT_PAGE), current: current === "about" },
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
					<div
						aria-hidden="true"
						mix={[raw({ blockSize: "0.375rem", backgroundColor: "var(--ui-color-brand-500)" })]}
					/>
					<SiteHeader
						brand={<Wordmark context={context} />}
						items={items}
						cta={{ label: "Subscribe", href: href(SUBSCRIBE_PAGE) }}
						tools={<HeaderTools context={context} />}
						navLabel={`${site.name} sections`}
						menuLabel="Open the menu"
						closeLabel="Close the menu"
						collapseAt="lg"
						sheet={<DialogDismiss />}
						mix={[
							raw({
								"--ui-landing-measure": PAGE_MAX,
								borderBlockEnd: "2px solid var(--ui-neutral-fg-emphasis)",
							}),
						]}
					/>
					<main mix={[raw({ flex: "1 0 auto" })]}>{children}</main>
					<BlogFooter context={context} />
				</div>
			</DemoTheme>
		);
	};
}

/**
 * Sets headings in the blog's heavy grotesk, tight and balanced, which its tokens name; a
 * heading that sets its own face, such as a monospace year, keeps it.
 */
function headingFace() {
	return when(
		"& :where(h1, h2, h3)",
		raw({
			fontFamily: "var(--demo-blog-heading-font, inherit)",
			fontWeight: "var(--demo-blog-heading-weight, 800)",
			letterSpacing: "-0.02em",
			textWrap: "balance",
		}),
	);
}

namespace Wordmark {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The blog's mark and name, home to the feed. */
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
						fontSize: "1.375rem",
						textTransform: "uppercase",
					}),
					tracking("-0.03em"),
					fg("neutral.emphasis"),
					weight(800),
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
		let { href, site } = handle.props.context;
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
		raw({ inlineSize: "2.5rem", blockSize: "2.5rem" }),
		fg("neutral"),
		hover([fg("neutral.emphasis"), raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })]),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/** The footer: every type's feed, the ways to browse the archive, and where to follow. */
function BlogFooter(handle: Handle<Wordmark.Props>) {
	return () => {
		let { context } = handle.props;
		let { href, site, slug } = context;
		let columns: SiteFooter.Column[] = [
			{
				title: "Index",
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
					{ label: "About", href: href(ABOUT_PAGE) },
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
				mix={[
					raw({
						"--ui-landing-measure": PAGE_MAX,
						borderBlockStart: "2px solid var(--ui-neutral-fg-emphasis)",
					}),
				]}
			/>
		);
	};
}
