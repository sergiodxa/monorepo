/**
 * CMS controller for tutorial CRUD. It renders index and edit/new HTML views and handles
 * create, update, and destroy actions, validating form data against the tutorial schema
 * and using See Other redirects for the post/redirect/get flow. It exists to manage
 * tutorials from the backoffice while delegating parsing and shaping to schema/view-model layers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { TutorialViewModel } from "~/app/http/view-models/cms/tutorials";
import { Post } from "~/app/repositories/post";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { TutorialSchema } from "~/app/schemas/cms/tutorial";
import { CMSTutorialsActionView, CMSTutorialsIndexView } from "~/resources/views/cms/tutorials";
import routes from "~/routes/web";

/**
 * CMS tutorial routes. The controller owns auth and flow decisions and delegates parsing,
 * shaping, and persistence to the schema, view-model, and repository layers.
 */
export default createController(routes.cms.tutorials, {
	/**
	 * CMS auth is enforced per mutating action, so read-only views stay reachable through the
	 * existing route wiring while create and update paths guard themselves with redirects.
	 */
	middleware: [],

	actions: {
		/**
		 * Preview badges come from `Post.isPublishedAt`, so they match the shared publish
		 * contract: `null` or a past date is published, a future date is preview.
		 *
		 * @param ctx Request-scoped container used to resolve the database connection.
		 * @returns HTML response with the tutorials list view-model.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let tutorials = await TutorialPost.findAll(db, { includePreview: true });
			let sources: Array<TutorialViewModel.SourceIndexItem> = tutorials.map((tutorial) => ({
				id: tutorial.id,
				title: tutorial.meta.title,
				slug: tutorial.meta.slug,
				preview: !Post.isPublishedAt(tutorial.published_at),
				tags: tutorial.meta.tags,
			}));
			let items = TutorialViewModel.index({ items: sources });

			return ctx.render(CMSTutorialsIndexView, { items });
		}),

		/**
		 * Unauthenticated callers go to login, and every exit is a See Other redirect so the
		 * post/redirect/get flow holds and a reload only repeats a read.
		 *
		 * @param ctx Request-scoped container that provides submitted form data and database access.
		 * @returns Redirect response to login, tutorials index fallback, or newly created edit page.
		 */
		create: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), TutorialSchema);
			succeeded(result, "Invalid tutorial form data");
			let input = TutorialViewModel.input({ data: result.data });

			let created = await TutorialPost.create(db, {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!created)
				return redirect(routes.cms.tutorials.index.href(), {
					status: redirect.Status.SeeOther,
				});

			return redirect(routes.cms.tutorials.edit.href({ id: created.id }), {
				status: redirect.Status.SeeOther,
			});
		}),

		/**
		 * A missing id resolves to the same index redirect as a successful delete, so a malformed
		 * request reveals only the list page.
		 *
		 * @param ctx Request context carrying optional route params and database access.
		 * @returns Redirect response to the CMS tutorials index.
		 */
		destroy: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.tutorials.index.href(), { status: redirect.Status.SeeOther });

			await TutorialPost.destroy(db, id);
			return redirect(routes.cms.tutorials.index.href(), { status: redirect.Status.SeeOther });
		}),

		/**
		 * An unknown id renders the action view with a 404 status, keeping CMS layout and
		 * messaging consistent with other missing-resource flows.
		 *
		 * @param ctx Request context containing route params and database access.
		 * @returns HTML response for either the populated edit form or not-found model.
		 */
		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			let tutorial = id ? await TutorialPost.findById(db, id) : null;

			if (!tutorial) {
				let model = TutorialViewModel.notFound({ id });
				return ctx.render(CMSTutorialsActionView, model, { status: 404 });
			}

			let source: TutorialViewModel.SourceEditItem = {
				id: tutorial.id,
				title: tutorial.meta.title,
				slug: tutorial.meta.slug,
				excerpt: tutorial.meta.excerpt,
				tags: tutorial.meta.tags,
				content: tutorial.meta.content,
				published_at: tutorial.published_at,
			};
			let model = TutorialViewModel.edit({ tutorial: source });

			return ctx.render(CMSTutorialsActionView, model);
		}),

		/**
		 * A dedicated `new` view-model state lets the template reuse the edit action view while
		 * keeping default field semantics explicit.
		 *
		 * @returns HTML response with an empty tutorial form model.
		 */
		async new(ctx) {
			let model = TutorialViewModel.new({});

			return ctx.render(CMSTutorialsActionView, model);
		},

		/**
		 * Missing auth or id ends in a redirect, and the 404 view appears once validation passes
		 * and the referenced record turns out to be gone.
		 *
		 * @param ctx Request context with route params, form data, and database access.
		 * @returns Redirect response on success/guard failures, or 404 CMS action view when missing.
		 */
		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.tutorials.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), TutorialSchema);
			succeeded(result, "Invalid tutorial form data");
			let input = TutorialViewModel.input({ data: result.data });

			let updated = await TutorialPost.update(db, id, {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!updated) {
				let model = TutorialViewModel.notFound({ id });
				return ctx.render(CMSTutorialsActionView, model, { status: 404 });
			}

			return redirect(routes.cms.tutorials.edit.href({ id }), { status: redirect.Status.SeeOther });
		}),
	},
});
