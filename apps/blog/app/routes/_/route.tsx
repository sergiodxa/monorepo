/**
 * Top-level public layout route. It renders the shared Header above an Outlet for
 * child pages, preloads the avatar image via a links function, and provides an
 * ErrorBoundary that maps 404s and other errors to a friendly title. Exists as the
 * common chrome wrapping all non-CMS pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Outlet, isRouteErrorResponse, useRouteError } from "react-router";

import type { Route } from "./+types/route";

import avatarHref from "./avatar.png";
import { Header } from "./components/header";

export const links: Route.LinksFunction = () => [{ rel: "preload", as: "image", href: avatarHref }];

export default function Component() {
	return (
		<>
			<Header />

			<div className="p-4">
				<Outlet />
			</div>
		</>
	);
}

export function ErrorBoundary() {
	let error = useRouteError();

	let title = "Something went wrong";

	if (isRouteErrorResponse(error)) {
		title =
			error.status === 404 ? "Content not found" : (error.statusText ?? "Something went wrong");
	} else if (error instanceof Error) {
		title = error.message;
	}

	return (
		<>
			<Header />

			<article className="mx-auto prose flex max-w-screen-md flex-col gap-8 px-4 pt-20 pb-14 prose-blue dark:prose-invert">
				<header className="gap-4 md:flex md:items-start md:justify-between">
					<h1>{title}</h1>
				</header>
			</article>
		</>
	);
}
