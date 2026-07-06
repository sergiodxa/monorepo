/**
 * Index route for the /auth section that dispatches based on session state. Its
 * loader redirects authenticated users to the logout flow and anonymous users
 * to the login page, so /auth always resolves to the contextually correct auth
 * action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { href, redirect } from "react-router";

import { getUser } from "~/middleware/session";

export async function loader() {
	let user = getUser();
	if (user) return redirect(href("/auth/logout"));
	return redirect(href("/auth/login"));
}
