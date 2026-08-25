/**
 * Root HTML document shell for the blog app: the html/head/body frame with
 * charset, viewport, title, SEO tags and every stylesheet the app ships. Each
 * server-rendered page composes into it, so the page shells vary only in their
 * own chrome while the document itself is assembled one way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { colorScheme } from "@pkg/u/color";
import resetStyles from "@pkg/ui/reset.css?url";
import themeStyles from "@pkg/ui/theme.css?url";

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
		/** Meta description, supplied by the pages that crawlers index. */
		description?: string;
		/** The page's canonical absolute URL, when it differs from the request URL. */
		canonical?: string;
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
			bodyMix,
			canonical,
			children,
			description,
			locale = "en",
			meta = [],
			title,
		} = handle.props;

		return (
			<html lang={locale} class="system" mix={[colorScheme("light dark")]}>
				<head>
					<meta charSet="utf-8" data-key="charset" />
					<meta name="viewport" content="width=device-width, initial-scale=1" data-key="viewport" />
					<meta
						name="theme-color"
						media="(prefers-color-scheme: light)"
						content="oklch(0.98 0.004 250)"
						data-key="theme-color-light"
					/>
					<meta
						name="theme-color"
						media="(prefers-color-scheme: dark)"
						content="oklch(0.16 0.006 250)"
						data-key="theme-color-dark"
					/>
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
				<body mix={bodyMix}>{children}</body>
			</html>
		);
	};
}
