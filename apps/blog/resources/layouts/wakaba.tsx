/**
 * The shell of Wakaba's pages on sergiodxa.com: the document in Wakaba's own scope, with its
 * icons, social card and the App Store banner once the app is listed, under a header and
 * footer of its own. The pages share the domain with the blog and none of its chrome.
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

import type { AppStoreListing } from "~/config/wakaba";
import type { WakabaCopy } from "~/resources/content/wakaba/copy";
import type { DocumentLayout as DocumentShell } from "~/resources/layouts/document";
import type { FooterColumn, NavLink as ChromeLink } from "~/resources/views/app-pages/footer";

import { PROFILE } from "~/config/profile";
import { APP_STORE, WAKABA_THEME_COLORS } from "~/config/wakaba";
import { EN } from "~/resources/content/wakaba/en";
import { inLanguage } from "~/resources/content/wakaba/pages";
import DocumentLayout from "~/resources/layouts/document";
import { AppFooter } from "~/resources/views/app-pages/footer";
import { WakabaHeader, Wordmark } from "~/resources/views/wakaba/chrome";
import { copyOf, WAKABA_ASSETS, WakabaLanguage } from "~/resources/views/wakaba/parts";
import routes from "~/routes/web";

/** Types used by Wakaba's page shell. */
export namespace WakabaLayout {
	export interface Props {
		title: string;
		description: string;
		/** The page's path, which its canonical URL and `og:url` are built from. */
		path: string;
		/** The page's words, which also set its language. English by default. */
		copy?: WakabaCopy;
		/**
		 * Whether the page is written in both languages: it then advertises both to search
		 * engines, each at `?lang=`.
		 */
		bilingual?: boolean;
		children: RemixNode;
		/** The request's document assets, which the renderer hands every view. */
		assets: DocumentAssets;
	}

	/** One link in the header or the footer. */
	export type NavLink = ChromeLink;
}

/**
 * The tags that describe a Wakaba page off the site: Open Graph and Twitter with the social
 * card drawn from the logo and the grown bonsai, and the Safari smart banner, which names the
 * App Store listing and so appears only once the app has one.
 *
 * @param title The page's title.
 * @param description The page's description.
 * @param url The page's canonical URL.
 * @param copy The page's words, for its social card, the card's alt text and its locale.
 * @param listing The App Store listing the banner names, the configured one by default.
 * @returns The meta tags, in the order the document writes them.
 */
export function wakabaMeta(
	title: string,
	description: string,
	url: string,
	copy: WakabaCopy = EN,
	listing: AppStoreListing = APP_STORE,
): Array<DocumentShell.MetaTag> {
	let image = new URL(`${WAKABA_ASSETS}/${copy.meta.socialCard}`, PROFILE.canonical.origin).href;
	let tags: Array<DocumentShell.MetaTag> = [
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "Wakaba" },
		{ property: "og:locale", content: copy.locale === "en" ? "en_US" : "es_AR" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ property: "og:image", content: image },
		{
			property: "og:image:alt",
			content: copy.meta.socialCardAlt,
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

/** The icons every Wakaba page names: the 学 mark in either scheme, and the app icon. */
const ICONS: Array<DocumentShell.IconLink> = [
	{ rel: "icon", href: `${WAKABA_ASSETS}/branding/logo/favicon.svg`, type: "image/svg+xml" },
	{
		rel: "apple-touch-icon",
		href: `${WAKABA_ASSETS}/branding/app-icon/apple-touch-icon.png`,
		sizes: "180x180",
	},
];

/**
 * The page, in Wakaba's scope: cream paper or warm charcoal from edge to edge, the app's
 * faces, a header naming the app and a footer with its policies, around the page's `main`.
 *
 * @param handle Runtime handle carrying the page's metadata, assets and content.
 * @returns The render function producing the whole document.
 */
export function WakabaLayout(handle: Handle<WakabaLayout.Props>) {
	return () => {
		let { assets, bilingual, children, description, path, title } = handle.props;
		let copy = handle.props.copy ?? EN;
		let canonical = new URL(
			bilingual && copy.locale !== "en" ? `${path}?lang=${copy.locale}` : path,
			PROFILE.canonical.origin,
		).href;
		let alternates = bilingual
			? [
					{ hreflang: "en", href: new URL(`${path}?lang=en`, PROFILE.canonical.origin).href },
					{ hreflang: "es", href: new URL(`${path}?lang=es-AR`, PROFILE.canonical.origin).href },
					{ hreflang: "x-default", href: new URL(path, PROFILE.canonical.origin).href },
				]
			: [];

		return (
			<DocumentLayout
				assets={assets}
				scope="wakaba"
				locale={copy.locale}
				title={title}
				description={description}
				canonical={canonical}
				icons={ICONS}
				alternates={alternates}
				themeColors={WAKABA_THEME_COLORS}
				meta={wakabaMeta(title, description, canonical, copy)}
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
				<WakabaLanguage copy={copy}>
					<WakabaHeader />
					<div mix={[grow(1), vstack({ gap: 0, align: "stretch" })]}>{children}</div>
					<WakabaFooter />
				</WakabaLanguage>
			</DocumentLayout>
		);
	};
}

/**
 * The footer's columns in the page's language: the app's own pages, the author's other
 * projects on and off this domain, and where else to find him.
 */
function footerColumns(copy: WakabaCopy): Array<FooterColumn> {
	return [
		{
			title: copy.footer.columns.wakaba,
			links: [
				{
					href: `${inLanguage(routes.wakaba.href(), copy.locale)}#download`,
					label: copy.footer.download,
				},
				{
					href: inLanguage(routes.wakabaSupport.index.href(), copy.locale),
					label: copy.header.support,
				},
				{ href: inLanguage(routes.wakabaPrivacy.href(), copy.locale), label: copy.header.privacy },
			],
		},
		{
			title: copy.footer.columns.more,
			links: [
				{ href: routes.feed.href(), label: copy.footer.blog },
				{ href: routes.apps.href(), label: "Apps" },
				{ href: routes.encore.href(), label: "Encore" },
				{ href: "https://uptime.sergiodxa.com", label: "Uptime" },
				{ href: "https://sdxc.dev", label: "sdxc.dev" },
			],
		},
		{
			title: copy.footer.columns.elsewhere,
			links: [
				{ href: PROFILE.github.profile, label: "GitHub" },
				{ href: PROFILE.x.profile, label: "X" },
				{ href: PROFILE.youtube.profile, label: "YouTube" },
			],
		},
	];
}

/**
 * The footer: the wordmark with the app's promise beside three columns of links, then who
 * made it, in the page's language.
 *
 * @returns The render function producing the footer.
 */
function WakabaFooter(handle: Handle) {
	return () => {
		let copy = copyOf(handle);
		return (
			<AppFooter
				brand={<Wordmark />}
				tagline={copy.footer.tagline}
				columns={footerColumns(copy)}
				madeBy={copy.footer.madeBy}
			/>
		);
	};
}
