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

import { bg, borderEdge, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { container, gap, grid, gridTemplate, grow, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, maxIs, mi, minBs, p, pbe, pbs, pi } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import type { AppStoreListing } from "~/config/wakaba";
import type { WakabaCopy } from "~/resources/content/wakaba/copy";
import type { DocumentLayout as DocumentShell } from "~/resources/layouts/document";
import type { NavLink as ChromeLink } from "~/resources/views/wakaba/chrome";

import { PROFILE } from "~/config/profile";
import { APP_STORE, WAKABA_THEME_COLORS } from "~/config/wakaba";
import { EN } from "~/resources/content/wakaba/en";
import DocumentLayout from "~/resources/layouts/document";
import { QuietLink, WakabaHeader, Wordmark } from "~/resources/views/wakaba/chrome";
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
		 * Whether the page is written in both languages: it then links the other one from the
		 * header and advertises both to search engines, each at `?lang=`.
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
		let switchTo = bilingual
			? {
					href: `${path}?lang=${copy.switchLanguage.locale}`,
					label: copy.switchLanguage.label,
					locale: copy.switchLanguage.locale,
				}
			: undefined;

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
					<WakabaHeader switchTo={switchTo} />
					<div mix={[grow(1), vstack({ gap: 0, align: "stretch" })]}>{children}</div>
					<WakabaFooter />
				</WakabaLanguage>
			</DocumentLayout>
		);
	};
}

/** One titled column of footer links. */
interface FooterColumn {
	title: string;
	links: Array<WakabaLayout.NavLink>;
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
				{ href: `${routes.wakaba.href()}#download`, label: copy.footer.download },
				{ href: routes.wakabaSupport.index.href(), label: copy.header.support },
				{ href: routes.wakabaPrivacy.href(), label: copy.header.privacy },
			],
		},
		{
			title: copy.footer.columns.more,
			links: [
				{ href: routes.feed.href(), label: copy.footer.blog },
				{ href: routes.encoreSupport.index.href(), label: "Encore" },
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
 * made it. The columns sit in a row of their own from the `md` width of the footer.
 *
 * @returns The render function producing the footer.
 */
function WakabaFooter(handle: Handle) {
	return () => {
		let copy = copyOf(handle);
		return (
			<footer mix={[container("wakaba-footer"), pi(4), pbs(12), pbe(10), at("md", pi(6))]}>
				<div
					mix={[
						vstack({ gap: 8, align: "stretch" }),
						maxIs("72rem"),
						mi("auto"),
						pbs(8),
						borderEdge("block-start", { width: 1, color: "neutral" }),
					]}
				>
					<div
						mix={[
							grid(),
							gap(8),
							at("lg", "wakaba-footer", gridTemplate({ columns: "minmax(0, 1fr) auto" })),
						]}
					>
						<div mix={[vstack({ gap: 2, align: "start" })]}>
							<Wordmark />
							<p mix={[m(0), text("sm"), fg("neutral"), maxIs("20rem")]}>{copy.footer.tagline}</p>
						</div>
						<div
							mix={[
								grid(),
								gap(8),
								gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
								at("md", "wakaba-footer", gridTemplate({ columns: repeat(3, "max-content") })),
								at("md", "wakaba-footer", raw({ columnGap: "4rem" })),
							]}
						>
							{footerColumns(copy).map((column) => (
								<nav
									key={column.title}
									aria-label={column.title}
									mix={[vstack({ gap: 3, align: "start" })]}
								>
									<h2 mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
										{column.title}
									</h2>
									<ul
										mix={[
											vstack({ gap: 2, align: "start" }),
											m(0),
											p(0),
											raw({ listStyle: "none" }),
											text("sm"),
										]}
									>
										{column.links.map((link) => (
											<li key={link.href}>
												<QuietLink {...link} />
											</li>
										))}
									</ul>
								</nav>
							))}
						</div>
					</div>
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
						{copy.footer.madeBy}{" "}
						<a
							href={routes.feed.href()}
							mix={[
								fg("neutral"),
								hover(fg("neutral.emphasis")),
								focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "2px" })),
							]}
						>
							Sergio Xalambrí
						</a>{" "}
						· © 2026
					</p>
				</div>
			</footer>
		);
	};
}
