import { isRouteErrorResponse, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import styles from "./app.css?url";

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="bg-white text-black dark:bg-stone-900 dark:text-stone-100">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>React Router OAuth2 Handbook</title>
				<link rel="shortcut icon" href="/favicon.ico" />
				<link rel="stylesheet" href={styles} />
				<meta
					name="description"
					content="A practical guide to implementing secure OAuth2 authentication in React Router and Remix applications."
				/>
				<meta property="og:title" content="React Router OAuth2 Handbook" />
				<meta
					property="og:description"
					content="Implement secure OAuth2 authentication in React Router and Remix apps with practical patterns."
				/>
				<meta property="og:image" content="https://books.sergiodxa.com/og.jpg" />
				<meta property="og:url" content="https://books.sergiodxa.com" />
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
				<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
			</head>
			<body className="flex min-h-dvh w-full flex-col items-center justify-center font-sans">
				{children}
				<ScrollRestoration />
				<Scripts />
				<script
					defer
					src="https://static.cloudflareinsights.com/beacon.min.js"
					data-cf-beacon='{"token": "4037e619e61b4e5a894789c3c98da9ab"}'
				/>
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404 ? "The requested page could not be found." : error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="container mx-auto p-4 pt-16">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full overflow-x-auto p-4">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
