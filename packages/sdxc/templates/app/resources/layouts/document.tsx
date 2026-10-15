/**
 * The HTML document every page renders inside: the head tags, the page title, and the
 * stylesheets imported below in cascade order. The client entry is linked only by a page
 * that carries an island.
 */

import type { Handle, RemixNode } from "remix/component";
import type { DocumentAssets } from "sdxc/assets-middleware";

import { css } from "remix/component";
import { ImportMap } from "remix/component/server";

import "sdxc/ui/reset.css";
import "sdxc/ui/theme.css";

namespace DocumentLayout {
	export interface Props {
		/** The page's content, rendered inside `<main>`. */
		children: RemixNode;
		/** The stylesheets and client entry the request resolved, from `ctx.assets`. */
		assets: DocumentAssets;
		title: string;
		/** Whether the page carries an island, the only reason to link the client entry. */
		hydrates?: boolean;
	}
}

/** Renders the `<html>`, `<head>` and `<body>` shell around a page. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { assets, children, hydrates = false, title } = handle.props;
		let { script, stylesheets } = assets;

		return (
			<html lang="en" class="system">
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
					{hydrates ? <ImportMap value={script.importMap} /> : null}
				</head>
				<body>
					<main mix={css({ maxInlineSize: "48rem", marginInline: "auto", padding: "1.5rem" })}>
						{children}
					</main>
					{hydrates ? <script type="module" src={script.href}></script> : null}
				</body>
			</html>
		);
	};
}
