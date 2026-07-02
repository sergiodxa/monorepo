import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { TutorialViewModel } from "~/app/http/view-models/cms/tutorials";
import { Post } from "~/app/repositories/post";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { TutorialSchema } from "~/app/schemas/cms/tutorial";
import { CMSTutorialsActionView, CMSTutorialsIndexView } from "~/resources/views/cms/tutorials";
import routes from "~/routes/web";

/**
 * Coordinates CMS tutorial management routes.
 *
 * Keeps controller responsibilities focused on auth/flow decisions and delegates parsing,
 * shaping, and persistence to schema, view-model, and repository layers.
 */
export default createController(routes.cms.tutorials, {
	/**
	 * Leaves middleware empty because CMS auth is enforced per mutating action.
	 *
	 * This keeps read-only views reachable for existing route wiring while still guarding
	 * create/update paths with explicit redirects.
	 */
	middleware: [],

	actions: {
		/**
		 * Builds the CMS tutorials index model from persisted tutorial rows.
		 *
		 * Uses `Post.isPublishedAt` so preview badges match the shared publish contract
		 * (`null` or past date is published, future date is preview).
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
		 * Creates a tutorial from validated form payload and redirects to the edit screen.
		 *
		 * Redirects unauthenticated users to login instead of rendering errors, preserving the
		 * CMS post/redirect/get flow and avoiding accidental form resubmission.
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
		 * Deletes a tutorial when an id is provided and always returns to the list page.
		 *
		 * Missing ids are treated as no-op redirects so malformed requests cannot leak details
		 * about internal identifiers or controller state.
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
		 * Loads tutorial data for the edit form or returns a CMS-scoped 404 state.
		 *
		 * Returning the action view with a 404 status keeps the CMS layout and messaging
		 * consistent with other missing-resource flows.
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
		 * Renders the blank tutorial form used by CMS create flows.
		 *
		 * Uses a dedicated `new` view-model state so the template can reuse the same action view
		 * as edit while keeping default field semantics explicit.
		 *
		 * @returns HTML response with an empty tutorial form model.
		 */
		async new(ctx) {
			let model = TutorialViewModel.new({});

			return ctx.render(CMSTutorialsActionView, model);
		},

		/**
		 * Updates an existing tutorial from validated form input.
		 *
		 * Treats missing auth or id as redirect-only failures, and only renders 404 when the
		 * referenced record no longer exists after validation.
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
