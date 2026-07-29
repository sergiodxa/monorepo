/**
 * Root HTML document layout for the r3-blog app. It renders the outer
 * html/head/body shell with charset and viewport meta tags, the page title, SEO
 * tags and every stylesheet the app ships. It exists as the
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
import { colorScheme } from "@pkg/u/color";

import colorStyles from "~/resources/css/colors.css?url";
import prismStyles from "~/resources/css/prism.css?url";

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
		 * the public pages set a serif face over the silver sheen, the CMS a sans face
		 * on a flat tint. It has to land on `<body>` rather than an inner wrapper so
		 * the gradient covers the viewport even when the content is shorter than the
		 * screen.
		 */
		bodyMix?: TagProps<"body">["mix"];
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`, with the page's head tags. */
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
			/* Two halves of the same switch, and both are needed.

			`system` opts the theme layer into `prefers-color-scheme` — it is the class
			that layer's own dark blocks are gated on, so without it only the light
			`:root` block ever applies no matter what the visitor prefers. A literal
			`dark` would force the scheme instead; this follows the OS.

			`colorScheme("light dark")` covers what the theme layer cannot reach: the
			chrome the *browser* paints rather than our own CSS — scrollbars, the canvas
			behind the document, `<select>` dropdowns, date pickers, number-input
			spinners, and native control borders. Without it a fully dark page still
			renders a white scrollbar and light form controls, which the CMS is full of.
			Declared once here because `color-scheme` inherits. */
			<html lang={locale} class="system" mix={[colorScheme("light dark")]}>
				{/* Every child carries `data-key`, which is what the client runtime's DOM
				diff matches head children on; without it the diff falls back to matching
				by position and only reuses a node when the tag names line up. Kept even
				though no client runtime is loaded right now (see the note by `<body>`), so
				re-enabling it does not silently reintroduce a head-diff bug.

				The fixed tags are also listed before the variable-length ones, so their
				positions never move even if the keying is ever lost. */}
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
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
				{/* No client entry script, so every link is an ordinary full page load and
				this app is SSR-only again.

				It was loaded briefly to get SPA-style navigation, and on Safari that made
				navigating out of a post flash unstyled for a frame. The cause is in the
				runtime's style manager rather than in this app: it keeps every generated
				atomic rule in one constructed `adoptedStyleSheets` entry and, on each
				navigation, releases the rules the incoming page does not use — 57 of 145
				leaving a post, whose article panel, badges and code theme are styling no
				other page shares. Safari repaints during that `deleteRule` churn. It is
				one-directional for the same reason: navigating *into* a post only inserts.

				Four attempts did not fix it — keying the head children, moving the
				code-block theme onto every page, and wrapping the swap in a view
				transition, which should have made any intermediate paint invisible and did
				not. Nothing reachable from app code prevents the release itself, and a
				full-page load costs little here: the documents are small, every stylesheet
				is cached, and the browser's own atomic swap has no flash by construction.

				Restoring it is a one-line change plus re-rendering `NavigationIndicator`
				(see commit 15c350bf) — worth revisiting once the runtime releases styles
				after the body swap rather than before it, or if the styles can be emitted
				as a static stylesheet that is never released. */}
				<body mix={bodyMix}>{children}</body>
			</html>
		);
	};
}
