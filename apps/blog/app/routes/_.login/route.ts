/**
 * Legacy login route for the blog. Its loader simply redirects requests from the
 * old `/login` path to the current `/auth/login` route. It exists to preserve the
 * previous login URL and keep any existing links or bookmarks working.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { href, redirect } from "react-router";

export function loader() {
	return redirect(href("/auth/login"));
}
