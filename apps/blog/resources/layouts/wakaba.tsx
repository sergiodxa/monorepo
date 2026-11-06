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
import { container, gap, grid, gridTemplate, grow, hstack, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, maxIs, mi, minBs, p, pb, pbe, pbs, pi } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import type { AppStoreListing } from "~/config/wakaba";
import type { DocumentLayout as DocumentShell } from "~/resources/layouts/document";

import { PROFILE } from "~/config/profile";
import { APP_STORE, WAKABA_THEME_COLORS } from "~/config/wakaba";
import DocumentLayout from "~/resources/layouts/document";
import { WAKABA_ASSETS, WakabaMark } from "~/resources/views/wakaba/parts";
import routes from "~/routes/web";

/** Types used by Wakaba's page shell. */
export namespace WakabaLayout {
	export interface Props {
		title: string;
		description: string;
		/** The page's path, which its canonical URL and `og:url` are built from. */
		path: string;
		/** The page's language. Defaults to `"en"`. */
		locale?: string;
		children: RemixNode;
		/** The request's document assets, which the renderer hands every view. */
		assets: DocumentAssets;
	}

	/** One link in the header or the footer. */
	export interface NavLink {
		href: string;
		label: string;
	}
}

/**
 * The tags that describe a Wakaba page off the site: Open Graph and Twitter with the social
 * card drawn from the logo and the grown bonsai, and the Safari smart banner, which names the
 * App Store listing and so appears only once the app has one.
 *
 * @param title The page's title.
 * @param description The page's description.
 * @param url The page's canonical URL.
 * @param listing The App Store listing the banner names, the configured one by default.
 * @returns The meta tags, in the order the document writes them.
 */
export function wakabaMeta(
	title: string,
	description: string,
	url: string,
	listing: AppStoreListing = APP_STORE,
): Array<DocumentShell.MetaTag> {
	let image = new URL(`${WAKABA_ASSETS}/social-card.png`, PROFILE.canonical.origin).href;
	let tags: Array<DocumentShell.MetaTag> = [
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: "Wakaba" },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: url },
		{ property: "og:image", content: image },
		{
			property: "og:image:alt",
			content: "Wakaba: Grow with every session. A vermilion bonsai beside the 学 logo.",
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
	{ rel: "icon", href: `${WAKABA_ASSETS}/favicon.svg`, type: "image/svg+xml" },
	{ rel: "apple-touch-icon", href: `${WAKABA_ASSETS}/apple-touch-icon.png`, sizes: "180x180" },
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
		let { assets, children, description, locale, path, title } = handle.props;
		let canonical = new URL(path, PROFILE.canonical.origin).href;

		return (
			<DocumentLayout
				assets={assets}
				scope="wakaba"
				locale={locale}
				title={title}
				description={description}
				canonical={canonical}
				icons={ICONS}
				themeColors={WAKABA_THEME_COLORS}
				meta={wakabaMeta(title, description, canonical)}
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
				<WakabaHeader />
				<div mix={[grow(1), vstack({ gap: 0, align: "stretch" })]}>{children}</div>
				<WakabaFooter />
			</DocumentLayout>
		);
	};
}

/** The pages the header and footer link, after the app's own landing. */
const PAGES: Array<WakabaLayout.NavLink> = [
	{ href: routes.wakabaSupport.index.href(), label: "Support" },
	{ href: routes.wakabaPrivacy.href(), label: "Privacy" },
];

/**
 * The wordmark linking home: the 学 mark in the accent beside "Wakaba" set in the rounded
 * display face, the way the app names itself on the home screen.
 *
 * @returns The render function producing the link.
 */
function Wordmark() {
	return () => (
		<a
			href={routes.wakaba.href()}
			mix={[
				hstack({ gap: 2, align: "center" }),
				fg("neutral.emphasis"),
				raw({ textDecoration: "none" }),
				font("display"),
				text("xl"),
				weight("bold"),
				focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "4px" })),
			]}
		>
			<span mix={[fg("brand"), hstack({ gap: 0, align: "center" })]}>
				<WakabaMark size={30} />
			</span>
			Wakaba
		</a>
	);
}

/**
 * A plain text link in the header or footer, quiet until hovered.
 *
 * @param handle Runtime handle carrying the destination and label.
 * @returns The render function producing the link.
 */
function QuietLink(handle: Handle<WakabaLayout.NavLink>) {
	return () => (
		<a
			href={handle.props.href}
			mix={[
				fg("neutral"),
				weight("medium"),
				raw({ textDecoration: "none" }),
				hover(fg("neutral.emphasis")),
				focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "4px" })),
			]}
		>
			{handle.props.label}
		</a>
	);
}

/**
 * The header: the wordmark home, then Support and Privacy. Two short links fit beside the
 * wordmark at 320px, so the header needs no menu.
 *
 * @returns The render function producing the header.
 */
function WakabaHeader() {
	return () => (
		<header mix={[pi(4), at("md", pi(6))]}>
			<nav
				aria-label="Wakaba"
				mix={[
					hstack({ gap: 4, align: "center", justify: "between" }),
					maxIs("72rem"),
					mi("auto"),
					pb(4),
				]}
			>
				<Wordmark />
				<span mix={[hstack({ gap: 5, align: "center" }), text("sm")]}>
					{PAGES.map((page) => (
						<QuietLink key={page.href} {...page} />
					))}
				</span>
			</nav>
		</header>
	);
}

/** One titled column of footer links. */
interface FooterColumn {
	title: string;
	links: Array<WakabaLayout.NavLink>;
}

/**
 * The footer's columns: the app's own pages, the author's other projects on and off this
 * domain, and where else to find him.
 */
const FOOTER_COLUMNS: Array<FooterColumn> = [
	{
		title: "Wakaba",
		links: [
			{ href: `${routes.wakaba.href()}#download`, label: "Download" },
			{ href: routes.wakabaSupport.index.href(), label: "Support" },
			{ href: routes.wakabaPrivacy.href(), label: "Privacy" },
		],
	},
	{
		title: "More from Sergio",
		links: [
			{ href: routes.feed.href(), label: "Blog" },
			{ href: routes.encoreSupport.index.href(), label: "Encore" },
			{ href: "https://uptime.sergiodxa.com", label: "Uptime" },
			{ href: "https://sdxc.dev", label: "sdxc.dev" },
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
 * The footer: the wordmark with the app's promise beside three columns of links, then who
 * made it. The columns sit in a row of their own from the `md` width of the footer.
 *
 * @returns The render function producing the footer.
 */
function WakabaFooter() {
	return () => (
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
						<p mix={[m(0), text("sm"), fg("neutral"), maxIs("20rem")]}>
							Grow with every session. Japanese vocabulary practice for iPhone and iPad, for free.
						</p>
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
						{FOOTER_COLUMNS.map((column) => (
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
					Made by{" "}
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
}
