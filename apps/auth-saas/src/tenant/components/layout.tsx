import type { RemixNode } from "remix/component";

interface LayoutProps {
	title?: string;
	children: RemixNode;
}

export function Layout() {
	return ({ children, title = "Auth SaaS" }: LayoutProps) => (
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
}
