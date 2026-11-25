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
import type { DocumentLayout as DocumentShell } from "~/resources/layouts/document";
import type { FooterColumn } from "~/resources/views/app-pages/footer";

import { APP_STORE, MALFOID_THEME_COLORS } from "~/config/malfoid";
import { PROFILE } from "~/config/profile";
import DocumentLayout from "~/resources/layouts/document";
import { AppFooter } from "~/resources/views/app-pages/footer";
import { MALFOID_ASSETS, MalfoidHeader, Wordmark } from "~/resources/views/malfoid/parts";
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
 * @param listing The App Store listing the banner names, the configured one by default.
 * @returns The meta tags, in the order the document writes them.
 */
export function malfoidMeta(
	title: string,
	description: string,
	url: string,
	listing: AppStoreListing = APP_STORE,
): Array<DocumentShell.MetaTag> {
	let image = new URL(`${MALFOID_ASSETS}/branding/social-card.png`, PROFILE.canonical.origin).href;
	let tags: Array<DocumentShell.MetaTag> = [
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "Malfoid Stickers" },
		{ property: "og:locale", content: "en_US" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ property: "og:image", content: image },
		{
			property: "og:image:alt",
			content:
				"Malfoid Stickers, Cute & Sassy Reactions: three stickers of Malfoid smiling smugly, crying dramatically and hugging a pink heart.",
		},
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

/** The footer's columns: the pack's own pages, the author's other apps, and where to find him. */
const FOOTER_COLUMNS: Array<FooterColumn> = [
	{
		title: "Malfoid Stickers",
		links: [
			{ href: `${routes.malfoid.landing.href()}#download`, label: "Download" },
			{ href: routes.malfoid.support.index.href(), label: "Support" },
			{ href: routes.malfoid.privacy.href(), label: "Privacy" },
		],
	},
	{
		title: "More from Sergio",
		links: [
			{ href: routes.feed.href(), label: "Blog" },
			{ href: routes.apps.href(), label: "Apps" },
			{ href: routes.wakaba.landing.href(), label: "Wakaba" },
			{ href: routes.encore.landing.href(), label: "Encore" },
		],
	},
	{
		title: "Elsewhere",
		links: [
			{ href: PROFILE.github.profile, label: "GitHub" },
			{ href: PROFILE.x.profile, label: "X" },
			{ href: PROFILE.youtube.profile, label: "YouTube" },
		],
	},
];

/**
 * The page, in the pack's scope: the silver-mint or charcoal ground from edge to edge, a header
 * naming the pack and a footer with its policies, around the page's `main`.
 *
 * @param handle Runtime handle carrying the page's metadata, assets and content.
 * @returns The render function producing the whole document.
 */
export function MalfoidLayout(handle: Handle<MalfoidLayout.Props>) {
	return () => {
		let { assets, children, description, path, title } = handle.props;
		let canonical = new URL(path, PROFILE.canonical.origin).href;

		return (
			<DocumentLayout
				assets={assets}
				scope="malfoid"
				title={title}
				description={description}
				canonical={canonical}
				icons={ICONS}
				themeColors={MALFOID_THEME_COLORS}
				meta={malfoidMeta(title, description, canonical)}
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
				<MalfoidHeader />
				<div mix={[grow(1), vstack({ gap: 0, align: "stretch" })]}>{children}</div>
				<AppFooter
					brand={<Wordmark />}
					tagline="Cute & sassy reactions for iMessage. Free, with no ads and no data collection."
					columns={FOOTER_COLUMNS}
					madeBy="Made by"
				/>
			</DocumentLayout>
		);
	};
}
