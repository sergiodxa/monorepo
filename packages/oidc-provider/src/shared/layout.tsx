/**
 * Shared HTML document shell for the provider's tenant-facing pages.
 *
 * Wraps page content in a full `<html>` document with base styles and the tenant
 * client entry script, so views like the home page render as a complete document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

/** Props for the {@link Layout} document shell. */
interface LayoutProps {
	/** Document title; defaults to `"Auth SaaS"`. */
	title?: string;
	/** Page body content rendered inside `<body>`. */
	children: RemixNode;
}

/**
 * Renders the shared HTML document shell for tenant-facing pages.
 * @param handle - Component handle exposing the layout props.
 * @returns A render function producing the document markup.
 * @example
 * <Layout title="Sign in">{content}</Layout>
 */
export function Layout(handle: Handle<LayoutProps>) {
	return () => {
		let { children, title = "Auth SaaS" } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					<style>
						{`
						@keyframes spin {
							to { transform: rotate(360deg); }
						}
						* {
							box-sizing: border-box;
						}
						body {
							margin: 0;
							font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
							line-height: 1.5;
							background-color: #f9fafb;
						}
					`}
					</style>
					<script async type="module" src="/assets/tenant/entry.js" />
				</head>
				<body>{children}</body>
			</html>
		);
	};
}
