import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { TutorialPost } from "~/models/posts/tutorial";
import { CMSTutorialsActionView, CMSTutorialsIndexView } from "~/views/cms/tutorials";

namespace CMSTutorialsController {
	export interface ActionView {
		title: string;
		description: string;
	}
}

export default controller<typeof routes.cms.tutorials>({
	middleware: [],

	actions: {
		async index(ctx) {
			let tutorials = await TutorialPost.findAll(db(ctx));
			let items: Array<CMSTutorialsIndexView.Item> = tutorials.map((tutorial) => ({
				id: tutorial.post.id,
				title: tutorial.meta.title,
				slug: tutorial.meta.slug,
			}));

			let body = await renderToString(
				<CMSLayout title="Tutorials" activePath="/cms/tutorials">
					<CMSTutorialsIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let total = (await TutorialPost.findAll(db(ctx))).length;
			let view: CMSTutorialsController.ActionView = {
				title: "Create Tutorial",
				description: `Create Tutorial. There are currently ${total} tutorials in the database.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let view: CMSTutorialsController.ActionView = {
					title: "Tutorial Not Found",
					description: `Tutorial ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/tutorials">
						<CMSTutorialsActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = tutorial.meta.title;
			let view: CMSTutorialsController.ActionView = {
				title: `Delete Tutorial ${title}`,
				description: `Ready to delete tutorial "${title}" (${tutorial.post.id}).`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async edit(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let view: CMSTutorialsController.ActionView = {
					title: "Tutorial Not Found",
					description: `Tutorial ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/tutorials">
						<CMSTutorialsActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = tutorial.meta.title;
			let view: CMSTutorialsController.ActionView = {
				title: `Edit Tutorial ${title}`,
				description: `Editing tutorial "${title}" at /tutorials/${tutorial.meta.slug}.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await TutorialPost.findAll(db(ctx))).length;
			let view: CMSTutorialsController.ActionView = {
				title: "New Tutorial",
				description: `New Tutorial form loaded. Current tutorials count: ${total}.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let view: CMSTutorialsController.ActionView = {
					title: "Tutorial Not Found",
					description: `Tutorial ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/tutorials">
						<CMSTutorialsActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let view: CMSTutorialsController.ActionView = {
				title: tutorial.meta.title,
				description: `Tutorial ${tutorial.post.id} lives at /tutorials/${tutorial.meta.slug}.`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let view: CMSTutorialsController.ActionView = {
					title: "Tutorial Not Found",
					description: `Tutorial ${ctx.params.id} was not found.`,
				};
				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/tutorials">
						<CMSTutorialsActionView title={view.title} description={view.description} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let title = tutorial.meta.title;
			let view: CMSTutorialsController.ActionView = {
				title: `Update Tutorial ${title}`,
				description: `Update flow loaded for tutorial "${title}" (${tutorial.post.id}).`,
			};
			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView title={view.title} description={view.description} />
				</CMSLayout>,
			);
			return ok(body);
		},
	},
});
