import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";

import { getAuthUser } from "~/app/http/middleware/auth";
import { db } from "~/app/http/middleware/db";
import { TutorialViewModel } from "~/app/http/view-models/cms/tutorials";
import { view } from "~/app/infrastructure/view";
import { Post } from "~/app/repositories/post";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { TutorialSchema } from "~/app/schemas/cms/tutorial";
import { CMSTutorialsActionView, CMSTutorialsIndexView } from "~/resources/views/cms/tutorials";
import routes from "~/routes/web";

export default controller<typeof routes.cms.tutorials>({
	middleware: [],

	actions: {
		async index() {
			let tutorials = await TutorialPost.findAll(db());
			let sources: Array<TutorialViewModel.SourceIndexItem> = tutorials.map((tutorial) => ({
				id: tutorial.id,
				title: tutorial.meta.title,
				slug: tutorial.meta.slug,
				preview: !Post.isPublishedAt(tutorial.published_at),
				tags: tutorial.meta.tags,
			}));
			let items = TutorialViewModel.index({ items: sources });

			return view(CMSTutorialsIndexView, { items });
		},

		async create(ctx) {
			let user = getAuthUser();
			if (!user)
				return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), TutorialSchema);
			succeeded(result, "Invalid tutorial form data");
			let input = TutorialViewModel.input({ data: result.data });

			let created = await TutorialPost.create(db(), {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!created)
				return redirect(routes.cms.tutorials.index.href(), {
					status: redirect.Status.SeeOther,
				});

			return redirect(routes.cms.tutorials.edit.href({ id: created.id }), {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let id = ctx.params.id;
			if (!id)
				return redirect(routes.cms.tutorials.index.href(), { status: redirect.Status.SeeOther });

			await TutorialPost.destroy(db(), id);
			return redirect(routes.cms.tutorials.index.href(), { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let id = ctx.params.id;
			let tutorial = id ? await TutorialPost.findById(db(), id) : null;

			if (!tutorial) {
				let model = TutorialViewModel.notFound({ id });
				return view(CMSTutorialsActionView, model, { status: 404 });
			}

			let source: TutorialViewModel.SourceEditItem = {
				id: tutorial.id,
				title: tutorial.meta.title,
				slug: tutorial.meta.slug,
				excerpt: tutorial.meta.excerpt,
				tags: tutorial.meta.tags,
				content: tutorial.meta.content,
				published_at: tutorial.published_at,
			};
			let model = TutorialViewModel.edit({ tutorial: source });

			return view(CMSTutorialsActionView, model);
		},

		async new() {
			let model = TutorialViewModel.new({});

			return view(CMSTutorialsActionView, model);
		},

		async update(ctx) {
			let user = getAuthUser();
			let id = ctx.params.id;
			if (!user || !id)
				return redirect(routes.cms.tutorials.index.href(), { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), TutorialSchema);
			succeeded(result, "Invalid tutorial form data");
			let input = TutorialViewModel.input({ data: result.data });

			let updated = await TutorialPost.update(db(), id, {
				author_id: user.id,
				published_at: input.published_at,
				meta: input.meta,
			});

			if (!updated) {
				let model = TutorialViewModel.notFound({ id });
				return view(CMSTutorialsActionView, model, { status: 404 });
			}

			return redirect(routes.cms.tutorials.edit.href({ id }), { status: redirect.Status.SeeOther });
		},
	},
});
