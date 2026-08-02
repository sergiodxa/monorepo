/**
 * Root HTML document layout for the uptime app. It renders the outer html/head/body
 * shell with charset and viewport meta tags, an optional page title, an indexable
 * page's metadata and structured data, the @pkg/r3-ui design-system stylesheets, and
 * the client entry script, switching between the dev source and the built asset path.
 * It exists as the shared document wrapper every server-rendered page is composed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import resetStyles from "@pkg/r3-ui/reset.css?url";
import themeStyles from "@pkg/r3-ui/theme.css?url";
import { Seo } from "@pkg/seo";
import { bg, fg } from "@pkg/u/color";
import { m } from "@pkg/u/size";
import { font } from "@pkg/u/typography";

import { SEO } from "~/app/lib/seo";
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

/**
 * The Cloudflare Web Analytics site token. Public by construction — the beacon reads it
 * out of the rendered attribute, so it ships to every browser that loads a page — which
 * is why it is a constant here rather than a binding. Kept verbatim: it is what
 * identifies this property in the Cloudflare dashboard, so a changed token silently
 * starts a fresh, empty analytics history instead of failing.
 */
const CF_BEACON_TOKEN = "2e915da0d572432eb502c32794ac1da6";

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
		/**
		 * Description, canonical URL, Open Graph facts, and structured data for an
		 * indexable page. Build the canonical with `SEO.canonical()` and the schema
		 * with `SEO.schema.*` rather than by hand, so a page never advertises a URL
		 * the rest of the site disagrees with — and only describe what the page
		 * actually renders (an `FAQPage` node for questions a visitor can't find on
		 * the page breaks Google's structured-data policy). Omit inside the app
		 * shell: the signed-in screens have nothing to say to a crawler.
		 *
		 * The page's `title` and the site identity are supplied by the layout, so a
		 * caller passes neither.
		 */
		seo?: Omit<Seo.Props, "title" | "site">;
	}
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
					{/* An indexable page emits its whole head contribution — title, description,
					canonical, Open Graph, Twitter, and structured data — through one input;
					a page with nothing to tell a crawler still gets its `<title>`. */}
					{seo ? <Seo title={title} site={SEO.site} {...seo} /> : title && <title>{title}</title>}
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
					{/* Cloudflare's own analytics beacon — no cookies, and nothing added to the
					first-party bundle. Last thing in the body, where Cloudflare's snippet goes, so
					it never competes with the page's own content for the connection. The
					`data-cf-beacon` name and its JSON shape are the beacon's, read verbatim off
					this attribute, so neither is ours to tidy up. */}
					<script
						type="module"
						src="https://static.cloudflareinsights.com/beacon.min.js"
						data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
					></script>
				</body>
			</html>
		);
	};
}
