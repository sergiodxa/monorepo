/**
 * CMS controller for notes: list, create, edit and delete. A note's content must fit X beside
 * its permalink, so a save that would not re-renders the form with 422 and how much to cut.
 * Every write queues the note's Webmentions and its ActivityPub publish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure, succeeded } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { NoteSchema } from "~/app/http/validators/cms/short-post";
import { ShortPostViewModel } from "~/app/http/view-models/cms/short-posts";
import { TAGS } from "~/app/initializers/cache";
import jobs from "~/app/jobs";
import { checkShort } from "~/app/services/share";
import { CMSShortPostsActionView, CMSShortPostsIndexView } from "~/resources/views/cms/short-posts";
import routes from "~/routes/web";

/** Answers See Other to the list, which a guard failure and a delete both end on. */
function toList() {
	return redirect(routes.cms.notes.index.href(), { status: redirect.Status.SeeOther });
}

/**
 * CMS note routes. Auth is checked per write; parsing and shaping stay in the schema and the
 * view model, and persistence in the notes model.
 */
export default createController(routes.cms.notes, {
	middleware: [],

	actions: {
		/**
		 * Every note, previews included, newest first.
		 *
		 * @param ctx Request context carrying the models.
		 */
		index: async (ctx) => {
			let notes = await ctx.models.notes.findAll({ includePreview: true });
			let items = ShortPostViewModel.index(
				"note",
				notes.map((note) => ({
					id: note.id,
					slug: note.meta.slug,
					content: note.meta.content,
					published_at: note.published_at,
				})),
			);
			return ctx.render(CMSShortPostsIndexView, { kind: "note", items });
		},

		/** An empty form for a new note. */
		async new(ctx) {
			return ctx.render(CMSShortPostsActionView, ShortPostViewModel.new("note"));
		},

		/**
		 * Creates a note under the slug its publish instant gives it. Content too long for X
		 * re-renders the form as submitted with 422; a save answers See Other to its edit page,
		 * which carries "Post on X".
		 *
		 * @param ctx Request context carrying the form data and the models.
		 */
		create: async (ctx) => {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), NoteSchema);
			succeeded(result, "Invalid note form data");
			let checked = checkShort({ kind: "note", content: result.data.content });
			if (isFailure(checked)) {
				let rejected = ShortPostViewModel.rejected("note", {
					data: result.data,
					contentError: checked.error.message,
				});
				return ctx.render(CMSShortPostsActionView, rejected, { status: 422 });
			}

			let input = ShortPostViewModel.input(result.data);
			let slug = await ctx.models.notes.nextSlug(input.published_at);
			let saved = await ctx.models.notes.create({
				author_id: user.id,
				published_at: input.published_at,
				meta: { slug, content: input.meta.content },
			});
			if (isFailure(saved) || !saved.data) return toList();

			let id = saved.data.id;
			await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
			await ctx.jobs.enqueue(jobs.activityPub.publish, {
				postId: id,
				changedAt: new Date().toISOString(),
			});

			return redirect(routes.cms.notes.edit.href({ id }), { status: redirect.Status.SeeOther });
		},

		/**
		 * The edit form of a note, or the create form with 404 for an id no live note has.
		 *
		 * @param ctx Request context carrying the route params and the models.
		 */
		edit: async (ctx) => {
			let id = ctx.params.id;
			let note = id ? await ctx.models.notes.find(id) : null;
			if (!note) {
				return ctx.render(CMSShortPostsActionView, ShortPostViewModel.notFound("note", id), {
					status: 404,
				});
			}

			let model = ShortPostViewModel.edit("note", {
				id: note.id,
				slug: note.meta.slug,
				content: note.meta.content,
				published_at: note.published_at,
			});
			return ctx.render(CMSShortPostsActionView, model);
		},

		/**
		 * Saves a note's content and publish date; its slug, the permalink followers hold, never
		 * changes. Content too long for X re-renders the form with 422.
		 *
		 * @param ctx Request context carrying the route params, the form data and the models.
		 */
		update: async (ctx) => {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id) return toList();

			let note = await ctx.models.notes.find(id);
			if (!note) {
				return ctx.render(CMSShortPostsActionView, ShortPostViewModel.notFound("note", id), {
					status: 404,
				});
			}

			let result = await validate(ctx.get(FormData), NoteSchema);
			succeeded(result, "Invalid note form data");
			let checked = checkShort({ kind: "note", content: result.data.content });
			if (isFailure(checked)) {
				let rejected = ShortPostViewModel.rejected("note", {
					id,
					slug: note.meta.slug,
					data: result.data,
					contentError: checked.error.message,
				});
				return ctx.render(CMSShortPostsActionView, rejected, { status: 422 });
			}

			let input = ShortPostViewModel.input(result.data);
			let updated = await ctx.models.notes.update(id, {
				author_id: user.id,
				published_at: input.published_at,
				meta: { slug: note.meta.slug, content: input.meta.content },
			});
			if (isFailure(updated)) {
				return ctx.render(CMSShortPostsActionView, ShortPostViewModel.notFound("note", id), {
					status: 404,
				});
			}

			await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
			await ctx.jobs.enqueue(jobs.activityPub.publish, {
				postId: id,
				changedAt: new Date().toISOString(),
			});
			ctx.cache.purgeLater(TAGS.post("notes", note.meta.slug));

			return redirect(routes.cms.notes.edit.href({ id }), { status: redirect.Status.SeeOther });
		},

		/**
		 * Tombstones a note, so its permalink answers 410 and followers receive its `Delete`. A
		 * missing id ends on the list as a delete does.
		 *
		 * @param ctx Request context carrying the route params and the models.
		 */
		destroy: async (ctx) => {
			let id = ctx.params.id;
			if (!id) return toList();

			let note = await ctx.models.notes.find(id);
			let destroyed = await ctx.models.notes.tombstone(id);
			if (destroyed) {
				await ctx.jobs.enqueue(jobs.webmentions.send, { postId: id });
				await ctx.jobs.enqueue(jobs.activityPub.publish, {
					postId: id,
					changedAt: new Date().toISOString(),
				});
			}
			if (note) ctx.cache.purgeLater(TAGS.post("notes", note.meta.slug));

			return toList();
		},
	},
});
