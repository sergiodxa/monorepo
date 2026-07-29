/**
 * Root HTML document layout for the r3-blog app. It renders the outer
 * html/head/body shell with charset and viewport meta tags, the page title, SEO
 * tags, every stylesheet the app ships, and the client entry script, switching
 * between the dev source and the built asset path. It exists as the
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

import { NavigationIndicator } from "~/resources/components/navigation-indicator";
import colorStyles from "~/resources/css/colors.css?url";
import prismStyles from "~/resources/css/prism.css?url";

const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

/**
 * Accessible name for the pending-navigation bar. A literal rather than a
 * localized string because this app ships no i18n layer; it is the one piece of
 * copy the document itself owns.
 */
const NAVIGATION_INDICATOR_LABEL = "Loading page";

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
			title,
		} = handle.props;

		return (
			/* `system` opts the theme layer into `prefers-color-scheme` — it is the
			class that layer's own dark blocks are gated on, so without it only the
			light `:root` block ever applies no matter what the visitor prefers. A
			literal `dark` would force the scheme instead; this follows the OS. */
			<html lang={locale} class="system">
				{/* Every child carries `data-key`, which is what the client runtime's DOM
				diff matches head children on; without it the diff falls back to matching
				by position and only reuses a node when the tag names line up. Pages here
				disagree on how many head tags they have — a post adds a canonical link and
				nine Open Graph/Twitter tags that no other page has — so a positional diff
				lined a stylesheet `<link>` up against a `<meta>`, replaced it, and made the
				browser re-fetch and re-apply the design system's stylesheets mid-navigation.
				That was a visible flash of unstyled content on every navigation into or out
				of a post. Keying makes the diff identity-based, so adding or dropping a tag
				leaves every other tag's element untouched.

				The fixed tags are also listed before the variable-length ones, so their
				positions never move even if the keying is ever lost. */}
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} data-key="client-entry" />
					{/* Order matters: reset first, then this app's own --ui-color-* scales,
					then the semantic theme tokens that read them through `var()` — CSS
					custom properties resolve at used-value time, so declaration order
					between these three doesn't actually affect which value wins, but
					reading them least-specific-to-most mirrors the token layering.

					The code-block theme comes last so it still outranks the system, and it
					loads on every page rather than only on posts. It used to be a per-page
					stylesheet, which meant this render-blocking `<link>` was inserted when
					navigating into a post and removed when navigating back out — and
					adding or removing a render-blocking stylesheet mid-navigation forces a
					full style recalculation of a document whose markup is still the old
					page's. Posts were the only pages with a per-page stylesheet, which is
					exactly the set of navigations that flashed. It is ~1.3 KB over the wire
					and cached after the first page, so serving it everywhere is cheaper than
					the churn was. */}
					<link rel="stylesheet" href={resetStyles} data-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-key="style-palette" />
					<link rel="stylesheet" href={themeStyles} data-key="style-theme" />
					<link rel="stylesheet" href={prismStyles} data-key="style-code" />
					<title data-key="title">{title}</title>
					{description && <meta name="description" content={description} data-key="description" />}
					{canonical && <link rel="canonical" href={canonical} data-key="canonical" />}
					{meta.map((tag) => {
						let identity = tag.property ?? tag.name ?? tag.content;

						return (
							<meta
								key={identity}
								data-key={`meta:${identity}`}
								property={tag.property}
								name={tag.name}
								content={tag.content}
							/>
						);
					})}
				</head>
				<body mix={bodyMix}>
					{/* First in the body so it paints above the page without needing to be
					repositioned, and so it survives as the first diffed node when the
					client runtime swaps the document's content on navigation. */}
					<NavigationIndicator label={NAVIGATION_INDICATOR_LABEL} />
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
