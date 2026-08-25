/**
 * CMS controller for glossary-term CRUD. It renders index and edit/new HTML views and
 * handles create, update, and destroy actions, validating form data with the glossary
 * schema, deriving slugs from the term via `slugify`, and using 303 redirects. It
 * exists to manage glossary terms from the backoffice with in-context 404 fallback views.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { slugify } from "@pkg/strings";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { getAuthUser } from "~/app/http/middleware/auth";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { GlossarySchema } from "~/app/schemas/cms/glossary";
import { CMSGlossaryActionView, CMSGlossaryIndexView } from "~/resources/views/cms/glossary";
import routes from "~/routes/web";

/**
 * CMS glossary CRUD. `GlossaryPost` is the data boundary, and every action answers with an
 * HTML view or a 303 redirect.
 */
export default createController(routes.cms.glossary, {
	/**
	 * Each action enforces its own auth and redirect contract.
	 */
	middleware: [],

	actions: {
		/**
		 * Every stored term is listed, each row carrying its own edit and delete endpoint.
		 *
		 * @param ctx Request context with dependency container access.
		 * @returns CMS glossary index view response.
		 */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let glossary = await GlossaryPost.findAll(db);
			let items = glossary.map((item) => ({
				id: item.id,
				term: item.meta.term,
				slug: item.meta.slug,
				href: routes.cms.glossary.edit.href({ id: item.id }),
				deleteAction: routes.cms.glossary.destroy.href({ id: item.id }),
			}));

			return ctx.render(CMSGlossaryIndexView, { items });
		}),

		/**
		 * An omitted `slug` is derived from `term` via `slugify`, so every term keeps a stable
		 * anchor on the public glossary page.
		 * @param ctx Request context containing `FormData` and database bindings.
		 * @returns Redirect to login, index fallback, or the created term edit route.
		 */
		create: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), GlossarySchema);
			succeeded(result, "Invalid glossary form data");

			let created = await GlossaryPost.create(db, {
				author_id: user.id,
				meta: {
					term: result.data.term,
					title: result.data.title,
					slug: result.data.slug || slugify(result.data.term),
					definition: result.data.definition,
				},
			});

			if (!created)
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });

			return redirect(routes.cms.glossary.edit.href({ id: created.id }), {
				status: redirect.Status.SeeOther,
			});
		}),

		/**
		 * @param ctx Request context with route params and database bindings.
		 * @returns 303 redirect to glossary index, even when `id` is missing.
		 */
		destroy: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });

			await GlossaryPost.destroy(db, id);
			return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });
		}),

		/**
		 * An absent or unknown `id` answers with a 404 form view in "new" mode so editors stay
		 * inside the CMS shell.
		 * @param ctx Request context with route params and database bindings.
		 * @returns Edit form view for an existing term, or a 404 fallback form response.
		 */
		edit: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let id = ctx.params.id;
			let glossary = id ? await GlossaryPost.findById(db, id) : null;

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
		}),

		/**
		 * The description carries the current glossary size to give operators context while they
		 * add a term.
		 *
		 * @param ctx Request context with database bindings.
		 * @returns CMS glossary creation form view.
		 */
		new: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let total = (await GlossaryPost.findAll(db)).length;
			let viewProps = {
				title: "New Glossary",
				description: `New Glossary form loaded. Current glossary count: ${total}.`,
				mode: "new",
				action: routes.cms.glossary.index.href(),
				submitLabel: "Create Glossary Term",
				values: { term: "", title: "", slug: "", definition: "" },
			} satisfies CMSGlossaryActionView.Props;

			return ctx.render(CMSGlossaryActionView, viewProps);
		}),

		/**
		 * Missing auth or `id` sends the editor back to the index, while an update against an
		 * unknown record answers with the 404 form view.
		 * @param ctx Request context containing auth state, params, form data, and database.
		 * @returns Redirect back to edit page, index fallback, or 404 form view when update target is missing.
		 */
		update: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), GlossarySchema);
			succeeded(result, "Invalid glossary form data");

			let updated = await GlossaryPost.update(db, id, {
				author_id: user.id,
				meta: {
					term: result.data.term,
					title: result.data.title,
					slug: result.data.slug || slugify(result.data.term),
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
		}),
	},
});
