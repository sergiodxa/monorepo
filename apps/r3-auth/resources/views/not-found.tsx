/**
 * The 404 page shown for any URL this server does not serve.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { NotFoundViewModel } from "~/app/http/view-models/not-found";

namespace NotFoundView {
	export interface Setup extends NotFoundViewModel.DefaultOutput {}
}

/** Renders the 404 heading and explanation. */
export default function NotFoundView(handle: Handle<NotFoundView.Setup>) {
	return () => (
		<main>
			<h1>{handle.props.title}</h1>
			<p>{handle.props.description}</p>
		</main>
	);
}
