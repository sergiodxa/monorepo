/**
 * The HTML document every server-rendered page is wrapped in. Declares the palette on
 * the root element, imports the component library's reset and semantic token layers below in
 * cascade order, and opts the page into the viewer's color scheme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { container } from "@sdxc/u/layout";
import { ImportMap } from "remix/component/server";

import type { DocumentAssets as Assets } from "~/app/lib/assets";

import { DOCUMENT, THEME } from "~/resources/styles";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

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
		children: RemixNode;
		/** Document title. Omitted for pages whose whole body is a redirect mechanism. */
		title?: string;
		/**
		 * Extra `<head>` content, for a page that has to declare something of its own —
		 * a `<meta http-equiv="refresh">`, say. Rendered after the stylesheets.
		 */
		head?: RemixNode;
		/**
		 * Whether the client runtime is loaded. `false` omits the import map, the
		 * `modulepreload` hints and the module script, so the response ships as static
		 * HTML — required by pages whose contract forbids script, such as front-channel logout.
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
		let { script, stylesheets } = handle.context.get(DocumentAssets);

		return (
			<html lang="en" class="system" mix={[THEME, DOCUMENT]}>
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					{title && <title>{title}</title>}
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} />
					))}
					{clientRuntime && (
						<>
							<ImportMap value={script.importMap} />
							{script.preloads.map((href) => (
								<link key={href} rel="modulepreload" href={href} />
							))}
						</>
					)}
					{head}
				</head>
				<body mix={[DOCUMENT, container("page")]}>
					{children}
					{clientRuntime && <script type="module" src={script.href}></script>}
				</body>
			</html>
		);
	};
}
