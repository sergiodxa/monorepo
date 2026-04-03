import action from "@pkg/remix-helpers/action";
import { Database } from "remix/data-table";

import type routes from "~/routes/web";

import { PostRelatedViewModel } from "~/app/http/view-models/post-related";
import { view } from "~/app/infrastructure/view";
import { Post } from "~/app/repositories/post";
import { PostRelatedView } from "~/resources/views/post-related";

/**
 * Resolves related-post fragments for the post detail page.
 *
 * Contract: this endpoint only serves tutorial relationships; missing params or
 * non-tutorial post types intentionally return an empty collection view payload.
 */
export default action<typeof routes.postRelated>(
	/**
	 * Maps route params to a related-post query and renders the fragment model.
	 *
	 * @param ctx Request context with route params and database accessor.
	 * @returns A rendered related-post view with up to three tutorial items.
	 */
	async (ctx) => {
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
	},
);
