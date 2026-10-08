/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags, the
 * page title and description, the stylesheets imported below in cascade order (reset,
 * palette, the tokens reading it, code highlighting), and the client runtime entry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { Seo } from "@sdxc/seo";
import { bg, colorScheme, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { m, minBs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font } from "@sdxc/u/typography";
import { ImportMap } from "remix/component/server";

import type { DocumentAssets as Assets } from "~/app/services/assets";
import type { OptionSelections } from "~/app/services/option-groups";

import { seo, SITE_URL } from "~/app/services/site";
import OptionGroupScope from "~/resources/components/option-groups";
import SiteFooter from "~/resources/components/site-footer";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "@sdxc/highlight/styles.css";

/**
 * Hands the document the assets the renderer looked up, which it reads where a component
 * cannot await them itself.
 */
export function DocumentAssets(handle: Handle<{ value: Assets; children: RemixNode }, Assets>) {
	handle.context.set(handle.props.value);
	return () => handle.props.children;
}

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
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. Dark mode is
 * CSS-only: the `system` class is what the theme layer keys its system-preference
 * branch on, so no script decides the scheme and nothing flashes on first paint.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { canonical, children, description, og, selections, title } = handle.props;
		let { script, stylesheets } = handle.context.get(DocumentAssets);

		return (
			<html
				lang="en"
				class="system"
				mix={[
					colorScheme("light dark"),
					/* A modal holds the reader's attention, so the page behind it stays where it was left. */
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
					<ImportMap value={script.importMap} />
					{script.preloads.map((href) => (
						<link key={href} rel="modulepreload" href={href} data-rmx-key={href} />
					))}
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-rmx-key={href} />
					))}
				</head>
				<body mix={[m(0), vstack({ align: "center" }), minBs("100dvh"), font("sans"), bg(), fg()]}>
					<OptionGroupScope selections={selections}>
						{children}
						<SiteFooter />
					</OptionGroupScope>
					<script type="module" async src={script.href}></script>
				</body>
			</html>
		);
	};
}
