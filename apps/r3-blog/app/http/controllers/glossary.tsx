import action from "@pkg/remix-helpers/action";

import { db } from "~/app/http/middleware/db";
import { GlossaryViewModel } from "~/app/http/view-models/glossary";
import { view } from "~/app/infrastructure/view";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { GlossaryView } from "~/resources/views/glossary";
import routes from "~/routes/web";

export default action<typeof routes.glossary>(async () => {
	let glossary = await GlossaryPost.findAll(db());
	let model = GlossaryViewModel.index(glossary);

	return view(GlossaryView, model);
});
