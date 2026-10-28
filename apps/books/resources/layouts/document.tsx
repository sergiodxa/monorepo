/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags, the
 * page's SEO metadata and structured data, every stylesheet the site ships (imported below
 * in cascade order), and the analytics beacon.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { SchemaOrg } from "@sdxc/seo";
import type { Handle, RemixNode } from "remix/component";

import { Seo } from "@sdxc/seo";
import { bg, colorScheme, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { dark } from "@sdxc/u/responsive";
import { minBs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { ImportMap } from "remix/component/server";

import { seo } from "~/app/initializers/seo";
import { OG_IMAGE_URL } from "~/config/constants";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/marketing.css";
import "~/resources/css/parity-deals.css";
import "~/resources/css/prose.css";
import "@sdxc/highlight/styles.css";
import "~/resources/css/highlight.css";

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
		/**
		 * The stylesheets and client entry the request resolved, passed as `ctx.assets`, with the
		 * CSP nonce the import map carries; it is read only on a hydrating page, so a static page
		 * advertises none.
		 */
		assets: DocumentAssets;
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
		/**
		 * Links the client entry and its import map, for a page carrying an island. Off by
		 * default, which keeps a page free of first-party JavaScript.
		 * @default false
		 */
		hydrates?: boolean;
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. Dark
 * mode is CSS-only, via the `system` class and `colorScheme` mix, and body
 * colors stay pure black-on-white, matching the page's untinted light mode.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let {
			assets,
			canonical,
			children,
			description,
			head,
			hydrates = false,
			robots,
			schema,
			title,
		} = handle.props;
		let { script, stylesheets } = assets;

		return (
			<html lang="en" class="system" mix={[colorScheme("light dark")]}>
				<head>
					<meta charSet="utf-8" data-rmx-key="charset" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1"
						data-rmx-key="viewport"
					/>
					<meta
						name="theme-color"
						media="(prefers-color-scheme: light)"
						content="#ffffff"
						data-rmx-key="theme-color-light"
					/>
					<meta
						name="theme-color"
						media="(prefers-color-scheme: dark)"
						content="#000000"
						data-rmx-key="theme-color-dark"
					/>
					<link rel="shortcut icon" href="/favicon.ico" data-rmx-key="favicon" />
					{hydrates ? (
						<>
							<ImportMap value={script.importMap} nonce={assets.nonce} />
							{script.preloads.map((href) => (
								<link key={href} rel="modulepreload" href={href} data-rmx-key={href} />
							))}
						</>
					) : null}
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-rmx-key={href} />
					))}
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
					{hydrates ? <script type="module" src={script.href}></script> : null}
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
