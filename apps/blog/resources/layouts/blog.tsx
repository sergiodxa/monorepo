/**
 * Layout component for public blog pages. Composes the shared document shell,
 * forwarding the page's title, description, canonical and social tags, and draws
 * the silvered body, the site's `h-card`, the main navigation bar and the search
 * dialog before the page children, and the footer after them: every public page's shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { mf } from "@sdxc/microformats/ui";
import { bg, fg, radialGradient } from "@sdxc/u/color";
import { rounded, transition, transitionBehavior } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridArea, gridTemplate, hstack, items, self } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { light, media } from "@sdxc/u/responsive";
import { is, m, maxBs, maxIs, mbe, mi, minBs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { color } from "@sdxc/u/tokens";
import { font, text, textDecoration, textTransform, tracking } from "@sdxc/u/typography";
import { Dialog } from "@sdxc/ui";
import { Frame } from "remix/component";

import type { SocialCard } from "~/app/services/social-card";

import { KINDS, POST_KINDS } from "~/app/models/kinds";
import { SOCIAL_CARD_SIZE, socialCardUrl } from "~/app/services/social-card";
import { PROFILE } from "~/config/profile";
import { BlogFooter } from "~/resources/components/blog-footer";
import { NavPill, WIDE_SCREEN } from "~/resources/components/nav-pill";
import { PillLabel } from "~/resources/components/pill-label";
import { searchFrameSrc } from "~/resources/components/search-box";
import { SearchQuickLinks } from "~/resources/components/search-quick-links";
import { SEARCH_EXIT_MS } from "~/resources/components/search-surface";
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
		/**
		 * Marks a page inside `activePath`'s section rather than the section's own page, so
		 * the search dialog keeps offering the section among its quick links.
		 */
		insideSection?: boolean;
		canonical?: string;
		/** The page's ActivityStreams representation, advertised as an `alternate` link. */
		activity?: string;
		meta?: Array<MetaTag>;
		/**
		 * The page's social card. With it the page advertises a large image card, replacing
		 * any `twitter:card` in `meta`, so every platform shows the drawn card.
		 */
		card?: SocialCard.Reference;
		/**
		 * Text the search dialog opens holding, with its results already rendered; the
		 * `/search` page passes its own query so the dialog continues that search.
		 */
		searchQuery?: string;
		children: RemixNode;
		/** The request's document assets, which the renderer hands every view. */
		assets: DocumentAssets;
	}

	/**
	 * One link in the blog's main navigation bar.
	 */
	export interface NavigationItem {
		href: string;
		label: string;
	}
}

/** Home, then every kind's topic page in registry order, so a new kind joins the bar. */
const NAVIGATION_ITEMS: Array<BlogLayout.NavigationItem> = [
	{ href: routes.feed.href(), label: "Home" },
	...KINDS.map((kind) => ({ href: `/${POST_KINDS[kind].topic}`, label: POST_KINDS[kind].plural })),
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
			assets,
			canonical,
			card,
			children,
			description,
			insideSection,
			locale,
			meta = [],
			searchQuery,
			title,
		} = handle.props;

		return (
			<DocumentLayout
				assets={assets}
				locale={locale}
				title={title}
				description={description}
				canonical={canonical}
				activity={activity}
				meta={card ? withCard(meta, card, title) : meta}
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
							{NAVIGATION_ITEMS.map((item) => {
								let isActive = activePath === item.href;

								return (
									<NavPill key={item.href} href={item.href} active={isActive}>
										<PillLabel>{item.label}</PillLabel>
									</NavPill>
								);
							})}
						</nav>
						<SearchTrigger mix={[gridArea("search"), media(WIDE_SCREEN, self("start"))]} />
						<Dialog
							id={SEARCH_DIALOG_ID}
							aria-label="Search"
							closedby="any"
							mix={[
								p(0),
								gap(2),
								bg("transparent"),
								rounded("none"),
								overflow("visible"),
								raw({ boxShadow: "none" }),
								transitionBehavior("allow-discrete"),
								transition("display, overlay", { duration: SEARCH_EXIT_MS }),
								light(when("&::backdrop", bg("rgb(0 0 0 / 0.12)"))),
								is("min(40rem, 100% - 2rem)"),
								maxIs("none"),
								maxBs("calc(100dvh - min(12vh, 6rem) - 1rem)"),
								raw({ marginBlock: "min(12vh, 6rem) auto" }),
							]}
						>
							<Frame
								name="search"
								src={searchFrameSrc(routes.searchFrame.href(), searchQuery ?? "")}
							/>
							<SearchQuickLinks currentPath={insideSection ? undefined : activePath} />
						</Dialog>
					</header>
					{children}
					<BlogFooter />
				</div>
			</DocumentLayout>
		);
	};
}

/**
 * The page's meta tags with its social card advertised: the image, its alt text and size,
 * and a large-image Twitter card in place of whatever card type the page set.
 */
function withCard(
	meta: Array<BlogLayout.MetaTag>,
	card: SocialCard.Reference,
	title: string,
): Array<BlogLayout.MetaTag> {
	let image = socialCardUrl(card);
	return [
		...meta.filter((tag) => (tag.property ?? tag.name) !== "twitter:card"),
		{ property: "og:image", content: image },
		{ property: "og:image:alt", content: title },
		{ property: "og:image:width", content: String(SOCIAL_CARD_SIZE.width) },
		{ property: "og:image:height", content: String(SOCIAL_CARD_SIZE.height) },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:image", content: image },
	];
}
