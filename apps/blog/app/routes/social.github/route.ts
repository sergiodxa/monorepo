/**
 * Vanity redirect route for /social/github that sends visitors to the author's
 * GitHub profile. It exists to provide a short, memorable link to the external
 * profile without hardcoding the URL across the site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "react-router";

export async function loader() {
	return redirect("https://github.com/sergiodxa");
}
