import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { GlossaryPost } from "~/models/posts/glossary";
import { CMSGlossaryActionView, CMSGlossaryIndexView } from "~/views/cms/glossary";

export default controller<typeof routes.cms.glossary>({
	middleware: [],

	actions: {
		async index(ctx) {
			let glossary = await GlossaryPost.findAll(db(ctx));
			let items = glossary.map(
				(item): CMSGlossaryIndexView.Item => ({
					id: item.post.id,
					term: item.meta.term,
					slug: item.meta.slug,
				}),
			);

			let body = await renderToString(
				<CMSLayout title="Glossary" activePath="/cms/glossary">
					<CMSGlossaryIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let total = (await GlossaryPost.findAll(db(ctx))).length;
			let body = await renderToString(
				<CMSLayout title="Create Glossary" activePath="/cms/glossary">
					<CMSGlossaryActionView
						title="Create Glossary"
						description={`Create Glossary. There are currently ${total} terms in the database.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await renderToString(
					<CMSLayout title="Glossary Term Not Found" activePath="/cms/glossary">
						<CMSGlossaryActionView
							title="Glossary Term Not Found"
							description={`Glossary term ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = glossary.meta.term;
			let body = await renderToString(
				<CMSLayout title={`Delete Glossary ${title}`} activePath="/cms/glossary">
					<CMSGlossaryActionView
						title={`Delete Glossary ${title}`}
						description={`Ready to delete glossary term "${title}" (${glossary.post.id}).`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async edit(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await renderToString(
					<CMSLayout title="Glossary Term Not Found" activePath="/cms/glossary">
						<CMSGlossaryActionView
							title="Glossary Term Not Found"
							description={`Glossary term ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = glossary.meta.term;
			let body = await renderToString(
				<CMSLayout title={`Edit Glossary ${title}`} activePath="/cms/glossary">
					<CMSGlossaryActionView
						title={`Edit Glossary ${title}`}
						description={`Editing glossary term "${title}" at /glossary/${glossary.meta.slug}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await GlossaryPost.findAll(db(ctx))).length;
			let body = await renderToString(
				<CMSLayout title="New Glossary" activePath="/cms/glossary">
					<CMSGlossaryActionView
						title="New Glossary"
						description={`New Glossary form loaded. Current glossary count: ${total}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await renderToString(
					<CMSLayout title="Glossary Term Not Found" activePath="/cms/glossary">
						<CMSGlossaryActionView
							title="Glossary Term Not Found"
							description={`Glossary term ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = glossary.meta.term;
			let body = await renderToString(
				<CMSLayout title={title} activePath="/cms/glossary">
					<CMSGlossaryActionView
						title={title}
						description={`Glossary term ${glossary.post.id} lives at /glossary/${glossary.meta.slug}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await renderToString(
					<CMSLayout title="Glossary Term Not Found" activePath="/cms/glossary">
						<CMSGlossaryActionView
							title="Glossary Term Not Found"
							description={`Glossary term ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = glossary.meta.term;
			let body = await renderToString(
				<CMSLayout title={`Update Glossary ${title}`} activePath="/cms/glossary">
					<CMSGlossaryActionView
						title={`Update Glossary ${title}`}
						description={`Update flow loaded for glossary term "${title}" (${glossary.post.id}).`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},
	},
});
