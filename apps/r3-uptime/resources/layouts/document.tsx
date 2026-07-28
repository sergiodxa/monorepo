/**
 * Root HTML document layout for the r3-uptime app. It renders the outer html/head/body
 * shell with charset and viewport meta tags, an optional page title, the @pkg/r3-ui
 * design-system stylesheets, and the client entry script, switching between the dev
 * source and the built asset path. It exists as the shared document wrapper every
 * server-rendered page is composed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import resetStyles from "@pkg/r3-ui/reset.css?url";
import themeStyles from "@pkg/r3-ui/theme.css?url";
import { bg, fg } from "@pkg/u/color";
import { m } from "@pkg/u/size";
import { font } from "@pkg/u/typography";

import colorStyles from "~/resources/css/colors.css?url";

/**
 * Raw `@font-face` rule for Mona Sans, the display font `--ui-font-sans` (see
 * `resources/css/colors.css`) points the marketing chrome at. Declared here, once,
 * so every page's `<head>` gets it regardless of which layout it renders through.
 * Emitted as a plain `<style>` tag rather than through the `css()` mixin because
 * that mixin scopes every rule to a generated element class name, which can't
 * express a top-level, unscoped at-rule like this.
 */
const fontFaceCss = `
	@font-face {
		font-family: "Mona Sans";
		font-display: swap;
		font-weight: 100 900;
		src:
			local("Mona Sans"),
			url("/fonts/mona-sans.woff2") format("woff2");
	}
`;

const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	/**
	 * One `<link rel="preload">` a page asks for on top of the document's own
	 * fixed set. Narrow on purpose — a page declares *what* to fetch early, not
	 * arbitrary `<head>` content.
	 */
	export interface Preload {
		href: string;
		/** The `as` destination, e.g. `"image"` for a hero screenshot. */
		as: string;
		/** Optional media condition, e.g. `"(prefers-color-scheme: dark)"` so only the matching variant is fetched. */
		media?: string;
	}

	/**
	 * Everything a public page needs in `<head>` beyond its `<title>`: the
	 * description search engines and social cards quote, the canonical URL, and
	 * optional structured data. Only meaningful for indexable pages — the
	 * signed-in app's own screens have nothing to say to a crawler.
	 */
	export interface Seo {
		/** Meta description, reused as `og:description` and `twitter:description`. */
		description: string;
		/**
		 * The page's canonical absolute URL. Build it with `canonicalUrl()` from
		 * `~/app/lib/seo` rather than passing `ctx.url` straight through, so every
		 * page advertises one URL on one origin regardless of which host served it.
		 */
		url: string;
		/** `og:type`. Defaults to `"website"`. */
		type?: "website" | "article";
		/**
		 * schema.org structured data, emitted as `application/ld+json`. Use the
		 * builders in `~/app/lib/seo` — and only describe what the page actually
		 * renders (an `FAQPage` schema for questions a visitor can't find on the
		 * page breaks Google's structured-data policy).
		 */
		jsonLd?: object | object[];
	}

	export interface Props {
		children: RemixNode;
		title?: string;
		/** The request's detected language (`ctx.locale`), set as `<html lang>`. Defaults to `"en"` for the few call sites that don't have it in scope yet. */
		locale?: string;
		/**
		 * Page-specific assets to preload, emitted before the stylesheets so the
		 * browser starts fetching them as early as possible. Only for assets that
		 * render above the fold (the homepage's hero screenshot) — everything else
		 * should just load normally.
		 */
		preload?: Preload[];
		/** Description/canonical/Open Graph/structured data for an indexable page. Omit inside the app shell. */
		seo?: Seo;
	}
}

/** Site name used for `og:site_name`, the one piece of `<head>` copy that isn't the page's own. */
const SITE_NAME = "Uptime";

/**
 * Serializes structured data for a `<script type="application/ld+json">` body.
 * `<` is escaped to its unicode form so a `</script>` sequence inside any string
 * value can't close the tag early — the JSON stays valid either way, since
 * `<` and `<` are the same character to a JSON parser.
 */
function serializeJsonLd(jsonLd: object | object[]): string {
	return JSON.stringify(jsonLd).replaceAll("<", "\\u003c");
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`, with an optional `<title>` and the client entry script. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { title, locale = "en", preload = [], seo, children } = handle.props;

		return (
			<html lang={locale} class="system">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					{title && <title>{title}</title>}
					{seo && (
						<>
							<meta name="description" content={seo.description} />
							<link rel="canonical" href={seo.url} />
							{/* Open Graph and Twitter both restate the title/description rather
							than reading the tags above — every consumer of these cards reads
							its own namespace and ignores the other's. */}
							<meta property="og:type" content={seo.type ?? "website"} />
							<meta property="og:url" content={seo.url} />
							<meta property="og:site_name" content={SITE_NAME} />
							{title && <meta property="og:title" content={title} />}
							<meta property="og:description" content={seo.description} />
							<meta name="twitter:card" content="summary_large_image" />
							{title && <meta name="twitter:title" content={title} />}
							<meta name="twitter:description" content={seo.description} />
							{seo.jsonLd && (
								/* `innerHTML`, not children: JSX escapes text nodes, which would
								turn the JSON's own quotes into entities and leave the structured
								data unparseable. */
								<script type="application/ld+json" innerHTML={serializeJsonLd(seo.jsonLd)}></script>
							)}
						</>
					)}
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} />
					{preload.map((asset) => (
						<link
							key={`${asset.href}-${asset.media ?? ""}`}
							rel="preload"
							href={asset.href}
							as={asset.as}
							media={asset.media}
						/>
					))}
					{/* Order matters: reset first, then semantic theme tokens, then this
					app's own --color-* scales those tokens read through `var()` — CSS
					custom properties resolve at used-value time, so declaration order
					between these three doesn't actually affect which value wins, but
					reading them least-specific-to-most mirrors the token layering. */}
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={colorStyles} />
					<link rel="stylesheet" href={themeStyles} />
					<style>{fontFaceCss}</style>
				</head>
				<body mix={[m(0), bg("neutral.bg-tint"), fg("neutral.emphasis"), font("mono")]}>
					{children}
					{/* `async`, not the implicit defer of a plain module script — a deferred
					script waits for this whole streamed response to finish parsing, so a
					non-blocking Frame's later-arriving <template> would never get picked up
					until the slowest Frame on the page had already resolved. */}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
