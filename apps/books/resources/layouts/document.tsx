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
 * The Cloudflare Insights beacon token. Kept verbatim: it identifies this
 * site in the Cloudflare dashboard, so a changed token silently ends the
 * analytics history. It loads with no cookies and no first-party bundle.
 */
const CF_BEACON_TOKEN = "4037e619e61b4e5a894789c3c98da9ab";

namespace DocumentLayout {
	export interface Props {
		/**
		 * The page's content, rendered inside `<body>`, which centers it as a
		 * column so each section can cap its own width without a wrapper element.
		 */
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

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. Dark
 * mode is CSS-only, via the `system` class and `colorScheme` mix, and body
 * colors stay pure black-on-white, matching the page's untinted light mode.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { canonical, children, description, head, robots, schema, title } = handle.props;

		return (
			<html lang="en" class="system" mix={[colorScheme("light dark")]}>
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
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
					<link rel="stylesheet" href={resetStyles} data-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-key="style-palette" />
					<link rel="stylesheet" href={themeStyles} data-key="style-theme" />
					<link rel="stylesheet" href={parityDealsStyles} data-key="style-parity-deals" />
					<link rel="stylesheet" href={proseStyles} data-key="style-prose" />
					<link rel="stylesheet" href={prismStyles} data-key="style-prism" />
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
				<body
					mix={[
						vstack({ align: "center", justify: "center" }),
						minBs("100dvh"),
						font("sans"),
						raw({ backgroundColor: "#ffffff", color: "#000000" }),
						dark([bg("color.neutral.900"), fg("color.neutral.100")]),
					]}
				>
					{children}
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
