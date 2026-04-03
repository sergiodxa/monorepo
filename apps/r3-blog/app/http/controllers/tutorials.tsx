import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import { TutorialsViewModel } from "~/app/http/view-models/tutorials";
import { view } from "~/app/infrastructure/view";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { TutorialsView } from "~/resources/views/tutorials";
import routes from "~/routes/web";

export default action<typeof routes.tutorials>(async (ctx) => {
	let tutorials = await TutorialPost.listItems(ctx.get(Database));
	let model = TutorialsViewModel.index(tutorials);

	return view(TutorialsView, model);
});
