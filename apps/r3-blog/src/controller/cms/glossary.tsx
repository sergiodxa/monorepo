import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSActionPage, CMSResourcePage } from "~/components/cms-pages";
import { metaPath, metaTitle } from "~/lib/post-meta-view";
import { db } from "~/middleware/db";
import { GlossaryPost } from "~/models/posts/glossary";

function render(title: string, activePath: string, description: string) {
	return renderToString(
		<CMSActionPage title={title} activePath={activePath} description={description} />,
	);
}

export default controller<typeof routes.cms.glossary>({
	middleware: [],

	actions: {
		async index(ctx) {
			let glossary = await GlossaryPost.findAll(db(ctx));
			let items = glossary.map((item) => {
				let title = metaTitle(item.meta, `Glossary ${item.post.id}`);
				let path = metaPath(item.meta, "/glossary");
				return {
					label: `${title} (${path})`,
					href: `/cms/glossary/${item.post.id}`,
				};
			});

			let body = await renderToString(
				<CMSResourcePage
					title="Glossary"
					activePath="/cms/glossary"
					searchLabel="What're you looking for?"
					searchCta="Search"
					primaryCta={{ href: "/cms/glossary/new", label: "New Glossary" }}
					items={items}
					emptyLabel="No glossary terms found in the database yet."
				/>,
			);
			return ok(body);
		},

		async create(ctx) {
			let total = (await GlossaryPost.findAll(db(ctx))).length;
			let body = await render(
				"Create Glossary",
				"/cms/glossary",
				`Create Glossary. There are currently ${total} terms in the database.`,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await render(
					"Glossary Term Not Found",
					"/cms/glossary",
					`Glossary term ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(glossary.meta, glossary.post.id);
			let body = await render(
				`Delete Glossary ${title}`,
				"/cms/glossary",
				`Ready to delete glossary term "${title}" (${glossary.post.id}).`,
			);
			return ok(body);
		},

		async edit(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await render(
					"Glossary Term Not Found",
					"/cms/glossary",
					`Glossary term ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(glossary.meta, glossary.post.id);
			let body = await render(
				`Edit Glossary ${title}`,
				"/cms/glossary",
				`Editing glossary term "${title}" at ${metaPath(glossary.meta, "/glossary")}.`,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await GlossaryPost.findAll(db(ctx))).length;
			let body = await render(
				"New Glossary",
				"/cms/glossary",
				`New Glossary form loaded. Current glossary count: ${total}.`,
			);
			return ok(body);
		},

		async show(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await render(
					"Glossary Term Not Found",
					"/cms/glossary",
					`Glossary term ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				metaTitle(glossary.meta, `Glossary ${glossary.post.id}`),
				"/cms/glossary",
				`Glossary term ${glossary.post.id} lives at ${metaPath(glossary.meta, "/glossary")}.`,
			);
			return ok(body);
		},

		async update(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let body = await render(
					"Glossary Term Not Found",
					"/cms/glossary",
					`Glossary term ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(glossary.meta, glossary.post.id);
			let body = await render(
				`Update Glossary ${title}`,
				"/cms/glossary",
				`Update flow loaded for glossary term "${title}" (${glossary.post.id}).`,
			);
			return ok(body);
		},
	},
});
