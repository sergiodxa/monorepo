/**
 * HTML document shell for the marketing landing: fonts, stylesheets, the page's
 * SEO tags and JSON-LD, and a full-bleed body that carries the page composition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { SchemaOrg } from "@sdxc/seo";
import type { Handle, RemixNode } from "remix/component";

import { Seo } from "@sdxc/seo";
import { raw } from "@sdxc/u/general";
import { minBs } from "@sdxc/u/size";
import { font, leading } from "@sdxc/u/typography";
import { unsafeHTML } from "remix/component";

import { seo } from "~/app/initializers/seo";
import {
	AUTHOR_PROFILES,
	AUTHOR_URL,
	OG_IMAGE_HEIGHT,
	OG_IMAGE_PATH,
	OG_IMAGE_WIDTH,
} from "~/config/site";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Bunny Fonts origin for Outfit and IBM Plex Mono. */
const FONTS_STYLESHEET =
	"https://fonts.bunny.net/css?family=ibm-plex-mono:400,500|outfit:400,500,600,700";

namespace DocumentLayout {
	export interface Props {
		/** Page body. */
		children: RemixNode;
		/** Stylesheets and client entry from `ctx.assets`. */
		assets: DocumentAssets;
		/** Document title. */
		title: string;
		/** Meta description. */
		description: string;
		/** Absolute canonical URL, from `seo.canonical()`. */
		canonical: string;
		/**
		 * Schema.org nodes for this page, emitted as one JSON-LD script stamped with
		 * `assets.nonce`. The response CSP allows that inline script only with the nonce.
		 */
		schema?: SchemaOrg.Node | SchemaOrg.Node[];
		/** `robots` meta content from `seo.robotsTag()`. */
		robots?: string;
	}
}

/**
 * Renders the outer document. Pages stay static (no client entry) so agents and
 * humans share one HTML response without hydration. Head metadata comes from
 * `@sdxc/seo`, and `rel="me"` / `rel="author"` name the publisher.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { assets, canonical, children, description, robots, schema, title } = handle.props;
		let { stylesheets } = assets;

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" data-rmx-key="charset" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1"
						data-rmx-key="viewport"
					/>
					<meta name="theme-color" content="#e8eef2" data-rmx-key="theme-color" />
					{AUTHOR_PROFILES.map((href) => (
						<link key={href} rel="me" href={href} data-rmx-key={`me:${href}`} />
					))}
					<link rel="author" href={AUTHOR_URL} data-rmx-key="author" />
					<Seo.Meta
						title={title}
						description={description}
						canonical={canonical}
						site={seo.site}
						og={{
							type: "website",
							locale: "en_US",
							image: seo.absolute(OG_IMAGE_PATH),
							imageAlt: title,
							imageWidth: OG_IMAGE_WIDTH,
							imageHeight: OG_IMAGE_HEIGHT,
						}}
						robots={robots}
					/>
					{schema ? (
						<script
							type="application/ld+json"
							nonce={assets.nonce}
							innerHTML={unsafeHTML(seo.jsonLdString(schema))}
						/>
					) : null}
					<link rel="preconnect" href="https://fonts.bunny.net" data-rmx-key="fonts-preconnect" />
					<link rel="stylesheet" href={FONTS_STYLESHEET} data-rmx-key="fonts" />
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-rmx-key={href} />
					))}
				</head>
				<body
					mix={[
						minBs("100dvh"),
						font("sans"),
						leading("normal"),
						raw({
							margin: "0",
							color: "var(--apis-ink)",
							backgroundColor: "var(--apis-paper)",
							WebkitFontSmoothing: "antialiased",
						}),
					]}
				>
					{children}
				</body>
			</html>
		);
	};
}
