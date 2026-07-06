/**
 * Not-found view component for the r3-uptime app. It renders the 404 page body,
 * displaying the title supplied by the not-found view model through its handle props.
 * It exists as the presentational piece the default handler composes into the
 * document layout when a request does not match any route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { NotFoundViewModel } from "~/app/http/view-models/not-found";

namespace NotFoundView {
	export interface Setup extends NotFoundViewModel.DefaultOutput {}
}

export default function NotFoundView(handle: Handle<NotFoundView.Setup>) {
	return () => {
		return <h1>{handle.props.title}</h1>;
	};
}
