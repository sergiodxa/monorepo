/**
 * CMS controller for the Webmention moderation queue: lists received mentions by
 * state and records a moderator's decision, including the per-host allow and block
 * lists. A decision that changes what a post renders purges that post's cached page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { BlogModels } from "~/app/models";
import type { WebmentionStatus } from "~/app/models/webmentions";

import { flashToast } from "~/app/http/toast";
import {
	WebmentionDecisionSchema,
	WebmentionQueueSchema,
} from "~/app/http/validators/cms/webmention";
import { TAGS } from "~/app/initializers/cache";
import { publicTypePathOf } from "~/app/models/kinds";
import { hostOf } from "~/app/models/webmentions";
import { CMSWebmentionsView } from "~/resources/views/cms/webmentions";
import routes from "~/routes/web";

/**
 * The cache tag of the page a mention renders on, or `null` for a post that is gone
 * or has no permalink.
 *
 * @param models The request's models.
 * @param postId The post the mention targets.
 */
async function postTag(
	models: BlogModels,
	postId: string,
): Promise<ReturnType<typeof TAGS.post> | null> {
	let post = (await models.articles.find(postId)) ?? (await models.tutorials.find(postId));
	let path = post ? publicTypePathOf(post.type) : null;
	if (!post || path === null) return null;
	return post.meta.slug ? TAGS.post(path, post.meta.slug) : null;
}

/** The queues the moderation tabs count, in the order they show. */
const QUEUES: WebmentionStatus[] = ["pending", "approved", "rejected"];

/** What the toast after each decision says, echoing the button the moderator pressed. */
const DECISION_TOASTS = {
	approve: "Mention approved",
	reject: "Mention rejected",
	allow: "Domain trusted",
	block: "Domain blocked",
} as const;

/**
 * Moderation screens. Reads answer with HTML; a decision answers See Other back to the
 * queue it was made from, so a reload never repeats it.
 */
export default createController(routes.cms.webmentions, {
	/** The CMS route group enforces authentication and the admin role. */
	middleware: [],

	actions: {
		/**
		 * Lists one queue, pending by default, with the post each mention is about and how many
		 * mentions every queue holds, which the tabs count.
		 *
		 * @param ctx Request context carrying the query string and the database.
		 * @returns The moderation page.
		 */
		index: async (ctx) => {
			let query = await validate(ctx.url.searchParams, WebmentionQueueSchema);
			let status = isFailure(query) ? "pending" : query.data.status;
			let [rows, totals] = await Promise.all([
				ctx.models.webmentions.findByStatus(status),
				Promise.all(
					QUEUES.map((queue) => ctx.models.webmentions.query().where({ status: queue }).count()),
				),
			]);
			let counts = Object.fromEntries(
				QUEUES.map((queue, index) => [queue, totals[index] ?? 0]),
			) as CMSWebmentionsView.Counts;

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

			return ctx.render(CMSWebmentionsView, { status, counts, items });
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
			let mention = ctx.params.id ? await ctx.models.webmentions.find(ctx.params.id) : null;
			if (isFailure(form) || !mention) {
				return redirect(back, { status: redirect.Status.SeeOther });
			}

			let host = hostOf(mention.source);
			let affected = new Set<string>([mention.post_id]);

			switch (form.data.decision) {
				case "approve":
					await ctx.models.webmentions.setStatus(mention.id, "approved");
					break;
				case "reject":
					await ctx.models.webmentions.setStatus(mention.id, "rejected");
					break;
				case "allow":
					await ctx.models.webmentionDomains.setPolicy(host, "allow");
					await ctx.models.webmentions.setStatus(mention.id, "approved");
					break;
				case "block":
					await ctx.models.webmentionDomains.setPolicy(host, "block");
					for (let postId of await ctx.models.webmentions.rejectFromHost(host))
						affected.add(postId);
					break;
			}

			flashToast(DECISION_TOASTS[form.data.decision]);

			let tags = await Promise.all([...affected].map((postId) => postTag(ctx.models, postId)));
			let live = tags.filter((tag) => tag !== null);
			if (live.length > 0) ctx.cache.purgeLater(...live);

			return redirect(back, { status: redirect.Status.SeeOther });
		},
	},
});
