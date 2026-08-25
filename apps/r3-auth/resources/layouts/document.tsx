/**
 * The HTML document every server-rendered page is wrapped in. Declares the palette on
 * the root element, loads the component library's reset and semantic token layers, and
 * opts the page into the viewer's color scheme, so a view only has to describe itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { container } from "@pkg/u/layout";
import resetStyles from "@pkg/ui/reset.css?url";
import themeStyles from "@pkg/ui/theme.css?url";

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
		 * Whether the client runtime is loaded. `false` omits the `modulepreload`
		 * hint and the module script, so the response ships as static HTML — required
		 * by pages whose contract forbids script, such as front-channel logout.
		 *
		 * @default true
		 */
		clientRuntime?: boolean;
	}
}

/**
 * Renders the `<html>`/`<head>`/`<body>` shell around a page. `class="system"`
 * makes the token layer's dark rules follow `prefers-color-scheme`, and the
 * reset stylesheet loads first so the theme layer's rules win the cascade.
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
