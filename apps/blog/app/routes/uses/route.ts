/**
 * Legacy redirect route for the "/uses" path. Its loader permanently forwards
 * visitors to the "/articles/uses" article. Exists to preserve an old URL and keep
 * inbound links and bookmarks working after the content moved under /articles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "react-router";

export function loader() {
	return redirect("/articles/uses");
}
