/**
 * The frame every Saltbox page renders in: a masthead with the title, tagline and a header
 * band of saltbox houses drawn in CSS, a nav bar, the content column beside a sidebar of
 * widgets, and a footer. The sidebar stacks under the content on narrow screens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { HouseIcon, RssIcon, SearchIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { dark, media } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
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
import { StandardSidebar } from "~/resources/views/demo-blogs/saltbox/widgets";
import routes from "~/routes/web";

/** The widest the page runs, masthead, columns and footer alike. */
export const PAGE_MAX = "68rem";

/** Where the sidebar moves beside the content instead of under it. */
export const TWO_COLUMN_QUERY = "(min-width: 60rem)";

/** The address readers reply to posts at, since the blog keeps no comment form. */
export const REPLY_EMAIL = "wren@saltbox.example";

/**
 * Three saltbox houses along the band's foot, as inset, width and height percentages. Each
 * is drawn by `clip-path`, its clapboard and windows by layered gradients.
 */
const HOUSES = [
	{ left: "4%", width: "17%", height: "70%", tone: "var(--ui-color-brand-600)" },
	{ left: "25%", width: "12%", height: "52%", tone: "var(--ui-color-brand-800)" },
	{ left: "72%", width: "20%", height: "78%", tone: "var(--ui-color-brand-700)" },
] as const;

namespace SaltboxShell {
	export interface Props {
		context: DemoBlogContext;
		/**
		 * The nav link the page belongs to, as a path under the blog: a type's feed
		 * (`?type=notes`), the archive, the about page; `""` is the home, none marks nothing.
		 */
		current?: string;
		/** The sidebar's widgets; the standard set when omitted. */
		sidebar?: RemixNode;
		children: RemixNode;
	}
}

/** Renders the themed masthead, nav bar, the two columns and the footer around a page. */
export function SaltboxShell(handle: Handle<SaltboxShell.Props>) {
	return () => {
		let { children, context, current, sidebar } = handle.props;
		let { href, site } = context;
		let items: SiteHeader.Link[] = [
			...Object.entries(site.kinds).map(([kind, entry]) => ({
				label: entry.label,
				href: `${href()}?type=${kind}`,
				current: current === `?type=${kind}`,
			})),
			{ label: "Archives", href: href(ARCHIVE_PAGE), current: current === ARCHIVE_PAGE },
			{ label: "About", href: href(ABOUT_PAGE), current: current === ABOUT_PAGE },
		];

		return (
			<DemoTheme brand={site.theme.brand} neutral={site.theme.neutral} tokens={site.theme.tokens}>
				<div
					mix={[
						vstack({ gap: 0, align: "stretch" }),
						raw({
							minBlockSize: "100dvh",
							backgroundColor: "var(--ui-bg)",
							borderBlockStart: "5px solid var(--ui-brand-bg-solid)",
						}),
						headingFace(),
					]}
				>
					<Masthead context={context} />
					<SiteHeader
						brand={<HomeLink context={context} current={current === ""} />}
						items={items}
						cta={{ label: "Subscribe", href: href(SUBSCRIBE_PAGE) }}
						tools={<NavTools context={context} />}
						navLabel={`${site.name} menu`}
						menuLabel="Open the menu"
						closeLabel="Close the menu"
						collapseAt="lg"
						sheet={<DialogDismiss />}
						mix={[
							raw({
								"--ui-landing-measure": PAGE_MAX,
								"& [data-slot=site-header-bar]": {
									borderBlock: "1px solid var(--ui-neutral-border)",
									boxShadow: "0 2px 0 var(--ui-neutral-bg-tint-hover)",
								},
							}),
						]}
					/>
					<div
						mix={[
							raw({
								flex: "1 0 auto",
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr)",
								gap: "3.5rem",
								inlineSize: "100%",
								maxInlineSize: PAGE_MAX,
								marginInline: "auto",
								padding: "2.5rem 1rem 4rem",
							}),
							media(
								TWO_COLUMN_QUERY,
								raw({ gridTemplateColumns: "minmax(0, 1fr) 17.5rem", padding: "3rem 1.5rem 5rem" }),
							),
						]}
					>
						<main id="content" mix={[raw({ minInlineSize: 0 })]}>
							{children}
						</main>
						<aside
							aria-label="Sidebar"
							data-slot="sidebar"
							mix={[
								vstack({ gap: 8, align: "stretch" }),
								raw({
									minInlineSize: 0,
									paddingBlockStart: "2.5rem",
									borderBlockStart: "1px solid var(--ui-neutral-border)",
								}),
								media(
									TWO_COLUMN_QUERY,
									raw({
										paddingBlockStart: 0,
										borderBlockStart: "none",
										paddingInlineStart: "2rem",
										borderInlineStart: "1px solid var(--ui-neutral-border)",
									}),
								),
							]}
						>
							{sidebar ?? <StandardSidebar context={context} />}
						</aside>
					</div>
					<BlogFooter context={context} />
				</div>
			</DemoTheme>
		);
	};
}

/**
 * Sets headings in the blog's interface sans, which its tokens name, so titles read as
 * signposts over the serif posts; a heading that sets its own face keeps it.
 */
function headingFace() {
	return when(
		"& :where(h1, h2, h3)",
		raw({
			fontFamily: "var(--demo-blog-heading-font, inherit)",
			fontWeight: "var(--demo-blog-heading-weight, 700)",
		}),
	);
}

namespace ContextProps {
	export interface Props {
		context: DemoBlogContext;
	}
}

/**
 * The masthead: the mark, the site title and the tagline over the header band. The title
 * is a paragraph, so each page's own title stays its one `h1`.
 */
function Masthead(handle: Handle<ContextProps.Props>) {
	return () => {
		let { site, href } = handle.props.context;
		return (
			<header
				data-slot="masthead"
				mix={[
					vstack({ gap: 5, align: "stretch" }),
					raw({
						inlineSize: "100%",
						maxInlineSize: PAGE_MAX,
						marginInline: "auto",
						padding: "1.75rem 1rem 1.5rem",
					}),
					media("(min-width: 48rem)", raw({ padding: "2.75rem 1.5rem 1.75rem" })),
				]}
			>
				<div mix={[hstack({ gap: 3, align: "center" })]}>
					<span
						mix={[
							raw({
								display: "inline-flex",
								"& svg": { inlineSize: "2.75rem", blockSize: "2.75rem" },
							}),
						]}
					>
						{site.mark()}
					</span>
					<div mix={[vstack({ gap: 1, align: "start" })]}>
						<p
							mix={[
								m(0),
								leading("tight"),
								raw({
									fontFamily: "var(--demo-blog-heading-font)",
									fontSize: "clamp(2rem, 1.5rem + 2vw, 2.875rem)",
									letterSpacing: "-0.03em",
								}),
								weight("extrabold"),
							]}
						>
							<a
								href={href()}
								mix={[
									fg("neutral.emphasis"),
									raw({ textDecoration: "none" }),
									hover(fg("brand")),
									focusVisible(
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "3px" }),
									),
								]}
							>
								{site.name}
							</a>
						</p>
						<p
							mix={[
								m(0),
								fg("neutral.muted"),
								raw({
									fontFamily: "var(--demo-blog-reading-font)",
									fontStyle: "italic",
									fontSize: "1.0625rem",
								}),
							]}
						>
							{site.tagline}
						</p>
					</div>
				</div>
				<HeaderBand />
			</header>
		);
	};
}

/**
 * The header band: a low sun over a row of saltbox houses with clapboard siding, painted
 * in gradients so it themes with the palette and costs no image request.
 */
function HeaderBand() {
	return () => (
		<div
			aria-hidden="true"
			data-slot="header-band"
			mix={[
				raw({
					position: "relative",
					overflow: "hidden",
					blockSize: "clamp(5.5rem, 3rem + 10vw, 10.5rem)",
					borderRadius: "var(--ui-radius-lg)",
					backgroundImage: [
						"radial-gradient(circle at 58% 38%, var(--ui-color-brand-200) 0 2.4rem, transparent 2.5rem)",
						"linear-gradient(180deg, var(--ui-color-brand-50), var(--ui-color-brand-100) 70%, var(--ui-color-brand-200))",
					].join(", "),
					boxShadow: "inset 0 -6px 0 var(--ui-color-brand-900)",
				}),
				dark(
					raw({
						backgroundImage: [
							"radial-gradient(circle at 58% 38%, var(--ui-color-brand-100) 0 2.4rem, transparent 2.5rem)",
							"linear-gradient(180deg, var(--ui-color-neutral-950), var(--ui-color-brand-950) 80%)",
						].join(", "),
						boxShadow: "inset 0 -6px 0 var(--ui-color-neutral-900)",
					}),
				),
			]}
		>
			{HOUSES.map((house) => (
				<span
					key={house.left}
					mix={[
						raw({
							position: "absolute",
							insetBlockEnd: "6px",
							insetInlineStart: house.left,
							inlineSize: house.width,
							blockSize: house.height,
							clipPath: "polygon(0 100%, 0 40%, 30% 0, 100% 64%, 100% 100%)",
							backgroundColor: house.tone,
							backgroundImage: [
								"linear-gradient(var(--ui-color-brand-100), var(--ui-color-brand-100))",
								"linear-gradient(var(--ui-color-brand-100), var(--ui-color-brand-100))",
								"repeating-linear-gradient(180deg, transparent 0 7px, rgb(0 0 0 / 0.18) 7px 8px)",
							].join(", "),
							backgroundSize: "13% 18%, 13% 18%, 100% 100%",
							backgroundPosition: "18% 66%, 54% 78%, 0 0",
							backgroundRepeat: "no-repeat",
						}),
					]}
				/>
			))}
		</div>
	);
}

namespace HomeLink {
	export interface Props extends ContextProps.Props {
		current: boolean;
	}
}

/** The nav bar's first item, home to the feed, in the brand slot the bar keeps on phones. */
function HomeLink(handle: Handle<HomeLink.Props>) {
	return () => {
		let { context, current } = handle.props;
		return (
			<a
				href={context.href()}
				aria-current={current ? "page" : undefined}
				mix={[
					hstack({ gap: 2, align: "center" }),
					text("sm"),
					weight("semibold"),
					fg("neutral.emphasis"),
					raw({ textDecoration: "none" }),
					hover(fg("brand")),
				]}
			>
				<HouseIcon size={16} aria-hidden="true" />
				<span>Home</span>
			</a>
		);
	};
}

/** Search and the feed, as icon links beside the sign-up. */
function NavTools(handle: Handle<ContextProps.Props>) {
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
		raw({ inlineSize: "2.5rem", blockSize: "2.5rem", borderRadius: "var(--ui-radius-md)" }),
		fg("neutral"),
		hover([fg("brand"), raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })]),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/** The footer: every kind's feed, the ways into the archive, and where to follow. */
function BlogFooter(handle: Handle<ContextProps.Props>) {
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
				title: "Browse",
				links: [
					{ label: "Archives", href: href(ARCHIVE_PAGE) },
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
				brand={
					<span mix={[hstack({ gap: 2, align: "center" }), weight("bold"), fg("neutral.emphasis")]}>
						{site.mark()}
						<span>{site.name}</span>
					</span>
				}
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
						backgroundColor: "var(--ui-neutral-bg-tint-hover)",
					}),
				]}
			/>
		);
	};
}
