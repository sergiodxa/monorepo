/**
 * CMS layout route. Its middleware gates access to admin users, redirecting everyone
 * else to the home page, and its component renders the shared Navigation above an
 * Outlet for the dashboard sections. Exists as the protected shell wrapping all CMS
 * pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Outlet, href, redirect } from "react-router";

import { getUser } from "~/middleware/session";

import type { Route } from "./+types/route";

import { Navigation } from "./nav";

export const middleware: Route.MiddlewareFunction[] = [
	(_, next) => {
		let user = getUser();
		if (user?.role === "admin") return next();
		return redirect(href("/"));
	},
];

export default function Component() {
	return (
		<main className="mx-auto -my-4 flex max-w-screen-xl flex-col gap-8">
			<Navigation />
			<Outlet />
		</main>
	);
}
