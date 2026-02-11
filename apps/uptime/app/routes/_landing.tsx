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
