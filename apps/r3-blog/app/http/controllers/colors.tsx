import action from "@pkg/remix-helpers/action";

import { view } from "~/app/infrastructure/view";
import { ColorsView } from "~/resources/views/colors";
import routes from "~/routes/web";

export default action<typeof routes.colors>(async () => {
	let model: ColorsView.Model = {};

	return view(ColorsView, model);
});
