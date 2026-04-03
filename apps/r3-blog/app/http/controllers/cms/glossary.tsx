import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { parameterize } from "inflected";
import { Database } from "remix/data-table";

import { getAuthUser } from "~/app/http/middleware/auth";
import { view } from "~/app/infrastructure/view";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { GlossarySchema } from "~/app/schemas/cms/glossary";
import { CMSGlossaryActionView, CMSGlossaryIndexView } from "~/resources/views/cms/glossary";
import routes from "~/routes/web";

export default controller<typeof routes.cms.glossary>({
	middleware: [],

	actions: {
		async index(ctx) {
			let glossary = await GlossaryPost.findAll(ctx.get(Database));
			let items = glossary.map((item) => ({
				id: item.id,
				term: item.meta.term,
				slug: item.meta.slug,
				href: routes.cms.glossary.edit.href({ id: item.id }),
				deleteAction: routes.cms.glossary.destroy.href({ id: item.id }),
			}));

			return view(CMSGlossaryIndexView, { items });
		},

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

		async destroy(ctx) {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });

			await GlossaryPost.destroy(ctx.get(Database), id);
			return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });
		},

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

				return view(CMSGlossaryActionView, viewProps, { status: 404 });
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

			return view(CMSGlossaryActionView, viewProps);
		},

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

			return view(CMSGlossaryActionView, viewProps);
		},

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

				return view(CMSGlossaryActionView, viewProps, { status: 404 });
			}

			return redirect(routes.cms.glossary.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
