/**
 * The HTML document every server-rendered page is wrapped in. Declares the palette on
 * the root element, loads the component library's reset and semantic token layers, and
 * opts the page into the viewer's color scheme, so a view only has to describe itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import resetStyles from "@pkg/r3-ui/reset.css?url";
import themeStyles from "@pkg/r3-ui/theme.css?url";
import { container } from "@pkg/u/layout";

import { DOCUMENT, THEME } from "~/resources/styles";

/** The client runtime, served from source in development and from the build otherwise. */
const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	export interface Props {
		children: RemixNode;
		/** Document title. Omitted for pages whose whole body is a redirect mechanism. */
		title?: string;
	}
}

/**
 * Renders the `<html>`/`<head>`/`<body>` shell around a page.
 *
 * `class="system"` is what makes the token layer's dark rules follow
 * `prefers-color-scheme`; without it only the light values ever apply. `<body>`
 * establishes the container every responsive layout in the app queries against, so a
 * page's breakpoints read the document's own width rather than the viewport's.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { children, title } = handle.props;

		return (
			<html lang="en" class="system" mix={[THEME, DOCUMENT]}>
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					{title && <title>{title}</title>}
					{/* Reset first, then the semantic tokens that read the palette declared
					on this element through `var()`. */}
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={themeStyles} />
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} />
				</head>
				<body mix={[DOCUMENT, container("page")]}>
					{children}
					<script type="module" src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
