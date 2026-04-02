import { notFound } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { parameterize } from "inflected";
import { renderToString } from "remix/component/server";
import { defaulted, object, optional, string } from "remix/data-schema";

import { CMSLayout } from "~/components/layout/cms";
import { createCMSCrudActions } from "~/http/cms/crud";
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

	actions: createCMSCrudActions({
		model: GlossaryPost,
		paths: {
			indexHref: routes.cms.glossary.index.href(),
			loginHref: routes.auth.login.index.href(),
			editHref(id) {
				return routes.cms.glossary.edit.href({ id });
			},
		},
		index: {
			mapItems(glossary) {
				return glossary.map((item) => ({
					id: item.id,
					term: item.meta.term,
					slug: item.meta.slug,
					href: routes.cms.glossary.edit.href({ id: item.id }),
					deleteAction: routes.cms.glossary.destroy.href({ id: item.id }),
				}));
			},
			async render(items) {
				return renderToString(
					<CMSLayout title="Glossary" activePath={routes.cms.glossary.index.href()}>
						<CMSGlossaryIndexView items={items} />
					</CMSLayout>,
				);
			},
		},
		action: {
			buildEditProps(glossary): CMSGlossaryActionView.Props {
				return {
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
			},
			buildNotFoundProps(id): CMSGlossaryActionView.Props {
				return {
					title: "Glossary Term Not Found",
					description: `Glossary term ${id} was not found.`,
					mode: "new",
					action: routes.cms.glossary.index.href(),
					submitLabel: "Create Glossary Term",
					values: { term: "", title: "", slug: "", definition: "" },
				};
			},
			async buildNewProps(): Promise<CMSGlossaryActionView.Props> {
				let total = (await GlossaryPost.findAll(db())).length;
				return {
					title: "New Glossary",
					description: `New Glossary form loaded. Current glossary count: ${total}.`,
					mode: "new",
					action: routes.cms.glossary.index.href(),
					submitLabel: "Create Glossary Term",
					values: { term: "", title: "", slug: "", definition: "" },
				};
			},
			async render(viewProps) {
				return renderToString(
					<CMSLayout title={viewProps.title} activePath={routes.cms.glossary.index.href()}>
						<CMSGlossaryActionView {...viewProps} />
					</CMSLayout>,
				);
			},
		},
		form: {
			async parse(formData) {
				let result = await validate(formData, GlossarySchema);
				succeeded(result, "Invalid glossary form data");
				return result.data;
			},
			toCreateInput(data, user) {
				return {
					author_id: user.id,
					meta: {
						term: data.term,
						title: data.title,
						slug: data.slug || parameterize(data.term),
						definition: data.definition,
					},
				};
			},
			toUpdateInput(data, user) {
				return {
					author_id: user.id,
					meta: {
						term: data.term,
						title: data.title,
						slug: data.slug || parameterize(data.term),
						definition: data.definition,
					},
				};
			},
		},
		onUpdateMissing() {
			return notFound("<h1>404 Not Found</h1>");
		},
	}),
});
