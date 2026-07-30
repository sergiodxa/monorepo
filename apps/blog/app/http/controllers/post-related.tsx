/**
 * HTTP action for the related-posts fragment on post detail pages. It queries up to
 * three related posts by type and slug from the database and renders them through the
 * related-post view. Only tutorial relationships are served; missing params or a
 * non-tutorial post type intentionally return an empty collection view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { PostRelatedViewModel } from "~/app/http/view-models/post-related";
import { Post } from "~/app/repositories/post";
import { PostRelatedView } from "~/resources/views/post-related";
import routes from "~/routes/web";

/**
 * Resolves related-post fragments for the post detail page.
 *
 * Contract: this endpoint only serves tutorial relationships; missing params or
 * non-tutorial post types intentionally return an empty collection view payload.
 */
export default createAction(
	routes.postRelated,
	/**
	 * Maps route params to a related-post query and renders the fragment model.
	 *
	 * @param ctx Request context with route params and database accessor.
	 * @returns A rendered related-post view with up to three tutorial items.
	 */
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let postType = ctx.params.postType;
		let postSlug = ctx.params.postSlug;

		if (!postType || !postSlug) return ctx.render(PostRelatedView, { items: [] });
		if (postType !== "tutorials") return ctx.render(PostRelatedView, { items: [] });

		let related = await Post.findRelatedByTypeAndSlug(db, {
			postType,
			postSlug,
			limit: 3,
		});
		let model = PostRelatedViewModel.index(related);

		return ctx.render(PostRelatedView, model);
	}),
);
