/**
 * Logout confirmation view. Renders a form posting to the logout action so signing
 * out is an explicit, confirmed action rather than a one-click link. It exists as the
 * page shown when a signed-in visitor navigates to `/logout`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

export default function LogoutView(_handle: Handle) {
	return () => (
		<main mix={[s.page]}>
			<div mix={[s.emptyState]}>
				<h1>Sign out?</h1>
				<form method="post" action={routes.logout.action.href()}>
					<button type="submit" mix={[s.buttonPrimary]}>
						Sign out
					</button>
				</form>
			</div>
		</main>
	);
}
