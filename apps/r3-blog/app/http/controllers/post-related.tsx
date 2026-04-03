import action from "@pkg/remix-helpers/action";
import { getContext } from "remix/async-context-middleware";

import type routes from "~/routes/web";

import { db } from "~/app/http/middleware/db";
import { PostRelatedViewModel } from "~/app/http/view-models/post-related";
import { view } from "~/app/infrastructure/view";
import { Post } from "~/app/repositories/post";
import { PostRelatedView } from "~/resources/views/post-related";

export default action<typeof routes.postRelated>(async () => {
	let ctx = getContext() as any;
	let postType = ctx.params.postType;
	let postSlug = ctx.params.postSlug;

	if (!postType || !postSlug) return view(PostRelatedView, { items: [] });
	if (postType !== "tutorials") return view(PostRelatedView, { items: [] });

	let related = await Post.findRelatedByTypeAndSlug(db(), { postType, postSlug, limit: 3 });
	let model = PostRelatedViewModel.index(related);

	return view(PostRelatedView, model);
});
