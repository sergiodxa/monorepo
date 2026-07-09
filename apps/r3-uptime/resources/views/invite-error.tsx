/**
 * Invite failure view. Renders a short error message when an invite can't be
 * accepted (not found, already accepted, or sent to a different email than the
 * signed-in account).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace InviteErrorView {
	export interface Props {
		message: string;
	}
}

export default function InviteErrorView(handle: Handle<InviteErrorView.Props>) {
	return () => (
		<main mix={[s.page]}>
			<div mix={[s.emptyState]}>
				<h1>Invite unavailable</h1>
				<p mix={[s.mutedSmall]}>{handle.props.message}</p>
				<a href={routes.home.href()} mix={[s.link]}>
					Back home
				</a>
			</div>
		</main>
	);
}
