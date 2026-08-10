/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags,
 * the page's SEO metadata and structured data, every stylesheet the site ships, and the
 * analytics beacon. Every server-rendered page is composed into it, so a page decides
 * only its own content and head values, never how the document is assembled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SchemaOrg } from "@pkg/seo";
import type { Handle, RemixNode } from "remix/ui";

import { Seo } from "@pkg/seo";
import { bg, colorScheme, fg } from "@pkg/u/color";
import { raw } from "@pkg/u/general";
import { vstack } from "@pkg/u/layout";
import { dark } from "@pkg/u/responsive";
import { minBs } from "@pkg/u/size";
import { font } from "@pkg/u/typography";
import resetStyles from "@pkg/ui/reset.css?url";
import themeStyles from "@pkg/ui/theme.css?url";

import { OG_IMAGE_URL, seo } from "~/app/lib/seo";
import colorStyles from "~/resources/css/colors.css?url";
import parityDealsStyles from "~/resources/css/parity-deals.css?url";
import prismStyles from "~/resources/css/prism.css?url";
import proseStyles from "~/resources/css/prose.css?url";

/**
 * The Cloudflare Insights beacon token. Kept verbatim: it identifies this site in the
 * Cloudflare dashboard, so a changed token silently ends the analytics history.
 */
const CF_BEACON_TOKEN = "4037e619e61b4e5a894789c3c98da9ab";

namespace DocumentLayout {
	export interface Props {
		/** The page's content, rendered inside `<body>`. */
		children: RemixNode;
		/** The document title. */
		title: string;
		/** Meta description for this page. Falls back to the site's default. */
		description?: string;
		/** The page's canonical absolute URL, built with `seo.canonical()`. */
		canonical: string;
		/** Structured data describing this page's subject. */
		schema?: SchemaOrg.Node | SchemaOrg.Node[];
		/** `robots` directives, built with `seo.robotsTag()`. Omit to let the page be indexed. */
		robots?: string;
		/** Extra `<head>` children, for a page that needs a third-party script or stylesheet. */
		head?: RemixNode;
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { canonical, children, description, head, robots, schema, title } = handle.props;

		return (
			/* `system` opts the theme layer into `prefers-color-scheme`, which is the only
			dark-mode signal this site has ever had — there is no theme toggle, and adding
			one would need client JavaScript the site deliberately does not load.

			`colorScheme("light dark")` covers what the theme layer cannot: the chrome the
			browser paints itself — scrollbars, the canvas behind the document, and the
			native form controls this site is mostly made of. */
			<html lang="en" class="system" mix={[colorScheme("light dark")]}>
				{/* `data-key` on every child is what a head diff would match on. No client
				runtime is loaded today, so nothing diffs the head; the keys are kept so
				introducing one cannot silently reintroduce a head-diff bug. */}
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
					{/* Pure white and pure black, matching the page itself in each scheme rather
					than a palette step: `content` is parsed as a bare color and cannot resolve
					`var()`, so these are literals by necessity. */}
					<meta
						name="theme-color"
						media="(prefers-color-scheme: light)"
						content="#ffffff"
						data-key="theme-color-light"
					/>
					<meta
						name="theme-color"
						media="(prefers-color-scheme: dark)"
						content="#000000"
						data-key="theme-color-dark"
					/>
					<link rel="shortcut icon" href="/favicon.ico" data-key="favicon" />
					{/* Reset first, then this site's palette scales, then the semantic tokens that
					read them through `var()`. Custom properties resolve at used-value time, so
					the order does not change which value wins; it mirrors the token layering. */}
					<link rel="stylesheet" href={resetStyles} data-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-key="style-palette" />
					<link rel="stylesheet" href={themeStyles} data-key="style-theme" />
					{/* Three rule sets that cannot be mixins, because none of the elements they style
					is written at a call site: the banner a third-party script injects, and the prose
					and code the Markdown renderer emits. They are linked from every page rather than
					only the two that use them — three small files on one shared cache entry beats a
					second stylesheet request on the page that converts. */}
					<link rel="stylesheet" href={parityDealsStyles} data-key="style-parity-deals" />
					<link rel="stylesheet" href={proseStyles} data-key="style-prose" />
					<link rel="stylesheet" href={prismStyles} data-key="style-prism" />
					{/* `Seo` emits the `<title>` itself, along with the description, canonical
					link, and both social card namespaces. */}
					<Seo
						title={title}
						description={description}
						canonical={canonical}
						site={seo.site}
						og={{ type: "website", image: OG_IMAGE_URL }}
						robots={robots}
						schema={schema}
					/>
					{head}
				</head>
				{/* Black on white, inverting to white on black — the whole of the site's color
				design. The page is centered as a column so every section can cap its own
				width without a wrapper element. */}
				<body
					mix={[
						vstack({ align: "center", justify: "center" }),
						minBs("100dvh"),
						font("sans"),
						// Pure white and pure black rather than palette steps: the site's light mode
						// is the untinted page, which no scale step is.
						raw({ backgroundColor: "#ffffff", color: "#000000" }),
						dark([bg("color.neutral.900"), fg("color.neutral.100")]),
					]}
				>
					{children}
					{/* Cloudflare's own analytics beacon: no cookies, no first-party bundle. */}
					<script
						defer
						src="https://static.cloudflareinsights.com/beacon.min.js"
						data-cf-beacon={`{"token": "${CF_BEACON_TOKEN}"}`}
					/>
				</body>
			</html>
		);
	};
}
