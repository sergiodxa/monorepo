/**
 * Layout route for the public marketing pages. It wraps its child routes' `Outlet`
 * with the shared landing header and footer, and its loader exposes the viewer's
 * signed-in state so nested pages can tailor calls to action. It exists to provide
 * consistent chrome and shared session data across the landing site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Outlet } from "react-router";

import { LandingFooter, LandingHeader } from "~/components/landing";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/_landing";

export function loader() {
	let session = getSession();
	return {
		isSignedIn: session.has("id"),
	};
}

export default function LandingLayout({ loaderData }: Route.ComponentProps) {
	let { isSignedIn } = loaderData;

	return (
		<div className="min-h-screen bg-white font-sans dark:bg-neutral-950">
			<LandingHeader isSignedIn={isSignedIn} />
			<main>
				<Outlet />
			</main>
			<LandingFooter />
		</div>
	);
}
