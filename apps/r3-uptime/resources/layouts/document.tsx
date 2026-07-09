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

/** Neutral scale shades used on this page, hue 145. */
const neutral = { 50: "oklch(0.98 0.005 145)", 950: "oklch(0.16 0.004 145)" };

/** App-wide monospace font stack — the OLD APP renders `<body>` in `font-mono` by default. */
const fontMono =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	export interface Props {
		children: RemixNode;
		title?: string;
	}
}

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
					<script type="module" src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
