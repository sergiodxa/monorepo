import type { Handle, RemixNode } from "remix/ui";

import * as s from "./styles";

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
				<body mix={[s.body]}>{children}</body>
			</html>
		);
	};
}
