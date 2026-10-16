/**
 * The HTML document every page renders inside: the head tags, the page's title, description,
 * canonical link and link-preview tags, and the
 * stylesheets imported below in cascade order. The client entry is linked only by a page
 * that carries an island.
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { I18n } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { IntlProvider } from "@sdxc/i18n/ui";
import { Seo } from "@sdxc/seo";
import { css } from "remix/component";
import { ImportMap } from "remix/component/server";

import { seo } from "~/app/initializers/seo";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

namespace DocumentLayout {
	export interface Props {
		/** The page's content, rendered inside `<main>`. */
		children: RemixNode;
		/**
		 * The stylesheets, client entry and CSP nonce the request resolved, from `ctx.assets`;
		 * the nonce is read only when the page hydrates, for its inline import map.
		 */
		assets: DocumentAssets;
		/** The request's translator, from `ctx.intl`: it sets `<html lang>` and is what `intl(handle)` reads below it. */
		intl: I18n;
		title: string;
		/** The page's summary in search results and link previews; the site's description by default. */
		description?: string;
		/** The request's URL, from `ctx.url`, which the canonical link names on `SITE_URL`. */
		url: URL;
		/** Whether the page carries an island, the only reason to link the client entry. */
		hydrates?: boolean;
	}
}

/** Renders the `<html>`, `<head>` and `<body>` shell around a page. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { assets, children, description, hydrates = false, intl, title, url } = handle.props;
		let { script, stylesheets } = assets;

		return (
			<html lang={intl.locale} class="system">
				<head>
					<meta charSet="utf-8" data-rmx-key="charset" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1"
						data-rmx-key="viewport"
					/>
					<Seo.Meta
						title={title}
						description={description}
						canonical={seo.canonical(url)}
						site={seo.site}
						og={{ locale: intl.locale }}
					/>
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-rmx-key={href} />
					))}
					{hydrates ? <ImportMap value={script.importMap} nonce={assets.nonce} /> : null}
				</head>
				<body>
					<main mix={css({ maxInlineSize: "48rem", marginInline: "auto", padding: "1.5rem" })}>
						<IntlProvider intl={intl}>{children}</IntlProvider>
					</main>
					{hydrates ? <script type="module" src={script.href}></script> : null}
				</body>
			</html>
		);
	};
}
