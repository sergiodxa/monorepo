/**
 * HTTP action for the related-posts fragment on post detail pages. Only tutorial
 * relationships are served, capped at three items; every other request renders an empty
 * collection so the fragment always resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { PostRelatedViewModel } from "~/app/http/view-models/post-related";
import { Post } from "~/app/repositories/post";
import { PostRelatedView } from "~/resources/views/post-related";
import routes from "~/routes/web";

/**
 * Resolves the related-post fragment for a post detail page.
 * @returns A rendered fragment holding up to three tutorial items.
 */
export default createAction(routes.postRelated, async (ctx) => {
	let postType = ctx.params.postType;
	let postSlug = ctx.params.postSlug;

	if (!postType || !postSlug) return ctx.render(PostRelatedView, { items: [] });
	if (postType !== "tutorials") return ctx.render(PostRelatedView, { items: [] });

	let related = await Post.findRelatedByTypeAndSlug(ctx.db, {
		postType,
		postSlug,
		limit: 3,
	});
	let model = PostRelatedViewModel.index(related);

	return ctx.render(PostRelatedView, model);
});
