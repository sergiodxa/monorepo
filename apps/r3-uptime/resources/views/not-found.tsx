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
