import action from "@pkg/remix-helpers/action";

import { db } from "~/app/http/middleware/db";
import { TutorialsViewModel } from "~/app/http/view-models/tutorials";
import { view } from "~/app/infrastructure/view";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { TutorialsView } from "~/resources/views/tutorials";
import routes from "~/routes/web";

export default action<typeof routes.tutorials>(async () => {
	let tutorials = await TutorialPost.listItems(db());
	let model = TutorialsViewModel.index(tutorials);

	return view(TutorialsView, model);
});
