/**
 * Root route module for the auth app. Registers the global middleware chain
 * (context storage, logger, i18next, drizzle, session), defines the HTML
 * document layout and stylesheet links, renders the app shell with a shared
 * confirm dialog, and provides the top-level error boundary for the whole app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ConfirmDialog } from "@pkg/ui";
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
import { loggerMiddleware } from "./middleware/logger";
import { sessionMiddleware } from "./middleware/session";
import styles from "./styles.css?url";

export const middleware = [
	contextStorageMiddleware,
	loggerMiddleware,
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
		<html lang="en" className="system">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="min-h-dvh bg-white dark:bg-neutral-900">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return (
		<>
			<Outlet />
			<ConfirmDialog />
		</>
	);
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
