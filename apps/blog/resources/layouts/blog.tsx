/**
 * Layout component for public blog pages. Composes the shared document shell,
 * forwarding the page's title, description, canonical and social tags, and draws
 * the silvered body, the site's `h-card`, the main navigation bar and the search
 * dialog it opens before the page children, giving every public page one shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { mf } from "@sdxc/microformats/ui";
import { bg, fg, radialGradient } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridArea, gridTemplate, hstack, items, self } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, maxBs, maxIs, mbe, mi, minBs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { color } from "@sdxc/u/tokens";
import { font, text, textDecoration, textTransform, tracking } from "@sdxc/u/typography";
import { Modal } from "@sdxc/ui";
import { Frame } from "remix/component";

import { PROFILE } from "~/config/profile";
import { NavPill, WIDE_SCREEN } from "~/resources/components/nav-pill";
import { PillLabel } from "~/resources/components/pill-label";
import { searchFrameSrc } from "~/resources/components/search-box";
import { SEARCH_DIALOG_ID, SearchTrigger } from "~/resources/components/search-trigger";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Groups the layout props and related metadata types.
 */
export namespace BlogLayout {
	/**
	 * Describes a meta tag rendered in the document head.
	 */
	export interface MetaTag {
		property?: string;
		name?: string;
		content: string;
	}

	/**
	 * Supplies document metadata and content needed to render the public blog shell.
	 */
	export interface Props {
		title: string;
		description: string;
		/** BCP 47 tag for the page's own language, defaulting to the site's English. */
		locale?: string;
		activePath?: string;
		canonical?: string;
		/** The page's ActivityStreams representation, advertised as an `alternate` link. */
		activity?: string;
		meta?: Array<MetaTag>;
		/**
		 * Text the search dialog opens holding, with its results already rendered; the
		 * `/search` page passes its own query so the dialog continues that search.
		 */
		searchQuery?: string;
		children: RemixNode;
	}

	/**
	 * One link in the blog's main navigation bar.
	 */
	export interface NavigationItem {
		href: string;
		label: string;
	}
}

let navigationItems: Array<BlogLayout.NavigationItem> = [
	{ href: routes.feed.href(), label: "Home" },
	{ href: routes.articles.href(), label: "Articles" },
	{ href: routes.tutorials.href(), label: "Tutorials" },
	{ href: routes.bookmarks.href(), label: "Bookmarks" },
	{ href: routes.glossary.href(), label: "Glossary" },
	{ href: routes.cms.dashboard.href(), label: "Dashboard" },
];

/**
 * Fixed attachment holds the sheen's light source still while content scrolls,
 * its base color repeats the gradient's outer stop so wide viewports stay seamless,
 * and the wash spans the two neutral steps brand 600 link text clears AA against.
 *
 * @returns A renderer that wraps page content with head metadata, navigation and search.
 */
export function BlogLayout(handle: Handle<BlogLayout.Props>) {
	return () => {
		let {
			activePath,
			activity,
			canonical,
			children,
			description,
			locale,
			meta = [],
			searchQuery,
			title,
		} = handle.props;

		return (
			<DocumentLayout
				locale={locale}
				title={title}
				description={description}
				canonical={canonical}
				activity={activity}
				meta={meta}
				bodyMix={[
					m(0),
					minBs("100vh"),
					font("serif"),
					fg("neutral.emphasis"),
					bg({
						color: "neutral.bg-tint-hover",
						image: radialGradient(
							"circle at 10% 10%",
							{ color: color("neutral.tint"), position: "0" },
							{ color: color("neutral.tint"), position: "20%" },
							{ color: color("neutral.bg-tint-hover"), position: "100%" },
						),
						repeat: "no-repeat",
						size: "150vmax 150vmax",
						attachment: "fixed",
					}),
				]}
			>
				<div mix={[maxIs("85ch"), mi("auto"), pbs(8), pi(4), pbe(12)]}>
					<header
						mix={[
							mbe(8),
							grid(),
							gridTemplate({
								columns: "minmax(0, 1fr) auto",
								areas: '"name search" "nav nav"',
							}),
							items("center"),
							raw({ columnGap: "0.5rem", rowGap: "0.75rem" }),
							media(WIDE_SCREEN, gridTemplate({ areas: '"name name" "nav search"' })),
						]}
					>
						<p
							mix={[
								gridArea("name"),
								mf("h-card"),
								m(0),
								text("xs"),
								textTransform("uppercase"),
								tracking("widest"),
								fg("neutral.muted"),
							]}
						>
							<a
								href={PROFILE.canonical.origin}
								mix={[mf("p-name", "u-url", "u-uid"), fg("neutral.muted"), textDecoration("none")]}
							>
								{PROFILE.name}
							</a>
							<data mix={[mf("u-photo")]} value={PROFILE.github.avatar} />
							<data mix={[mf("p-note")]} value={PROFILE.summary} />
						</p>
						<nav aria-label="Main" mix={[gridArea("nav"), hstack({ gap: 2 }), flexWrap("wrap")]}>
							{navigationItems.map((item) => {
								let isActive = activePath === item.href;

								return (
									<NavPill key={item.href} href={item.href} active={isActive}>
										<PillLabel>{item.label}</PillLabel>
									</NavPill>
								);
							})}
						</nav>
						<SearchTrigger mix={[gridArea("search"), media(WIDE_SCREEN, self("start"))]} />
						<Modal
							id={SEARCH_DIALOG_ID}
							aria-label="Search"
							closedby="any"
							mix={[
								p(0),
								gap(0),
								is("min(40rem, 100% - 2rem)"),
								maxIs("none"),
								maxBs("calc(100dvh - 2 * min(12vh, 6rem))"),
								raw({ marginBlock: "min(12vh, 6rem) auto" }),
							]}
						>
							<Frame
								name="search"
								src={searchFrameSrc(routes.searchFrame.href(), searchQuery ?? "")}
							/>
						</Modal>
					</header>
					{children}
				</div>
			</DocumentLayout>
		);
	};
}
