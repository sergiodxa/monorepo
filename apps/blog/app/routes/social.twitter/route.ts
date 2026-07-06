/**
 * Vanity redirect route for the author's Twitter profile. Its loader forwards any
 * request to twitter.com/sergiodxa. Exists to provide a short, memorable on-site
 * link (e.g. /social/twitter) that always points at the current profile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "react-router";

export async function loader() {
	return redirect("https://twitter.com/sergiodxa");
}
