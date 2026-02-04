import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";

import { contextStorageMiddleware } from "~/middleware/context-storage";

import type { Route } from "./+types/root";

import { drizzleMiddleware } from "./middleware/drizzle";
import { i18nextMiddleware } from "./middleware/i18next";
import { sessionMiddleware } from "./middleware/session";
import styles from "./styles.css?url";

export const middleware = [
	contextStorageMiddleware,
	i18nextMiddleware,
	drizzleMiddleware,
	sessionMiddleware,
];

export const links: Route.LinksFunction = () => [
	{ rel: "preload", href: styles, as: "style" },
	{ rel: "stylesheet", href: styles },
];

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark:bg-gray-900">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
				{children}
				<ScrollRestoration />
				<Scripts />
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
		<main className="pt-16 p-4 container mx-auto">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full p-4 overflow-x-auto">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
