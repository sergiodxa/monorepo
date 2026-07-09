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

import * as s from "~/resources/styles";

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
				<body mix={[s.documentBody]}>
					{children}
					<script type="module" src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
