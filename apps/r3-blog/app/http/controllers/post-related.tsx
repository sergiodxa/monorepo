import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import type routes from "~/routes/web";

import { PostRelatedViewModel } from "~/app/http/view-models/post-related";
import { view } from "~/app/infrastructure/view";
import { Post } from "~/app/repositories/post";
import { PostRelatedView } from "~/resources/views/post-related";

export default action<typeof routes.postRelated>(async (ctx) => {
	let postType = ctx.params.postType;
	let postSlug = ctx.params.postSlug;

	if (!postType || !postSlug) return view(PostRelatedView, { items: [] });
	if (postType !== "tutorials") return view(PostRelatedView, { items: [] });

	let related = await Post.findRelatedByTypeAndSlug(ctx.get(Database), {
		postType,
		postSlug,
		limit: 3,
	});
	let model = PostRelatedViewModel.index(related);

	return view(PostRelatedView, model);
});
