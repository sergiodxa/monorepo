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
		/**
		 * Extra `<head>` content, for a page that has to declare something of its own —
		 * a `<meta http-equiv="refresh">`, say. Rendered after the stylesheets.
		 */
		head?: RemixNode;
		/**
		 * Whether the client runtime is loaded. `false` omits both the `modulepreload`
		 * hint and the module script, so the response carries no JavaScript at all —
		 * which a page whose contract forbids script (front-channel logout) needs, and
		 * which any page holding no island may as well have.
		 *
		 * Defaults to `true`: a page carrying an island has to say nothing.
		 */
		clientRuntime?: boolean;
	}
}

/**
 * Renders the `<html>`/`<head>`/`<body>` shell around a page.
 *
 * `class="system"` is what makes the token layer's dark rules follow
 * `prefers-color-scheme`; without it only the light values ever apply. `<body>`
 * establishes the container every responsive layout in the app queries against, so a
 * page's breakpoints read the document's own width rather than the viewport's.
 *
 * Styling and script are separable here on purpose: `clientRuntime={false}` still gets
 * the palette, the reset and the token layer, so a page that must ship zero JavaScript
 * no longer has to render its own unstyled document to get there.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { children, title, head, clientRuntime = true } = handle.props;

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
					{clientRuntime && <link rel="modulepreload" href={CLIENT_ENTRY_SRC} />}
					{head}
				</head>
				<body mix={[DOCUMENT, container("page")]}>
					{children}
					{clientRuntime && <script type="module" src={CLIENT_ENTRY_SRC}></script>}
				</body>
			</html>
		);
	};
}
