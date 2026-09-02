/**
 * Root HTML document layout for the uptime app. It renders the outer html/head/body
 * shell with charset and viewport meta tags, an optional page title, an indexable
 * page's metadata and structured data, the @pkg/ui design-system stylesheets, and
 * the client entry script, switching between the dev source and the built asset path.
 * It exists as the shared document wrapper every server-rendered page is composed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import highlightStyles from "@pkg/highlight/styles.css?url";
import { Seo } from "@pkg/seo";
import { bg, fg } from "@pkg/u/color";
import { m } from "@pkg/u/size";
import { font } from "@pkg/u/typography";
import resetStyles from "@pkg/ui/reset.css?url";
import themeStyles from "@pkg/ui/theme.css?url";

import { SEO } from "~/app/lib/seo";
import colorStyles from "~/resources/css/colors.css?url";

/**
 * Raw `@font-face` rule for Mona Sans, declared once so every page's `<head>`
 * gets it. Uses a plain `<style>` tag: the `css()` mixin scopes rules to a
 * generated class name, which can't express an unscoped `@font-face`.
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
 * The Cloudflare Web Analytics site token — public by construction, since
 * browsers read it straight off the rendered attribute. Change it and
 * Cloudflare treats it as a new property, losing the analytics history.
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
		 * browser fetches them as early as possible. Reserve this for assets that
		 * render above the fold, such as a hero screenshot; leave everything else off.
		 */
		preload?: Preload[];
		/**
		 * Description, canonical URL, Open Graph facts, and structured data for an
		 * indexable page. Build it with `SEO.canonical()` and `SEO.schema.*` so URLs
		 * stay consistent site-wide. Omit it in the app shell — nothing there talks to a crawler.
		 */
		seo?: Omit<Seo.Props, "title" | "site">;
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. The
 * client entry script loads `async`, so a non-blocking Frame's `<template>`
 * is picked up the moment that chunk of the streamed response arrives.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { title, locale = "en", preload = [], seo, children } = handle.props;

		return (
			<html lang={locale} class="system">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
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
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={colorStyles} />
					<link rel="stylesheet" href={themeStyles} />
					<link rel="stylesheet" href={highlightStyles} />
					<style>{fontFaceCss}</style>
				</head>
				<body mix={[m(0), bg("neutral.bg-tint"), fg("neutral.emphasis"), font("mono")]}>
					{children}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
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
