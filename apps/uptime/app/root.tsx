import { createLoggerMiddleware } from "@pkg/logger";
import NProgress from "nprogress";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from "react-router";
import { useGlobalPendingState } from "remix-utils/use-global-navigation-state";
import { Toaster } from "sonner";

import sansFont from "~/assets/fonts/sans.woff2";
import styles from "~/assets/styles.css?url";
import { contextStorageMiddleware } from "~/middleware/context-storage";
import { drizzleMiddleware } from "~/middleware/drizzle";
import { i18nextMiddleware } from "~/middleware/i18next";
import { serverTimingMiddleware } from "~/middleware/server-timing";
import { sessionMiddleware } from "~/middleware/session";
import { ClientHintCheck, getHints } from "~/utils/client-hints";

import type { Route } from "./+types/root";

export const middleware = [
	contextStorageMiddleware,
	createLoggerMiddleware(),
	i18nextMiddleware,
	drizzleMiddleware,
	sessionMiddleware,
	serverTimingMiddleware,
];

export const links: Route.LinksFunction = () => [
	{ rel: "preload", href: sansFont, as: "font" },
	{ rel: "preload", href: styles, as: "style" },
	{ rel: "stylesheet", href: styles },
];

export async function loader({ request }: Route.LoaderArgs) {
	let hints = getHints(request);
	return { hints, nonce: crypto.randomUUID() };
}

export function Layout({ children }: { children: React.ReactNode }) {
	let { i18n } = useTranslation();
	let state = useGlobalPendingState();

	useEffect(() => {
		NProgress.configure({ showSpinner: false });
		if (state === "pending") NProgress.start();
		if (state === "idle") NProgress.done();
		return () => void NProgress.done();
	}, [state]);

	return (
		<html lang={i18n.language} dir={i18n.dir(i18n.language)} className="h-full">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<Links />
			</head>
			<body className="flex min-h-dvh flex-col bg-neutral-50 font-sans text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
				{children}
				<Toaster richColors />
				<ScrollRestoration />
				<Scripts />
				{process.env.NODE_ENV === "production" ? (
					<script
						defer
						src="https://static.cloudflareinsights.com/beacon.min.js"
						data-cf-beacon='{"token": "2e915da0d572432eb502c32794ac1da6"}'
					/>
				) : null}
			</body>
		</html>
	);
}

export default function App({ loaderData }: Route.ComponentProps) {
	return (
		<>
			<ClientHintCheck nonce={loaderData.nonce} />
			<Outlet />
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
