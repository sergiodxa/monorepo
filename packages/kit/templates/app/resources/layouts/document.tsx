/**
 * The HTML document every page renders inside: the head tags, the page title, and the
 * stylesheets imported below in cascade order. The client entry is linked only by a page
 * that carries an island.
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { I18n } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { IntlProvider } from "@sdxc/i18n/ui";
import { css } from "remix/component";
import { ImportMap } from "remix/component/server";

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
		/** Whether the page carries an island, the only reason to link the client entry. */
		hydrates?: boolean;
	}
}

/** Renders the `<html>`, `<head>` and `<body>` shell around a page. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { assets, children, hydrates = false, intl, title } = handle.props;
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
					<title data-rmx-key="title">{title}</title>
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
