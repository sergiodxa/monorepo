import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { parameterize } from "inflected";
import { renderToString } from "remix/component/server";
import { defaulted, object, optional, string } from "remix/data-schema";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { GlossaryPost } from "~/models/posts/glossary";
import routes from "~/routes";
import { CMSGlossaryActionView, CMSGlossaryIndexView } from "~/views/cms/glossary";

let GlossarySchema = object({
	term: defaulted(string(), "Untitled term"),
	title: optional(string()),
	slug: optional(string()),
	definition: defaulted(string(), ""),
});

export default controller<typeof routes.cms.glossary>({
	middleware: [],

	actions: {
		async index() {
			let glossary = await GlossaryPost.findAll(db());
			let items = glossary.map((item) => ({
				id: item.id,
				term: item.meta.term,
				slug: item.meta.slug,
				href: routes.cms.glossary.edit.href({ id: item.id }),
				deleteAction: routes.cms.glossary.destroy.href({ id: item.id }),
			}));

			let body = await renderToString(
				<CMSLayout title="Glossary" activePath={routes.cms.glossary.index.href()}>
					<CMSGlossaryIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let user = authState().user;
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), GlossarySchema);
			succeeded(result, "Invalid glossary form data");

			let created = await GlossaryPost.create(db(), {
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
			let glossaryId = ctx.params.id;
			if (!glossaryId) {
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });
			}

			await GlossaryPost.destroy(db(), glossaryId);
			return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let glossary = await GlossaryPost.findById(db(), ctx.params.id);
			if (!glossary) {
				let viewProps: CMSGlossaryActionView.Props = {
					title: "Glossary Term Not Found",
					description: `Glossary term ${ctx.params.id} was not found.`,
					mode: "new",
					action: routes.cms.glossary.index.href(),
					submitLabel: "Create Glossary Term",
					values: { term: "", title: "", slug: "", definition: "" },
				};
				let body = await renderToString(
					<CMSLayout title="Glossary Term Not Found" activePath={routes.cms.glossary.index.href()}>
						<CMSGlossaryActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let viewProps: CMSGlossaryActionView.Props = {
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
			};

			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath={routes.cms.glossary.index.href()}>
					<CMSGlossaryActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new() {
			let total = (await GlossaryPost.findAll(db())).length;
			let viewProps: CMSGlossaryActionView.Props = {
				title: "New Glossary",
				description: `New Glossary form loaded. Current glossary count: ${total}.`,
				mode: "new",
				action: routes.cms.glossary.index.href(),
				submitLabel: "Create Glossary Term",
				values: { term: "", title: "", slug: "", definition: "" },
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath={routes.cms.glossary.index.href()}>
					<CMSGlossaryActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let user = authState().user;
			let glossaryId = ctx.params.id;
			if (!user || !glossaryId) {
				return redirect(routes.cms.glossary.index.href(), { status: redirect.Status.SeeOther });
			}

			let result = await validate(ctx.get(FormData), GlossarySchema);
			succeeded(result, "Invalid glossary form data");

			let updated = await GlossaryPost.update(db(), glossaryId, {
				author_id: user.id,
				meta: {
					term: result.data.term,
					title: result.data.title,
					slug: result.data.slug || parameterize(result.data.term),
					definition: result.data.definition,
				},
			});

			if (!updated) return notFound("<h1>404 Not Found</h1>");

			return redirect(routes.cms.glossary.edit.href({ id: glossaryId }), {
				status: redirect.Status.SeeOther,
			});
		},
	},
});
