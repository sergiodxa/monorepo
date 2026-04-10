import type { Handle } from "remix/component";

import type { NotFoundViewModel } from "~/app/http/view-models/not-found";

namespace NotFoundView {
	export interface Setup extends NotFoundViewModel.DefaultOutput {}
}

export default function NotFoundView(_handle: Handle, setup: NotFoundView.Setup) {
	return () => {
		return <h1>{setup.title}</h1>;
	};
}
