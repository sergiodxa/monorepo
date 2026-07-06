/**
 * The index route (GET /) whose loader simply redirects the site root to the
 * /authorize endpoint. Exists so visitors landing on the bare domain are sent
 * straight into the OAuth/OIDC authorization flow rather than seeing a blank page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { href, redirect } from "react-router";

export function loader() {
	return redirect(href("/authorize"));
}
