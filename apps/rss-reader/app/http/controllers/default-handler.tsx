import action from "@pkg/remix-helpers/action";
import view from "@pkg/remix-helpers/view";

import NotFoundViewModel from "~/app/http/view-models/not-found";
import NotFoundView from "~/resources/views/not-found";

export default action(() => {
	let setup = NotFoundViewModel.default({ title: "Page Not Found" });
	return view(<NotFoundView setup={setup} />, { status: 404 });
});
