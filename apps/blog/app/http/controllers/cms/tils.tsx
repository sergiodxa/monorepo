/**
 * CMS controller for TILs: list, create, edit and delete. A TIL's content must fit X after
 * "TIL" and beside its permalink, so a save that would not re-renders the form with 422 and
 * how much to cut. Every write queues the TIL's Webmentions and its ActivityPub publish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure, succeeded } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { Til } from "~/app/models/tils";

import { getAuthUser } from "~/app/http/middleware/auth";
import { TilSchema } from "~/app/http/validators/cms/short-post";
import { ShortPostViewModel } from "~/app/http/view-models/cms/short-posts";
import { TAGS } from "~/app/initializers/cache";
import jobs from "~/app/jobs";
import { tutorialTags } from "~/app/models/post-values";
import { checkShort } from "~/app/services/share";
import { CMSShortPostsActionView, CMSShortPostsIndexView } from "~/resources/views/cms/short-posts";
import routes from "~/routes/web";

/** Answers See Other to the list, which a guard failure and a delete both end on. */
function toList() {
	return redirect(routes.cms.tils.index.href(), { status: redirect.Status.SeeOther });
}

/** A stored TIL as the screens read it, its tags parsed from their JSON list. */
function source(til: Til): ShortPostViewModel.Source {
	return {
		id: til.id,
		slug: til.meta.slug,
		title: til.meta.title,
		content: til.meta.content,
		tags: tutorialTags(til.meta.tags),
		published_at: til.published_at,
	};
}

/**
 * CMS TIL routes. Auth is checked per write; parsing and shaping stay in the schema and the
 * view model, and persistence in the TILs model.
 */
export default createController(routes.cms.tils, {
	middleware: [],

	actions: {
		/**
		 * Every TIL, previews included, newest first.
		 *
		 * @param ctx Request context carrying the models.
		 */
		index: async (ctx) => {
			let tils = await ctx.models.tils.findAll({ includePreview: true });
			let items = ShortPostViewModel.index("til", tils.map(source));
			return ctx.render(CMSShortPostsIndexView, { kind: "til", items });
		},

		/** An empty form for a new TIL. */
		async new(ctx) {
			return ctx.render(CMSShortPostsActionView, ShortPostViewModel.new("til"));
		},

		/**
		 * Creates a TIL under the slug typed or taken from its title. Content too long for X
		 * re-renders the form as submitted with 422; a save answers See Other to its edit page,
		 * which carries "Post on X".
		 *
		 * @param ctx Request context carrying the form data and the models.
		 */
		create: async (ctx) => {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), TilSchema);
			succeeded(result, "Invalid TIL form data");
			let checked = checkShort({ kind: "til", content: result.data.content });
			if (isFailure(checked)) {
				let rejected = ShortPostViewModel.rejected("til", {
					data: result.data,
					contentError: checked.error.message,
				});
				return ctx.render(CMSShortPostsActionView, rejected, { status: 422 });
			}

			let input = ShortPostViewModel.input(result.data);
			let saved = await ctx.models.tils.create({
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});
			if (isFailure(saved) || !saved.data) return toList();

			let id = saved.data.id;
			await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
			await ctx.jobs.enqueue(jobs.activityPub.publish, {
				postId: id,
				changedAt: new Date().toISOString(),
			});

			return redirect(routes.cms.tils.edit.href({ id }), { status: redirect.Status.SeeOther });
		},

		/**
		 * The edit form of a TIL, or the create form with 404 for an id no live TIL has.
		 *
		 * @param ctx Request context carrying the route params and the models.
		 */
		edit: async (ctx) => {
			let id = ctx.params.id;
			let til = id ? await ctx.models.tils.find(id) : null;
			if (!til) {
				return ctx.render(CMSShortPostsActionView, ShortPostViewModel.notFound("til", id), {
					status: 404,
				});
			}

			let model = ShortPostViewModel.edit("til", source(til));
			return ctx.render(CMSShortPostsActionView, model);
		},

		/**
		 * Saves a TIL's title, tags, content and publish date; its slug, the permalink followers
		 * hold, never changes. Content too long for X re-renders the form with 422.
		 *
		 * @param ctx Request context carrying the route params, the form data and the models.
		 */
		update: async (ctx) => {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id) return toList();

			let til = await ctx.models.tils.find(id);
			if (!til) {
				return ctx.render(CMSShortPostsActionView, ShortPostViewModel.notFound("til", id), {
					status: 404,
				});
			}

			let result = await validate(ctx.get(FormData), TilSchema);
			succeeded(result, "Invalid TIL form data");
			let checked = checkShort({ kind: "til", content: result.data.content });
			if (isFailure(checked)) {
				let rejected = ShortPostViewModel.rejected("til", {
					id,
					slug: til.meta.slug,
					data: result.data,
					contentError: checked.error.message,
				});
				return ctx.render(CMSShortPostsActionView, rejected, { status: 422 });
			}

			let input = ShortPostViewModel.input(result.data);
			let updated = await ctx.models.tils.update(id, {
				author_id: user.id,
				published_at: input.published_at,
				meta: { ...input.meta, slug: til.meta.slug },
			});
			if (isFailure(updated)) {
				return ctx.render(CMSShortPostsActionView, ShortPostViewModel.notFound("til", id), {
					status: 404,
				});
			}

			await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
			await ctx.jobs.enqueue(jobs.activityPub.publish, {
				postId: id,
				changedAt: new Date().toISOString(),
			});
			ctx.cache.purgeLater(TAGS.post("til", til.meta.slug));

			return redirect(routes.cms.tils.edit.href({ id }), { status: redirect.Status.SeeOther });
		},

		/**
		 * Tombstones a TIL, so its permalink answers 410 and followers receive its `Delete`. A
		 * missing id ends on the list as a delete does.
		 *
		 * @param ctx Request context carrying the route params and the models.
		 */
		destroy: async (ctx) => {
			let id = ctx.params.id;
			if (!id) return toList();

			let til = await ctx.models.tils.find(id);
			let destroyed = await ctx.models.tils.tombstone(id);
			if (destroyed) {
				await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
				await ctx.jobs.enqueue(jobs.activityPub.publish, {
					postId: id,
					changedAt: new Date().toISOString(),
				});
			}
			if (til) ctx.cache.purgeLater(TAGS.post("til", til.meta.slug));

			return toList();
		},
	},
});
