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
import { Post } from "~/models/post";
import { TutorialPost } from "~/models/posts/tutorial";
import routes from "~/routes";
import { CMSTutorialsActionView, CMSTutorialsIndexView } from "~/views/cms/tutorials";
import { NotFoundView } from "~/views/not-found";

let TutorialSchema = object({
	title: defaulted(string(), "Untitled tutorial"),
	slug: optional(string()),
	excerpt: defaulted(string(), ""),
	tags: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});

namespace CMSTutorialsController {
	export interface ActionView extends CMSTutorialsActionView.Props {}
}

export default controller<typeof routes.cms.tutorials>({
	middleware: [],

	actions: {
		async index() {
			let tutorials = await TutorialPost.findAll(db());
			let items = tutorials.map((tutorial) => ({
				id: tutorial.post.id,
				title: tutorial.meta.title,
				publicHref: `/tutorials/${tutorial.meta.slug}`,
				preview: !Post.isPublishedAt(tutorial.post.published_at),
				tags: TutorialPost.tags(tutorial.meta.tags).join(", "),
				href: `/cms/tutorials/${tutorial.post.id}/edit`,
				deleteAction: `/cms/tutorials/${tutorial.post.id}`,
			}));

			let body = await renderToString(
				<CMSLayout title="Tutorials" activePath="/cms/tutorials">
					<CMSTutorialsIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let user = authState().user;
			if (!user) return redirect("/login", { status: redirect.Status.SeeOther });

			let result = await validate(ctx.formData, TutorialSchema);
			succeeded(result, "Invalid tutorial form data");

			let created = await TutorialPost.create(db(), {
				author_id: user.id,
				published_at: parsePublishedAt(result.data.published_at),
				meta: {
					title: result.data.title,
					slug: result.data.slug || parameterize(result.data.title),
					excerpt: result.data.excerpt,
					tags: parseTags(result.data.tags),
					content: result.data.content,
				},
			});
			if (!created) return redirect("/cms/tutorials", { status: redirect.Status.SeeOther });

			return redirect(`/cms/tutorials/${created.post.id}/edit`, {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let tutorialId = ctx.params.id;
			if (!tutorialId) return redirect("/cms/tutorials", { status: redirect.Status.SeeOther });

			await TutorialPost.destroy(db(), tutorialId);
			return redirect("/cms/tutorials", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let tutorial = await TutorialPost.findById(db(), ctx.params.id);
			if (!tutorial) {
				let view: CMSTutorialsController.ActionView = {
					title: "Tutorial Not Found",
					description: `Tutorial ${ctx.params.id} was not found.`,
					mode: "new",
					action: routes.cms.tutorials.index.href(),
					submitLabel: "Create Tutorial",
					values: { title: "", slug: "", excerpt: "", tags: "", content: "", published_at: "" },
				};

				let body = await renderToString(
					<CMSLayout title={view.title} activePath="/cms/tutorials">
						<CMSTutorialsActionView {...view} />
					</CMSLayout>,
				);

				return notFound(body);
			}

			let view: CMSTutorialsController.ActionView = {
				title: `Edit Tutorial ${tutorial.meta.title}`,
				description: `Editing tutorial at /tutorials/${tutorial.meta.slug}.`,
				mode: "edit",
				action: `/cms/tutorials/${tutorial.post.id}`,
				submitLabel: "Save Tutorial",
				deleteAction: `/cms/tutorials/${tutorial.post.id}`,
				values: {
					title: tutorial.meta.title ?? "",
					slug: tutorial.meta.slug ?? "",
					excerpt: tutorial.meta.excerpt ?? "",
					tags: TutorialPost.tags(tutorial.meta.tags).join(", "),
					content: tutorial.meta.content ?? "",
					published_at: toDateInputValue(tutorial.post.published_at),
				},
			};

			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView {...view} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new() {
			let view: CMSTutorialsController.ActionView = {
				title: "New Tutorial",
				description: "Write a new tutorial to share your knowledge with the world.",
				mode: "new",
				action: "/cms/tutorials",
				submitLabel: "Create Tutorial",
				values: {
					title: "",
					slug: "",
					excerpt: "",
					tags: "",
					content: "",
					published_at: "",
				},
			};

			let body = await renderToString(
				<CMSLayout title={view.title} activePath="/cms/tutorials">
					<CMSTutorialsActionView {...view} />
				</CMSLayout>,
			);

			return ok(body);
		},

		async update(ctx) {
			let user = authState().user;
			let tutorialId = ctx.params.id;
			if (!user || !tutorialId) {
				return redirect(routes.cms.tutorials.index.href(), { status: redirect.Status.SeeOther });
			}

			let result = await validate(ctx.formData, TutorialSchema);
			succeeded(result, "Invalid tutorial form data");

			let updated = await TutorialPost.update(db(), tutorialId, {
				author_id: user.id,
				published_at: parsePublishedAt(result.data.published_at),
				meta: {
					title: result.data.title,
					slug: result.data.slug || parameterize(result.data.title),
					excerpt: result.data.excerpt,
					tags: parseTags(result.data.tags),
					content: result.data.content,
				},
			});

			if (!updated) {
				let body = await renderToString(
					<CMSLayout title="Tutorial Not Found" activePath="/cms/tutorials">
						<NotFoundView
							title="Tutorial Not Found"
							description={`Tutorial ${tutorialId} was not found.`}
							emoji="🛠️"
						/>
					</CMSLayout>,
				);

				return notFound(body);
			}

			return redirect(routes.cms.tutorials.edit.href({ id: tutorialId }), {
				status: redirect.Status.SeeOther,
			});
		},
	},
});

function parseTags(value: string | undefined) {
	if (!value) return [];
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function parsePublishedAt(value: string | undefined) {
	if (!value) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		let parsed = new Date(`${value}T00:00:00.000Z`);
		if (Number.isNaN(parsed.getTime())) return null;
		return parsed.toISOString();
	}
	let parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString();
}

function toDateInputValue(value: string | null) {
	if (!value) return "";
	let parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toISOString().slice(0, 10);
}
