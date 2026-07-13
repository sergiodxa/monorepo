/**
 * Root HTML document layout for the r3-uptime app. It renders the outer html/head/body
 * shell with charset and viewport meta tags, an optional page title, and the client
 * entry script, switching between the dev source and the built asset path. It exists
 * as the shared document wrapper every server-rendered page is composed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import { neutral } from "~/resources/theme";

/** App-wide monospace font stack rendered on `<body>` by default. */
const fontMono =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	export interface Props {
		children: RemixNode;
		title?: string;
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`, with an optional `<title>` and the client entry script. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { title, children } = handle.props;

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					{title && <title>{title}</title>}
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} />
				</head>
				<body
					mix={[
						css({
							margin: 0,
							background: neutral[50],
							color: neutral[950],
							fontFamily: fontMono,
							"@media (prefers-color-scheme: dark)": {
								background: neutral[950],
								color: neutral[50],
							},
						}),
					]}
				>
					{children}
					{/* `async`, not the implicit defer of a plain module script — a deferred
					script waits for this whole streamed response to finish parsing, so a
					non-blocking Frame's later-arriving <template> would never get picked up
					until the slowest Frame on the page had already resolved. */}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
