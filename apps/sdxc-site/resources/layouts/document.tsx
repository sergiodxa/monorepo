/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags, the
 * page title and description, the stylesheets imported below in cascade order (reset,
 * palette, the tokens reading it, code highlighting), the client runtime entry, and the
 * analytics beacon.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { Seo } from "@sdxc/seo";
import { bg, colorScheme, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { m, minBs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font } from "@sdxc/u/typography";
import { ImportMap } from "remix/component/server";

import { seo } from "~/app/initializers/seo";
import { SOCIAL_CARD_SIZE, socialCardUrl } from "~/app/services/social-card";
import { SITE_DESCRIPTION, SITE_URL } from "~/config/constants";
import { RememberedTabsScope } from "~/resources/components/markdown-blocks";
import SiteFooter from "~/resources/components/site-footer";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/marketing.css";
import "@sdxc/highlight/styles.css";

/**
 * The Cloudflare Web Analytics site token — public by construction, since
 * browsers read it straight off the rendered attribute. Change it and
 * Cloudflare treats it as a new property, losing the analytics history.
 */
const CF_BEACON_TOKEN = "b4283f4956eb4c7cb755a263acdf26fe";

namespace DocumentLayout {
	export interface Props {
		/** The request's `ctx.assets`: the stylesheets, import map and client entry the head links. */
		assets: DocumentAssets;
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
		 * The request's `Cookie` header, which every remembered code-tab strip on the page
		 * opens on the reader's choice from. A page carrying no such strip leaves it out.
		 */
		cookie?: string | null;
		/** The `robots` meta directive, for a page search engines should leave out of results. */
		robots?: string;
		/** Whether the site footer closes the page; a page carrying its own footer turns it off. */
		siteFooter?: boolean;
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. Dark mode is
 * CSS-only: the `system` class is what the theme layer keys its system-preference
 * branch on, so no script decides the scheme and nothing flashes on first paint.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { assets, canonical, children, cookie, description, og, robots, siteFooter, title } =
			handle.props;
		let { script, stylesheets } = assets;
		let canonicalUrl = seo.canonical(canonical ?? SITE_URL);
		let card = canonical
			? {
					image: socialCardUrl({
						title,
						description: description ?? SITE_DESCRIPTION,
						path: new URL(canonicalUrl).pathname,
					}),
					imageAlt: title,
					imageWidth: SOCIAL_CARD_SIZE.width,
					imageHeight: SOCIAL_CARD_SIZE.height,
				}
			: {};

		return (
			<html
				lang="en"
				class="system"
				mix={[
					colorScheme("light dark"),

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

					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-rmx-key={href} />
					))}

					<Seo.Meta
						title={title}
						description={description}
						canonical={canonicalUrl}
						site={seo.site}
						og={{ ...card, ...og }}
						robots={robots}
					/>
					<ImportMap value={script.importMap} />
					{script.preloads.map((href) => (
						<link key={href} rel="modulepreload" href={href} data-rmx-key={href} />
					))}
				</head>
				<body mix={[m(0), vstack({ align: "center" }), minBs("100dvh"), font("sans"), bg(), fg()]}>
					<RememberedTabsScope cookie={cookie}>
						{children}
						{siteFooter === false ? null : <SiteFooter />}
					</RememberedTabsScope>
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
