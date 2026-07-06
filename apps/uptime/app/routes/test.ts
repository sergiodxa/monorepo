/**
 * Development helper route whose loader seeds a hardcoded email into the session and
 * redirects to the accept-invite flow with a fixed invite id. It exists as a manual
 * shortcut for exercising the invitation acceptance path during local testing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "react-router";

import { getSession } from "~/middleware/session";

export async function loader() {
	getSession().set("email", "sergiodxa@gmail.com");
	return redirect("/accept-invite?invite=caa13997-01d3-4272-a5cc-56bbd974c7f3");
}
