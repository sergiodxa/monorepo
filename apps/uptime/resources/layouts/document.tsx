/**
 * Root HTML document layout for the uptime app. It renders the outer html/head/body
 * shell with charset and viewport meta tags, an optional page title, an indexable
 * page's metadata and structured data, the stylesheets imported below in cascade order, and
 * the client entry with the import map its chunks resolve through, both read from the asset
 * manifest. It is the shared document wrapper every server-rendered page is composed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { Seo } from "@sdxc/seo";
import { bg, fg } from "@sdxc/u/color";
import { m } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { ImportMap } from "remix/component/server";

import type { DocumentAssets as Assets } from "~/app/lib/assets";

import { SEO } from "~/app/lib/seo";
import { CspNonce } from "~/resources/components/csp-nonce";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "@sdxc/highlight/styles.css";

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

/**
 * Hands the document the assets the renderer looked up, which it reads where a component
 * cannot await them itself.
 */
export function DocumentAssets(handle: Handle<{ value: Assets; children: RemixNode }, Assets>) {
	handle.context.set(handle.props.value);
	return () => handle.props.children;
}

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
 * is picked up the moment that chunk of the streamed response arrives. The import map
 * precedes every module tag and carries the response's nonce, which every map the client
 * runtime appends reuses.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	let nonce = handle.context.get(CspNonce)?.nonce;

	return () => {
		let { title, locale = "en", preload = [], seo, children } = handle.props;
		let { script, stylesheets } = handle.context.get(DocumentAssets);

		return (
			<html lang={locale} class="system">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<ImportMap value={script.importMap} nonce={nonce} />
					{seo ? <Seo title={title} site={SEO.site} {...seo} /> : title && <title>{title}</title>}
					{script.preloads.map((href) => (
						<link key={href} rel="modulepreload" href={href} />
					))}
					{preload.map((asset) => (
						<link
							key={`${asset.href}-${asset.media ?? ""}`}
							rel="preload"
							href={asset.href}
							as={asset.as}
							media={asset.media}
						/>
					))}
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} />
					))}
					<style>{fontFaceCss}</style>
				</head>
				<body mix={[m(0), bg("neutral.bg-tint"), fg("neutral.emphasis"), font("mono")]}>
					{children}
					<script type="module" async src={script.href}></script>
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
