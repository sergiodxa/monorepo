/**
 * Not-found view component for the r3-uptime app. Renders the 404 page body — a
 * title, a short description, and a link back to the homepage — using the title
 * and description the not-found view model supplies through its handle props. It
 * exists as the presentational piece the default handler and every "unknown slug"
 * marketing/docs controller composes into the document layout when a request
 * doesn't resolve to real content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { NotFoundViewModel } from "~/app/http/view-models/not-found";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace NotFoundView {
	export interface Setup extends NotFoundViewModel.DefaultOutput {}
}

export default function NotFoundView(handle: Handle<NotFoundView.Setup>) {
	return () => {
		let { title, description } = handle.props;

		return (
			<main mix={[s.page]}>
				<div mix={[s.emptyState]}>
					<h1>{title}</h1>
					<p mix={[s.mutedSmall]}>{description}</p>
					<a href={routes.home.href()} mix={[s.link]}>
						Go back home
					</a>
				</div>
			</main>
		);
	};
}
