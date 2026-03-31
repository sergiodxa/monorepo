import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { parameterize } from "inflected";
import { renderToString } from "remix/component/server";
import { defaulted, object, optional, string } from "remix/data-schema";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { GlossaryPost } from "~/models/posts/glossary";
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
				href: `/cms/glossary/${item.id}/edit`,
				deleteAction: `/cms/glossary/${item.id}`,
			}));

			let body = await renderToString(
				<CMSLayout title="Glossary" activePath="/cms/glossary">
					<CMSGlossaryIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let user = authState().user;
			if (!user) return redirect("/login", { status: redirect.Status.SeeOther });

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

			if (!created) return redirect("/cms/glossary", { status: redirect.Status.SeeOther });

			return redirect(`/cms/glossary/${created.id}/edit`, {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let glossaryId = ctx.params.id;
			if (!glossaryId) return redirect("/cms/glossary", { status: redirect.Status.SeeOther });

			await GlossaryPost.destroy(db(), glossaryId);
			return redirect("/cms/glossary", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let glossary = await GlossaryPost.findById(db(), ctx.params.id);
			if (!glossary) {
				let viewProps: CMSGlossaryActionView.Props = {
					title: "Glossary Term Not Found",
					description: `Glossary term ${ctx.params.id} was not found.`,
					mode: "new",
					action: "/cms/glossary",
					submitLabel: "Create Glossary Term",
					values: { term: "", title: "", slug: "", definition: "" },
				};
				let body = await renderToString(
					<CMSLayout title="Glossary Term Not Found" activePath="/cms/glossary">
						<CMSGlossaryActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let viewProps: CMSGlossaryActionView.Props = {
				title: `Edit Glossary ${glossary.meta.term}`,
				description: `Editing glossary term at /glossary#${glossary.meta.slug}.`,
				mode: "edit",
				action: `/cms/glossary/${glossary.id}`,
				submitLabel: "Save Glossary Term",
				deleteAction: `/cms/glossary/${glossary.id}`,
				values: {
					term: glossary.meta.term ?? "",
					title: glossary.meta.title ?? "",
					slug: glossary.meta.slug ?? "",
					definition: glossary.meta.definition ?? "",
				},
			};

			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/glossary">
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
				action: "/cms/glossary",
				submitLabel: "Create Glossary Term",
				values: { term: "", title: "", slug: "", definition: "" },
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/glossary">
					<CMSGlossaryActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let user = authState().user;
			let glossaryId = ctx.params.id;
			if (!user || !glossaryId) {
				return redirect("/cms/glossary", { status: redirect.Status.SeeOther });
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

			return redirect(`/cms/glossary/${glossaryId}/edit`, { status: redirect.Status.SeeOther });
		},
	},
});
