/**
 * The shell of Malfoid Stickers' pages on sergiodxa.com: the document in the pack's own scope,
 * with its icons, social card and the App Store banner once the pack is listed, under a header
 * and footer of its own. The pages share the domain with the blog and none of its chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grow, vstack } from "@sdxc/u/layout";
import { m, minBs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font } from "@sdxc/u/typography";

import type { AppStoreListing } from "~/config/malfoid";
import type { LandingCopy } from "~/resources/content/malfoid/landing";
import type { DocumentLayout as DocumentShell } from "~/resources/layouts/document";
import type { FooterColumn } from "~/resources/views/app-pages/footer";

import { APP_STORE, MALFOID_THEME_COLORS } from "~/config/malfoid";
import { PROFILE } from "~/config/profile";
import { LANDING_COPY } from "~/resources/content/malfoid/landing";
import DocumentLayout from "~/resources/layouts/document";
import { AppFooter } from "~/resources/views/app-pages/footer";
import {
	inLocale,
	landingHref,
	MALFOID_ASSETS,
	MalfoidHeader,
	Wordmark,
} from "~/resources/views/malfoid/parts";
import routes from "~/routes/web";

/** Types used by the pack's page shell. */
export namespace MalfoidLayout {
	export interface Props {
		title: string;
		description: string;
		/** The page's path, which its canonical URL and `og:url` are built from. */
		path: string;
		children: RemixNode;
		/** The request's document assets, which the renderer hands every view. */
		assets: DocumentAssets;
		/** The page's words, which also set its language. English by default. */
		copy?: LandingCopy;
		/**
		 * Whether the page is written in every language the copy has: it then advertises each to
		 * search engines at its `?lang=`.
		 */
		bilingual?: boolean;
	}
}

/**
 * The tags that describe a page off the site: Open Graph and Twitter with the social card of
 * three real stickers, and the Safari smart banner, which names the App Store listing and so
 * appears only once the pack has one.
 *
 * @param title The page's title.
 * @param description The page's description.
 * @param url The page's canonical URL.
 * @param copy The page's words, for the card's alt text and the page's locale.
 * @param listing The App Store listing the banner names, the configured one by default.
 * @returns The meta tags, in the order the document writes them.
 */
export function malfoidMeta(
	title: string,
	description: string,
	url: string,
	copy: LandingCopy = LANDING_COPY.en,
	listing: AppStoreListing = APP_STORE,
): Array<DocumentShell.MetaTag> {
	let image = new URL(`${MALFOID_ASSETS}/branding/social-card.png`, PROFILE.canonical.origin).href;
	let tags: Array<DocumentShell.MetaTag> = [
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "Malfoid Stickers" },
		{ property: "og:locale", content: copy.locale === "en" ? "en_US" : "es_AR" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ property: "og:image", content: image },
		{ property: "og:image:alt", content: copy.meta.socialCardAlt },
		{ property: "og:image:width", content: "1200" },
		{ property: "og:image:height", content: "630" },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: image },
	];
	if (listing.id) tags.push({ name: "apple-itunes-app", content: `app-id=${listing.id}` });
	return tags;
}

/** The icons every page names: Malfoid's face on an emerald disc, and on ivory for iOS. */
const ICONS: Array<DocumentShell.IconLink> = [
	{ rel: "icon", href: `${MALFOID_ASSETS}/branding/favicon.png`, type: "image/png" },
	{
		rel: "apple-touch-icon",
		href: `${MALFOID_ASSETS}/branding/apple-touch-icon.png`,
		sizes: "180x180",
	},
];

/**
 * The footer's columns in the page's language: the pack's own pages, the author's other apps,
 * and where to find him.
 */
function footerColumns(copy: LandingCopy): Array<FooterColumn> {
	return [
		{
			title: "Malfoid Stickers",
			links: [
				{ href: `${landingHref(copy.locale)}#download`, label: copy.chrome.download },
				{
					href: inLocale(routes.malfoid.support.index.href(), copy.locale),
					label: copy.chrome.support,
				},
				{ href: inLocale(routes.malfoid.privacy.href(), copy.locale), label: copy.chrome.privacy },
			],
		},
		{
			title: copy.chrome.moreFrom,
			links: [
				{ href: routes.feed.href(), label: copy.chrome.blog },
				{ href: routes.apps.href(), label: "Apps" },
				{ href: routes.wakaba.landing.href(), label: "Wakaba" },
				{ href: routes.encore.landing.href(), label: "Encore" },
			],
		},
		{
			title: copy.chrome.elsewhere,
			links: [
				{ href: PROFILE.github.profile, label: "GitHub" },
				{ href: PROFILE.x.profile, label: "X" },
				{ href: PROFILE.youtube.profile, label: "YouTube" },
			],
		},
	];
}

/**
 * The page, in the pack's scope: the silver-mint or charcoal ground from edge to edge, a header
 * naming the pack and a footer with its policies, around the page's `main`.
 *
 * @param handle Runtime handle carrying the page's metadata, assets and content.
 * @returns The render function producing the whole document.
 */
export function MalfoidLayout(handle: Handle<MalfoidLayout.Props>) {
	return () => {
		let { assets, bilingual, children, description, path, title } = handle.props;
		let copy = handle.props.copy ?? LANDING_COPY.en;
		let origin = PROFILE.canonical.origin;
		let canonical = new URL(
			bilingual && copy.locale !== "en" ? `${path}?lang=${copy.locale}` : path,
			origin,
		).href;
		let alternates = bilingual
			? [
					{ hreflang: "en", href: new URL(`${path}?lang=en`, origin).href },
					{ hreflang: "es", href: new URL(`${path}?lang=es-AR`, origin).href },
					{ hreflang: "x-default", href: new URL(path, origin).href },
				]
			: [];

		return (
			<DocumentLayout
				assets={assets}
				scope="malfoid"
				locale={copy.locale}
				title={title}
				description={description}
				canonical={canonical}
				icons={ICONS}
				alternates={alternates}
				themeColors={MALFOID_THEME_COLORS}
				meta={malfoidMeta(title, description, canonical, copy)}
				bodyMix={[
					m(0),
					minBs("100dvh"),
					vstack({ gap: 0, align: "stretch" }),
					font("sans"),
					bg(),
					fg("neutral.emphasis"),
					raw({ overflowX: "clip" }),
					when("& [id]", raw({ scrollMarginBlockStart: "1.5rem" })),
				]}
			>
				<MalfoidHeader copy={copy} />
				<div mix={[grow(1), vstack({ gap: 0, align: "stretch" })]}>{children}</div>
				<AppFooter
					brand={<Wordmark copy={copy} />}
					tagline={copy.chrome.tagline}
					columns={footerColumns(copy)}
					madeBy={copy.chrome.madeBy}
				/>
			</DocumentLayout>
		);
	};
}
