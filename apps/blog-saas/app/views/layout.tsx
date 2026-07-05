import type { Handle, RemixNode } from "remix/ui";

import * as s from "./styles";

/**
 * URL of the client hydration bundle emitted by the Vite `client` build
 * environment (`bootstrap/browser.ts` → `dist/client/assets/clientEntry.js`,
 * served by the `ASSETS` binding). Matches r3-blog's `/assets/[name].js`
 * asset-path convention.
 */
let CLIENT_ENTRY_SRC = "/assets/clientEntry.js";

/** Minimal dashboard document shell, styled with `remix/ui` `css()` mixins. */
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
