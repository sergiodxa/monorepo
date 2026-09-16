/**
 * Root HTML document layout. It renders the outer html/head/body shell — charset and
 * viewport meta, the page title and description, the design-system stylesheets in
 * derivation order, and the client entry script. Every server-rendered page composes into
 * it, so a page decides only its own content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, colorScheme, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m, minBs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import resetStyles from "@sdxc/ui/reset.css?url";
import themeStyles from "@sdxc/ui/theme.css?url";
import { getContext } from "remix/middleware/async-context";

import type { Theme } from "~/database/schema";

import colorStyles from "~/resources/css/colors.css?url";

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

/**
 * The dev server serves the entry from source while the build emits it under a pinned
 * name, so the tag resolves without reading a manifest at render time.
 */
const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	export interface Props {
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
		let { children, description, locale = "en", title } = handle.props;

		/**
		 * Read off the request rather than taken as a prop, since every page in the app
		 * composes into this shell and none of them has an opinion about the scheme it is
		 * painted in. The middleware resolved it before any controller ran, so the class is
		 * decided by the time the first byte is written.
		 */
		let { face, theme } = getContext().presentation;

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
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} data-key="entry-preload" />
					<link rel="stylesheet" href={resetStyles} data-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-key="style-colors" />
					<link rel="stylesheet" href={themeStyles} data-key="style-theme" />
				</head>
				<body
					mix={[
						m(0),
						minBs("100dvh"),
						bg("neutral.bg-tint"),
						fg("neutral.emphasis"),
						font("sans"),
						/**
						 * The one place this app grows the document above the reader — a page of
						 * posts arriving as they scroll back up a list — measures that growth and
						 * scrolls by it, so the reading queue holds its place in every browser
						 * rather than only in the ones that anchor scrolling themselves. Leaving
						 * the browser's own anchoring on would have the two corrections land
						 * together and carry the reader a screenful past where they were.
						 */
						raw({ overflowAnchor: "none" }),
					]}
				>
					{children}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
