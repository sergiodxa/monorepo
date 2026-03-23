import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSActionPage, CMSResourcePage } from "~/components/cms-pages";
import { metaPath, metaTitle } from "~/lib/post-meta-view";
import { db } from "~/middleware/db";
import { TutorialPost } from "~/models/posts/tutorial";

function render(title: string, activePath: string, description: string) {
	return renderToString(
		<CMSActionPage title={title} activePath={activePath} description={description} />,
	);
}

export default controller<typeof routes.cms.tutorials>({
	middleware: [],

	actions: {
		async index(ctx) {
			let tutorials = await TutorialPost.findAll(db(ctx));
			let items = tutorials.map((tutorial) => {
				let title = metaTitle(tutorial.meta, `Tutorial ${tutorial.post.id}`);
				let path = metaPath(tutorial.meta, "/tutorials");
				return {
					label: `${title} (${path})`,
					href: `/cms/tutorials/${tutorial.post.id}`,
				};
			});

			let body = await renderToString(
				<CMSResourcePage
					title="Tutorials"
					activePath="/cms/tutorials"
					searchLabel="What're you looking for?"
					searchCta="Search"
					primaryCta={{ href: "/cms/tutorials/new", label: "New Tutorial" }}
					items={items}
					emptyLabel="No tutorials found in the database yet."
				/>,
			);
			return ok(body);
		},

		async create(ctx) {
			let total = (await TutorialPost.findAll(db(ctx))).length;
			let body = await render(
				"Create Tutorial",
				"/cms/tutorials",
				`Create Tutorial. There are currently ${total} tutorials in the database.`,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let body = await render(
					"Tutorial Not Found",
					"/cms/tutorials",
					`Tutorial ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(tutorial.meta, tutorial.post.id);
			let body = await render(
				`Delete Tutorial ${title}`,
				"/cms/tutorials",
				`Ready to delete tutorial "${title}" (${tutorial.post.id}).`,
			);
			return ok(body);
		},

		async edit(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let body = await render(
					"Tutorial Not Found",
					"/cms/tutorials",
					`Tutorial ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(tutorial.meta, tutorial.post.id);
			let body = await render(
				`Edit Tutorial ${title}`,
				"/cms/tutorials",
				`Editing tutorial "${title}" at ${metaPath(tutorial.meta, "/tutorials")}.`,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await TutorialPost.findAll(db(ctx))).length;
			let body = await render(
				"New Tutorial",
				"/cms/tutorials",
				`New Tutorial form loaded. Current tutorials count: ${total}.`,
			);
			return ok(body);
		},

		async show(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let body = await render(
					"Tutorial Not Found",
					"/cms/tutorials",
					`Tutorial ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				metaTitle(tutorial.meta, `Tutorial ${tutorial.post.id}`),
				"/cms/tutorials",
				`Tutorial ${tutorial.post.id} lives at ${metaPath(tutorial.meta, "/tutorials")}.`,
			);
			return ok(body);
		},

		async update(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let body = await render(
					"Tutorial Not Found",
					"/cms/tutorials",
					`Tutorial ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let title = metaTitle(tutorial.meta, tutorial.post.id);
			let body = await render(
				`Update Tutorial ${title}`,
				"/cms/tutorials",
				`Update flow loaded for tutorial "${title}" (${tutorial.post.id}).`,
			);
			return ok(body);
		},
	},
});
