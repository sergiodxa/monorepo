import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { parameterize } from "inflected";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { GlossarySchema } from "~/app/schemas/cms/glossary";
import { CMSGlossaryActionView, CMSGlossaryIndexView } from "~/resources/views/cms/glossary";
import routes from "~/routes/web";

/**
 * Coordinates CMS glossary CRUD flows and maps route actions to view or redirect responses.
 *
 * Contract: actions use `GlossaryPost` as the data boundary and return HTML views or 303 redirects.
 */
export default createController(routes.cms.glossary, {
	/**
	 * Controller-level middleware chain.
	 *
	 * Kept empty here so each action can enforce its own auth/redirect contract where needed.
	 */
	middleware: [],

	actions: {
		/**
		 * Loads all glossary terms and adapts repository records into index-table row props.
		 *
		 * @param ctx Request context with dependency container access.
		 * @returns CMS glossary index view response.
		 */
		async index(ctx) {
			let glossary = await GlossaryPost.findAll(ctx.get(Database));
			let items = glossary.map((item) => ({
				id: item.id,
				term: item.meta.term,
				slug: item.meta.slug,
				href: routes.cms.glossary.edit.href({ id: item.id }),
				deleteAction: routes.cms.glossary.destroy.href({ id: item.id }),
			}));

			return ctx.render(CMSGlossaryIndexView, { items });
		},

		/**
		 * Validates form input, creates a glossary term, then sends a 303 redirect.
		 *
		 * Non-obvious behavior: when `slug` is omitted, it is derived from `term` via `parameterize`.
		 * @param ctx Request context containing `FormData` and database bindings.
		 * @returns Redirect to login, index fallback, or the created term edit route.
		 */
		async create(ctx) {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), GlossarySchema);
			succeeded(result, "Invalid glossary form data");

			let created = await GlossaryPost.create(ctx.get(Database), {
				author_id: user.id,
				meta: {
					term: result.data.term,
					title: result.data.title,
					slug: result.data.slug || parameterize(result.data.term),
					definition: result.data.definition,
				},
			});

			if (!created)
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });

			return redirect(routes.cms.glossary.edit.href({ id: created.id }), {
				status: redirect.Status.SeeOther,
			});
		},

		/**
		 * Deletes a glossary term by route `id` and always returns to the index route.
		 *
		 * @param ctx Request context with route params and database bindings.
		 * @returns 303 redirect to glossary index, even when `id` is missing.
		 */
		async destroy(ctx) {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });

			await GlossaryPost.destroy(ctx.get(Database), id);
			return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });
		},

		/**
		 * Loads a glossary term for editing and hydrates the CMS form state.
		 *
		 * Contract: when `id` is absent or unknown, returns a 404 form view in "new" mode.
		 * @param ctx Request context with route params and database bindings.
		 * @returns Edit form view for an existing term, or a 404 fallback form response.
		 */
		async edit(ctx) {
			let id = ctx.params.id;
			let glossary = id ? await GlossaryPost.findById(ctx.get(Database), id) : null;

			if (!glossary) {
				let viewProps = {
					title: "Glossary Term Not Found",
					description: `Glossary term ${id} was not found.`,
					mode: "new",
					action: routes.cms.glossary.index.href(),
					submitLabel: "Create Glossary Term",
					values: { term: "", title: "", slug: "", definition: "" },
				} satisfies CMSGlossaryActionView.Props;

				return ctx.render(CMSGlossaryActionView, viewProps, { status: 404 });
			}

			let viewProps = {
				title: `Edit Glossary ${glossary.meta.term}`,
				description: `Editing glossary term at ${routes.glossary.href()}#${glossary.meta.slug}.`,
				mode: "edit",
				action: routes.cms.glossary.update.href({ id: glossary.id }),
				submitLabel: "Save Glossary Term",
				deleteAction: routes.cms.glossary.destroy.href({ id: glossary.id }),
				values: {
					term: glossary.meta.term ?? "",
					title: glossary.meta.title ?? "",
					slug: glossary.meta.slug ?? "",
					definition: glossary.meta.definition ?? "",
				},
			} satisfies CMSGlossaryActionView.Props;

			return ctx.render(CMSGlossaryActionView, viewProps);
		},

		/**
		 * Renders the new-term form and includes current glossary size for CMS operator context.
		 *
		 * @param ctx Request context with database bindings.
		 * @returns CMS glossary creation form view.
		 */
		async new(ctx) {
			let total = (await GlossaryPost.findAll(ctx.get(Database))).length;
			let viewProps = {
				title: "New Glossary",
				description: `New Glossary form loaded. Current glossary count: ${total}.`,
				mode: "new",
				action: routes.cms.glossary.index.href(),
				submitLabel: "Create Glossary Term",
				values: { term: "", title: "", slug: "", definition: "" },
			} satisfies CMSGlossaryActionView.Props;

			return ctx.render(CMSGlossaryActionView, viewProps);
		},

		/**
		 * Validates form payload and updates an existing glossary term by route `id`.
		 *
		 * Non-obvious behavior: missing auth or `id` short-circuits to index redirect instead of 404.
		 * @param ctx Request context containing auth state, params, form data, and database.
		 * @returns Redirect back to edit page, index fallback, or 404 form view when update target is missing.
		 */
		async update(ctx) {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), GlossarySchema);
			succeeded(result, "Invalid glossary form data");

			let updated = await GlossaryPost.update(ctx.get(Database), id, {
				author_id: user.id,
				meta: {
					term: result.data.term,
					title: result.data.title,
					slug: result.data.slug || parameterize(result.data.term),
					definition: result.data.definition,
				},
			});

			if (!updated) {
				let viewProps = {
					title: "Glossary Term Not Found",
					description: `Glossary term ${id} was not found.`,
					mode: "new",
					action: routes.cms.glossary.index.href(),
					submitLabel: "Create Glossary Term",
					values: { term: "", title: "", slug: "", definition: "" },
				} satisfies CMSGlossaryActionView.Props;

				return ctx.render(CMSGlossaryActionView, viewProps, { status: 404 });
			}

			return redirect(routes.cms.glossary.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
