/**
 * CMS controller for the Webmention moderation queue: lists received mentions by
 * state and records a moderator's decision, including the per-host allow and block
 * lists. A decision that changes what a post renders purges that post's cached page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import { Post } from "~/app/repositories/post";
import { hostOf, Webmention } from "~/app/repositories/webmention";
import { WebmentionDecisionSchema, WebmentionQueueSchema } from "~/app/schemas/cms/webmention";
import { TAGS } from "~/app/services/cache";
import { CMSWebmentionsView } from "~/resources/views/cms/webmentions";
import routes from "~/routes/web";

/** The public collection path each mentionable post type is served under. */
const TYPE_PATHS = { article: "articles", tutorial: "tutorials" } as const;

/**
 * The cache tag of the page a mention renders on, or `null` for a post that is gone
 * or has no permalink.
 *
 * @param db Database handle used for the lookup.
 * @param postId The post the mention targets.
 */
async function postTag(db: Database, postId: string): Promise<ReturnType<typeof TAGS.post> | null> {
	let post = await Post.findById(db, postId);
	if (!post || (post.type !== "article" && post.type !== "tutorial")) return null;
	let slug = post.meta.find((row) => row.key === "slug")?.value;
	return slug ? TAGS.post(TYPE_PATHS[post.type], slug) : null;
}

/**
 * Moderation screens. Reads answer with HTML; a decision answers See Other back to the
 * queue it was made from, so a reload never repeats it.
 */
export default createController(routes.cms.webmentions, {
	/** The CMS route group enforces authentication and the admin role. */
	middleware: [],

	actions: {
		/**
		 * Lists one queue, pending by default, with the post each mention is about.
		 *
		 * @param ctx Request context carrying the query string and the database.
		 * @returns The moderation page.
		 */
		index: async (ctx) => {
			let query = await validate(ctx.url.searchParams, WebmentionQueueSchema);
			let status = isFailure(query) ? "pending" : query.data.status;
			let rows = await Webmention.findByStatus(ctx.db, status);

			let items: Array<CMSWebmentionsView.Item> = rows.map((row) => ({
				id: row.id,
				kind: row.kind,
				source: row.source,
				sourceHost: hostOf(row.source),
				target: row.target,
				authorName: row.author_name,
				text: row.content_text,
				updatedAt: row.updated_at,
				action: routes.cms.webmentions.update.href({ id: row.id }),
			}));

			return ctx.render(CMSWebmentionsView, { status, items });
		},

		/**
		 * Applies a decision. An unknown id or an invalid form returns to the queue unchanged.
		 *
		 * @param ctx Request context carrying the route params, form data, and the database.
		 * @returns See Other back to the queue the decision was made from.
		 */
		update: async (ctx) => {
			let form = await validate(ctx.get(FormData), WebmentionDecisionSchema);
			let queue = isFailure(form) ? "pending" : form.data.status;
			let back = `${routes.cms.webmentions.index.href()}?status=${queue}`;
			let mention = ctx.params.id ? await Webmention.findById(ctx.db, ctx.params.id) : null;
			if (isFailure(form) || !mention) {
				return redirect(back, { status: redirect.Status.SeeOther });
			}

			let host = hostOf(mention.source);
			let affected = new Set<string>([mention.post_id]);

			switch (form.data.decision) {
				case "approve":
					await Webmention.setStatus(ctx.db, mention.id, "approved");
					break;
				case "reject":
					await Webmention.setStatus(ctx.db, mention.id, "rejected");
					break;
				case "allow":
					await Webmention.setPolicy(ctx.db, host, "allow");
					await Webmention.setStatus(ctx.db, mention.id, "approved");
					break;
				case "block":
					await Webmention.setPolicy(ctx.db, host, "block");
					for (let postId of await Webmention.rejectFromHost(ctx.db, host)) affected.add(postId);
					break;
			}

			let tags = await Promise.all([...affected].map((postId) => postTag(ctx.db, postId)));
			let live = tags.filter((tag) => tag !== null);
			if (live.length > 0) ctx.cache.purgeLater(...live);

			return redirect(back, { status: redirect.Status.SeeOther });
		},
	},
});
