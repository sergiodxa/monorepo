import action from "@pkg/remix-helpers/action";
import view from "@pkg/remix-helpers/view";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import { Counter } from "~/resources/components/timer";
import DocumentLayout from "~/resources/layouts/document";
import NotFoundView from "~/resources/views/not-found";

export default action(() => {
	let props = NotFoundViewModel.default({ title: "Page Not Found" });

	return view(
		<DocumentLayout title={props.title}>
			<NotFoundView {...props} />
			<Counter />
		</DocumentLayout>,
		{ status: 404 },
	);
});
