/**
 * The dashboard's document shell view: a minimal HTML page wrapper that sets the
 * title, injects the CSS reset and base styles, renders its children, and loads the
 * client hydration bundle so server-rendered pages become interactive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, RemixNode } from "remix/ui";

import * as s from "./styles";

/**
 * URL of the client hydration bundle emitted by the Vite `client` build
 * environment (`bootstrap/browser.ts` → `dist/client/assets/clientEntry.js`,
 * served by the `ASSETS` binding). Matches r3-blog's `/assets/[name].js`
 * asset-path convention.
 */
let CLIENT_ENTRY_SRC = "/assets/clientEntry.js";

/**
 * Minimal dashboard document shell, styled with `remix/ui` `css()` mixins. Wraps page
 * content in a full HTML document with a titled `<head>`, the base styles, and the
 * client hydration script.
 *
 * @param handle The `remix/ui` handle providing `title` and `children` props.
 * @returns A render function producing the page's HTML tree.
 * @example
 * return ctx.render(
 *   <Page title="Dashboard">
 *     <h1>Your blogs</h1>
 *   </Page>,
 * );
 */
export function Page(handle: Handle<{ title: string; children: RemixNode }>) {
	return () => {
		let { title, children } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title} · Blog SaaS</title>
					<style>{s.RESET_CSS}</style>
				</head>
				<body mix={[s.body]}>
					{children}
					<script async type="module" src={CLIENT_ENTRY_SRC} />
				</body>
			</html>
		);
	};
}
