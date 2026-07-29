/**
 * Root HTML document layout for the r3-blog app. It renders the outer
 * html/head/body shell with charset and viewport meta tags, the page title, SEO
 * and per-page tags, the design-system stylesheets, and the client entry script,
 * switching between the dev source and the built asset path. It exists as the
 * shared document wrapper every server-rendered page is composed into, so the
 * two page shells — the public blog and the CMS — differ only in their own
 * chrome and never in how the document itself is assembled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import resetStyles from "@pkg/r3-ui/reset.css?url";
import themeStyles from "@pkg/r3-ui/theme.css?url";

import colorStyles from "~/resources/css/colors.css?url";

const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	/**
	 * A tag rendered in `<head>` beyond the document's own fixed set. Either
	 * `property` (which Open Graph and Twitter both use here) or `name` identifies
	 * it, and `content` carries the value.
	 */
	export interface MetaTag {
		property?: string;
		name?: string;
		content: string;
	}

	/**
	 * One page-specific stylesheet, linked after the design system's own so a page
	 * can override the system where it needs to — the post page's code-block theme
	 * is the only current case.
	 */
	export interface Stylesheet {
		href: string;
		media?: string;
	}

	export interface Props {
		children: RemixNode;
		title: string;
		/** The document's language, set as `<html lang>`. Defaults to `"en"`. */
		locale?: string;
		/** Meta description. Omitted inside the CMS, which has nothing to say to a crawler. */
		description?: string;
		/** The page's canonical absolute URL, when it differs from the request URL. */
		canonical?: string;
		/**
		 * Open Graph and Twitter card tags. Built by the page's view model rather
		 * than derived here, since the set differs per page type and the models
		 * already own the URL and title strings those tags restate.
		 */
		meta?: Array<MetaTag>;
		stylesheets?: Array<Stylesheet>;
		/**
		 * Styling for `<body>` itself, which the two shells genuinely disagree on:
		 * the public pages set a serif face over a fixed parchment gradient, the CMS
		 * a sans face on a flat tint. It has to land on `<body>` rather than an inner
		 * wrapper so the gradient covers the viewport even when the content is
		 * shorter than the screen.
		 */
		bodyMix?: TagProps<"body">["mix"];
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`, with the page's head tags and the client entry script. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let {
			bodyMix,
			canonical,
			children,
			description,
			locale = "en",
			meta = [],
			stylesheets = [],
			title,
		} = handle.props;

		return (
			<html lang={locale}>
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					{description && <meta name="description" content={description} />}
					{canonical && <link rel="canonical" href={canonical} />}
					{meta.map((tag) => (
						<meta
							key={tag.property ?? tag.name ?? tag.content}
							property={tag.property}
							name={tag.name}
							content={tag.content}
						/>
					))}
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} />
					{/* Order matters: reset first, then this app's own --ui-color-* scales,
					then the semantic theme tokens that read them through `var()` — CSS
					custom properties resolve at used-value time, so declaration order
					between these three doesn't actually affect which value wins, but
					reading them least-specific-to-most mirrors the token layering. Page
					stylesheets come last, so a page can override the system. */}
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={colorStyles} />
					<link rel="stylesheet" href={themeStyles} />
					{stylesheets.map((item) => (
						<link
							key={item.href + (item.media ?? "")}
							rel="stylesheet"
							href={item.href}
							media={item.media}
						/>
					))}
				</head>
				<body mix={bodyMix}>
					{children}
					{/* `async`, not the implicit defer of a plain module script — a deferred
					script waits for this whole streamed response to finish parsing, so a
					non-blocking Frame's later-arriving <template> would never get picked up
					until the slowest Frame on the page had already resolved.

					Nothing on any page hydrates, so this script is pure enhancement: it
					intercepts same-origin navigations through the Navigation API so moving
					between pages swaps the document instead of reloading it, and it resolves
					`<Frame>` content the server streamed as an empty placeholder (the post
					page's related-posts frame). Without it every link is just an ordinary
					full-page navigation. */}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
