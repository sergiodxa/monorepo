/**
 * Root HTML document layout: the html/head/body shell with charset and viewport meta, the
 * title and description, and the stylesheets, import map and client entry the asset manifest
 * names. Every server-rendered page composes into it, so a page decides only its content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { bg, colorScheme, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m, minBs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { ImportMap } from "remix/component/server";
import { getContext } from "remix/middleware/async-context";

import type { Theme } from "~/database/schema";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/**
 * What the browser is told each scheme paints its own chrome in. `system` declares both so
 * the page follows the preference; a forced choice pins one, which is what keeps a dark
 * page from being given a light scrollbar, light form controls and a light media player.
 */
const CHROME_SCHEME: Record<Theme, string> = {
	system: "light dark",
	light: "only light",
	dark: "only dark",
};

namespace DocumentLayout {
	export interface Props {
		/**
		 * The stylesheets, client entry and nonce a page passes on from `ctx.assets`; the nonce
		 * goes on the inline import map, the one script the policy admits by nonce.
		 */
		assets: DocumentAssets;
		/** The page's content, rendered inside `<body>`. */
		children: RemixNode;
		/** The document title. */
		title: string;
		/** Meta description for this page. */
		description?: string;
		/** The request's detected language (`ctx.locale`), set as `<html lang>`. */
		locale?: string;
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. The client entry
 * loads `async`, so a non-blocking Frame's `<template>` is picked up as soon as its chunk
 * of the streamed response arrives.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { assets, children, description, locale = "en", title } = handle.props;

		/**
		 * Read off the request rather than taken as a prop, since every page in the app
		 * composes into this shell and none of them has an opinion about the scheme it is
		 * painted in.
		 */
		let { face, theme } = getContext().presentation;
		let { nonce, script, stylesheets } = assets;

		return (
			<html
				lang={locale}
				/**
				 * The scheme's own name, which is precisely the vocabulary the theme layer reads
				 * off an ancestor, so nothing is translated between the stored answer and this.
				 */
				class={theme}
				data-face={face}
				mix={[colorScheme(CHROME_SCHEME[theme])]}
			>
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
					{/**
					 * What a publisher's host learns when this page fetches from it — an image, or
					 * the media file a player opens. The origin and nothing past it, so the address
					 * of the post a reader is on never reaches somebody else's logs.
					 */}
					<meta name="referrer" content="strict-origin-when-cross-origin" data-key="referrer" />
					<title data-key="title">{title}</title>
					{description ? (
						<meta name="description" content={description} data-key="description" />
					) : null}
					{/**
					 * A manifest earns its place here because a browser needs one before it will
					 * keep a push subscription: it names the scope the service worker registers
					 * under and the page a notification opens into.
					 */}
					<link rel="manifest" href="/manifest.webmanifest" data-key="manifest" />
					<ImportMap value={script.importMap} nonce={nonce} />
					{script.preloads.map((href) => (
						<link key={href} rel="modulepreload" href={href} data-key={href} />
					))}
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-key={href} />
					))}
				</head>
				<body
					mix={[
						m(0),
						minBs("100dvh"),
						bg("neutral.bg-tint"),
						fg("neutral.emphasis"),
						font("sans"),
						/**
						 * The one place this app grows the document above the reader — a page of posts
						 * arriving as they scroll back up a list — measures that growth and scrolls by it,
						 * so the reading queue holds its place in every browser rather than only in the
						 */
						raw({ overflowAnchor: "none" }),
					]}
				>
					{children}
					<script type="module" async src={script.href}></script>
				</body>
			</html>
		);
	};
}
