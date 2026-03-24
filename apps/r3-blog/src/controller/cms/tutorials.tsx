import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { TutorialPost } from "~/models/posts/tutorial";
import { CMSTutorialsActionView, CMSTutorialsIndexView } from "~/views/cms/tutorials";

namespace CMSTutorialsController {
	export interface ActionView extends CMSTutorialsActionView.Props {}
}

export default controller<typeof routes.cms.tutorials>({
	middleware: [],

	actions: {
		async index(ctx) {
			let tutorials = await TutorialPost.findAll(db(ctx));
			let items = tutorials.map((tutorial) => ({
				id: tutorial.post.id,
				title: tutorial.meta.title,
				slug: tutorial.meta.slug,
				date: formatListDate(tutorial.post.published_at ?? tutorial.post.created_at),
				href: `/cms/tutorials/${tutorial.post.id}/edit`,
				editHref: `/cms/tutorials/${tutorial.post.id}/edit`,
				showHref: `/cms/tutorials/${tutorial.post.id}`,
				deleteAction: `/cms/tutorials/${tutorial.post.id}`,
				publicHref: `/tutorials/${tutorial.meta.slug}`,
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

			let formData = await ctx.request.formData();
			let created = await TutorialPost.create(db(ctx), {
				author_id: user.id,
				published_at: parsePublishedAt(formData),
				meta: {
					title: readString(formData, "title") || "Untitled tutorial",
					slug: readString(formData, "slug") || crypto.randomUUID(),
					excerpt: readString(formData, "excerpt") || "",
					tags: parseTags(formData),
					content: readString(formData, "content") || "",
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

			await TutorialPost.destroy(db(ctx), tutorialId);
			return redirect("/cms/tutorials", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) {
				let view: CMSTutorialsController.ActionView = {
					title: "Tutorial Not Found",
					description: `Tutorial ${ctx.params.id} was not found.`,
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

		async new(ctx) {
			let total = (await TutorialPost.findAll(db(ctx))).length;
			let view: CMSTutorialsController.ActionView = {
				title: "New Tutorial",
				description: `New Tutorial form loaded. Current tutorials count: ${total}.`,
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

		async show(ctx) {
			let tutorial = await TutorialPost.findById(db(ctx), ctx.params.id);
			if (!tutorial) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/tutorials/${tutorial.meta.slug}`, { status: redirect.Status.SeeOther });
		},

		async update(ctx) {
			let user = authState().user;
			let tutorialId = ctx.params.id;
			if (!user || !tutorialId) {
				return redirect("/cms/tutorials", { status: redirect.Status.SeeOther });
			}

			let formData = await ctx.request.formData();
			let updated = await TutorialPost.update(db(ctx), tutorialId, {
				author_id: user.id,
				published_at: parsePublishedAt(formData),
				meta: {
					title: readString(formData, "title") || "Untitled tutorial",
					slug: readString(formData, "slug") || tutorialId,
					excerpt: readString(formData, "excerpt") || "",
					tags: parseTags(formData),
					content: readString(formData, "content") || "",
				},
			});

			if (!updated) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/cms/tutorials/${tutorialId}/edit`, { status: redirect.Status.SeeOther });
		},
	},
});

function readString(formData: FormData, key: string) {
	let value = formData.get(key);
	if (typeof value !== "string") return "";
	return value.trim();
}

function parseTags(formData: FormData) {
	let value = readString(formData, "tags");
	if (!value) return [];

	let tags = value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);

	return tags;
}

function parsePublishedAt(formData: FormData) {
	let value = readString(formData, "published_at");
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

function formatListDate(value: string) {
	let parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toISOString().slice(0, 10);
}
