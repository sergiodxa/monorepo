/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags,
 * the page title and description, every stylesheet the site ships, and the client
 * runtime entry. Every server-rendered page composes into it, so a page decides only
 * its own content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import highlightStyles from "@sdxc/highlight/styles.css?url";
import { Seo } from "@sdxc/seo";
import { bg, colorScheme, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m, minBs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import resetStyles from "@sdxc/ui/reset.css?url";
import themeStyles from "@sdxc/ui/theme.css?url";

import type { OptionSelections } from "~/app/services/option-groups";
import type { Sponsor } from "~/app/services/sponsors";

import { seo, SITE_URL } from "~/app/services/site";
import OptionGroupScope from "~/resources/components/option-groups";
import SiteFooter from "~/resources/components/site-footer";
import colorStyles from "~/resources/css/colors.css?url";

/**
 * The dev server serves the entry from source; the built client writes it to a stable
 * name, so the tag can name the file rather than resolve it through a manifest.
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
		/** The page's canonical absolute URL. */
		canonical?: string;
		/** What the page is, for a social card: an article rather than the site itself. */
		og?: Seo.OpenGraph;
		/**
		 * The option the reader picked in each named group, which every strip on the
		 * page renders itself from. A page carrying no such strip leaves it out.
		 */
		selections?: OptionSelections;
		/**
		 * The people the closing bar names. A page renders the bar whether or not there
		 * are any, and the block inside it draws nothing while the list is empty.
		 */
		sponsors?: Sponsor[];
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. Dark mode is
 * CSS-only: the `system` class is what the theme layer keys its system-preference
 * branch on, so no script decides the scheme and nothing flashes on first paint.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { canonical, children, description, og, selections, sponsors = [], title } = handle.props;

		return (
			<html lang="en" class="system" mix={[colorScheme("light dark")]}>
				<head>
					<meta charSet="utf-8" data-rmx-key="charset" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1"
						data-rmx-key="viewport"
					/>
					{/*
					 * Whichever host served the request — a preview, the workers.dev name, the
					 * custom domain — the canonical URL names one origin, so the same page read
					 * from two hosts is one page to a crawler and to a model.
					 */}
					<Seo.Meta
						title={title}
						description={description}
						canonical={seo.canonical(canonical ?? SITE_URL)}
						site={seo.site}
						og={og}
					/>
					{/* Reset first, then the palette, then the semantic tokens that read it through `var()`. */}
					<link rel="stylesheet" href={resetStyles} data-rmx-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-rmx-key="style-palette" />
					<link rel="stylesheet" href={themeStyles} data-rmx-key="style-theme" />
					<link rel="stylesheet" href={highlightStyles} data-rmx-key="style-highlight" />
				</head>
				<body mix={[m(0), vstack({ align: "center" }), minBs("100dvh"), font("sans"), bg(), fg()]}>
					<OptionGroupScope selections={selections}>
						{children}
						<SiteFooter sponsors={sponsors} />
					</OptionGroupScope>
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
