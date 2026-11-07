/**
 * The shell of Encore's pages on sergiodxa.com: the document in Encore's own scope, with its
 * social tags and the App Store smart banner, under a header and footer of its own. The pages
 * share the domain with the blog and none of its chrome, and each is written in three languages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, grow, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, maxIs, mi, minBs, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import type { EncoreLocale } from "~/config/encore";
import type { EncoreCopy } from "~/resources/content/encore/copy";
import type { DocumentLayout as DocumentShell } from "~/resources/layouts/document";
import type { FooterColumn } from "~/resources/views/app-pages/footer";

import {
	ENCORE_APP_STORE_ID,
	ENCORE_LOCALES,
	ENCORE_THEME_COLORS,
	inLanguage,
} from "~/config/encore";
import { PROFILE } from "~/config/profile";
import { ENCORE_COPY } from "~/resources/content/encore";
import DocumentLayout from "~/resources/layouts/document";
import { AppFooter, QuietLink } from "~/resources/views/app-pages/footer";
import { copyOf, EncoreLanguage, Wordmark } from "~/resources/views/encore/parts";
import routes from "~/routes/web";

/** Types used by Encore's page shell. */
export namespace EncoreLayout {
	export interface Props {
		title: string;
		description: string;
		/** The page's path, which its canonical URL, `og:url` and language links are built from. */
		path: string;
		/** The page's language. English by default. */
		locale?: EncoreLocale;
		children: RemixNode;
		/** The request's document assets, which the renderer hands every view. */
		assets: DocumentAssets;
	}
}

/** The `og:locale` of each language. */
const OG_LOCALES: Record<EncoreLocale, string> = { en: "en_US", "es-AR": "es_AR", ja: "ja_JP" };

/**
 * The tags that describe an Encore page off the site: Open Graph and Twitter, and the Safari
 * smart banner naming the App Store listing. A social card image joins them once it is exported.
 *
 * @param title The page's title.
 * @param description The page's description.
 * @param url The page's canonical URL.
 * @param locale The page's language.
 * @returns The meta tags, in the order the document writes them.
 */
export function encoreMeta(
	title: string,
	description: string,
	url: string,
	locale: EncoreLocale,
): Array<DocumentShell.MetaTag> {
	return [
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "Encore" },
		{ property: "og:locale", content: OG_LOCALES[locale] },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ name: "twitter:card", content: "summary" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
		{ name: "apple-itunes-app", content: `app-id=${ENCORE_APP_STORE_ID}` },
	];
}

/**
 * The page in Encore's scope: warm paper or the plum night from edge to edge, a header naming
 * the app and a footer with its policies and languages, around the page's `main`. Every
 * language of the page is advertised to search engines at its `?lang=` address.
 *
 * @param handle Runtime handle carrying the page's metadata, language, assets and content.
 * @returns The render function producing the whole document.
 */
export function EncoreLayout(handle: Handle<EncoreLayout.Props>) {
	return () => {
		let { assets, children, description, path, title } = handle.props;
		let locale = handle.props.locale ?? "en";
		let canonical = new URL(inLanguage(path, locale), PROFILE.canonical.origin).href;
		let alternates = [
			...ENCORE_LOCALES.map((language) => ({
				hreflang: language === "es-AR" ? "es" : language,
				href: new URL(`${path}?lang=${language}`, PROFILE.canonical.origin).href,
			})),
			{ hreflang: "x-default", href: new URL(path, PROFILE.canonical.origin).href },
		];

		return (
			<DocumentLayout
				assets={assets}
				scope="encore"
				locale={locale}
				title={title}
				description={description}
				canonical={canonical}
				alternates={alternates}
				themeColors={ENCORE_THEME_COLORS}
				meta={encoreMeta(title, description, canonical, locale)}
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
				<EncoreLanguage copy={ENCORE_COPY[locale]}>
					<EncoreHeader path={path} />
					<div mix={[grow(1), vstack({ gap: 0, align: "stretch" })]}>{children}</div>
					<EncoreFooter path={path} />
				</EncoreLanguage>
			</DocumentLayout>
		);
	};
}

/**
 * The header: the wordmark home, then Support and Privacy. The two short links fit beside
 * the wordmark at 320px in every language, so the header needs no menu.
 *
 * @returns The render function producing the header.
 */
export function EncoreHeader(handle: Handle<{ path: string }>) {
	return () => {
		let copy = copyOf(handle);
		return (
			<header mix={[pi(4), at("md", pi(6))]}>
				<nav
					aria-label={copy.header.navLabel}
					mix={[
						hstack({ gap: 4, align: "center", justify: "between" }),
						maxIs("72rem"),
						mi("auto"),
						pb(4),
					]}
				>
					<Wordmark />
					<span mix={[hstack({ gap: 5, align: "center" }), text("sm")]}>
						<QuietLink
							href={inLanguage(routes.encoreSupport.index.href(), copy.locale)}
							label={copy.header.support}
						/>
						<QuietLink
							href={inLanguage(routes.encorePrivacy.href(), copy.locale)}
							label={copy.header.privacy}
						/>
					</span>
				</nav>
			</header>
		);
	};
}

/**
 * The footer's columns in the page's language: the app's own pages, the author's other
 * projects on and off this domain, and where else to find him.
 */
function footerColumns(copy: EncoreCopy): Array<FooterColumn> {
	return [
		{
			title: copy.footer.columns.encore,
			links: [
				{
					href: inLanguage(`${routes.encore.href()}#download`, copy.locale),
					label: copy.footer.download,
				},
				{
					href: inLanguage(routes.encoreSupport.index.href(), copy.locale),
					label: copy.header.support,
				},
				{ href: inLanguage(routes.encorePrivacy.href(), copy.locale), label: copy.header.privacy },
			],
		},
		{
			title: copy.footer.columns.more,
			links: [
				{ href: routes.feed.href(), label: copy.footer.blog },
				{ href: routes.wakaba.href(), label: "Wakaba" },
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
 * The page in each of its languages, each named in its own language, the current one marked.
 *
 * @param handle Runtime handle carrying the page's path.
 * @returns The render function producing the links.
 */
function LanguageLinks(handle: Handle<{ path: string }>) {
	return () => {
		let copy = copyOf(handle);
		return (
			<nav aria-label={copy.footer.languages}>
				<ul
					mix={[
						hstack({ gap: 4, align: "center" }),
						flexWrap("wrap"),
						m(0),
						raw({ padding: "0", listStyle: "none" }),
						text("sm"),
					]}
				>
					{ENCORE_LOCALES.map((language) => {
						let name = ENCORE_COPY[language].languageName;
						return (
							<li key={language} lang={language}>
								{language === copy.locale ? (
									<span aria-current="page" mix={[weight("semibold"), fg("neutral.emphasis")]}>
										{name}
									</span>
								) : (
									<QuietLink
										href={`${handle.props.path}?lang=${language}`}
										label={name}
										hrefLang={language}
									/>
								)}
							</li>
						);
					})}
				</ul>
			</nav>
		);
	};
}

/**
 * The footer: the wordmark and the app's promise beside three columns of links, the page in
 * its other languages, then who made it.
 *
 * @param handle Runtime handle carrying the page's path, for the language links.
 * @returns The render function producing the footer.
 */
function EncoreFooter(handle: Handle<{ path: string }>) {
	return () => {
		let copy = copyOf(handle);
		return (
			<AppFooter
				brand={<Wordmark />}
				tagline={copy.footer.tagline}
				columns={footerColumns(copy)}
				madeBy={copy.footer.madeBy}
				extra={<LanguageLinks path={handle.props.path} />}
			/>
		);
	};
}
