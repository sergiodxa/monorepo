/**
 * Root HTML document shell for the blog app: the html/head/body frame with
 * charset, viewport, title, SEO tags, every stylesheet the app ships and the client
 * entry that hydrates its islands. Each page composes into it, so the page shells
 * vary only in their own chrome while the document itself is assembled one way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import highlightStyles from "@sdxc/highlight/styles.css?url";
import { colorScheme } from "@sdxc/u/color";
import { overflow } from "@sdxc/u/overflow";
import { when } from "@sdxc/u/state";
import resetStyles from "@sdxc/ui/reset.css?url";
import themeStyles from "@sdxc/ui/theme.css?url";

import { PROFILE } from "~/config/profile";
import colorStyles from "~/resources/css/colors.css?url";
import codeStyles from "~/resources/css/highlight.css?url";
import routes from "~/routes/web";

/**
 * The profiles `rel="me"` claims as the site owner's, which is how an IndieWeb reader
 * (or a profile page linking back) verifies the identity across sites.
 */
const REL_ME = [PROFILE.github.profile, PROFILE.x.profile, PROFILE.youtube.profile];

/**
 * The dev server serves the entry from source; the built client writes it to a stable
 * name, so the tag can name the file rather than resolve it through a manifest.
 */
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

	export interface Props {
		children: RemixNode;
		title: string;
		/** The document's language, set as `<html lang>`. Defaults to `"en"`. */
		locale?: string;
		/** Meta description, supplied by the pages that crawlers index. */
		description?: string;
		/** The page's canonical absolute URL, when it differs from the request URL. */
		canonical?: string;
		/**
		 * Where the page's ActivityStreams representation lives, advertised as an
		 * `alternate`, which Mastodon follows when someone pastes the page URL into search.
		 */
		activity?: string;
		/**
		 * Open Graph and Twitter card tags. The page's view model builds them: it
		 * owns the URL and title strings they carry, and knows which set the page
		 * type needs.
		 */
		meta?: Array<MetaTag>;
		/**
		 * Styling for `<body>` itself, where the two shells diverge: a serif face
		 * over the silver sheen, or a sans face on a flat tint. Landing it on
		 * `<body>` keeps the gradient covering the viewport for short pages.
		 */
		bodyMix?: TagProps<"body">["mix"];
	}
}

/**
 * `class="system"` gates the theme layer's dark blocks and `color-scheme` reaches
 * the chrome the browser paints itself. The `theme-color` literals track
 * `--ui-color-neutral-50`/`-950` by hand, since `content` takes a bare color.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let {
			activity,
			bodyMix,
			canonical,
			children,
			description,
			locale = "en",
			meta = [],
			title,
		} = handle.props;

		return (
			<html
				lang={locale}
				class="system"
				mix={[
					colorScheme("light dark"),
					/** A modal holds the reader's attention, so the page behind it stays where it was left. */
					when("&:has(dialog:modal)", overflow("hidden")),
				]}
			>
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
						content="oklch(0.98 0.004 250)"
						data-rmx-key="theme-color-light"
					/>
					<meta
						name="theme-color"
						media="(prefers-color-scheme: dark)"
						content="oklch(0.16 0.006 250)"
						data-rmx-key="theme-color-dark"
					/>
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} data-rmx-key="client-entry" />
					<link rel="stylesheet" href={resetStyles} data-rmx-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-rmx-key="style-palette" />
					<link rel="stylesheet" href={themeStyles} data-rmx-key="style-theme" />
					<link rel="stylesheet" href={highlightStyles} data-rmx-key="style-highlight" />
					<link rel="stylesheet" href={codeStyles} data-rmx-key="style-code" />
					<title data-rmx-key="title">{title}</title>
					{description && (
						<meta name="description" content={description} data-rmx-key="description" />
					)}
					{canonical && <link rel="canonical" href={canonical} data-rmx-key="canonical" />}
					{activity && (
						<link
							rel="alternate"
							type="application/activity+json"
							href={activity}
							data-rmx-key="activity"
						/>
					)}
					<link rel="webmention" href={routes.webmention.href()} data-rmx-key="webmention" />
					{REL_ME.map((href) => (
						<link key={href} rel="me" href={href} data-rmx-key={`me:${href}`} />
					))}
					{meta.map((tag) => {
						let identity = tag.property ?? tag.name ?? tag.content;

						return (
							<meta
								key={identity}
								data-rmx-key={`meta:${identity}`}
								property={tag.property}
								name={tag.name}
								content={tag.content}
							/>
						);
					})}
				</head>
				<body mix={bodyMix}>
					{children}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
