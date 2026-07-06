/**
 * Vanity redirect route for sponsorships. Its loader forwards visitors to the
 * author's GitHub Sponsors page using a document redirect so the browser navigates
 * away fully. Exists to provide a short on-site /sponsor link pointing at the current
 * sponsorship destination.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirectDocument } from "react-router";

export function loader() {
	return redirectDocument("https://github.com/sponsors/sergiodxa");
}
