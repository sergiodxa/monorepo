import { notFound } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { parameterize } from "inflected";
import { renderToString } from "remix/component/server";
import { defaulted, object, optional, string } from "remix/data-schema";

import { createCMSCrudActions } from "~/app/http/support/cms/crud";
import { parsePublishedAt, toDateInputValue } from "~/app/http/support/cms/published-at";
import { Post } from "~/app/repositories/post";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import { CMSLayout } from "~/components/layout/cms";
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

	actions: createCMSCrudActions({
		model: TutorialPost,
		paths: {
			indexHref: routes.cms.tutorials.index.href(),
			loginHref: routes.auth.login.index.href(),
			editHref(id) {
				return routes.cms.tutorials.edit.href({ id });
			},
		},
		index: {
			mapItems(tutorials) {
				return tutorials.map((tutorial) => ({
					id: tutorial.id,
					title: tutorial.meta.title,
					publicHref: routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }),
					preview: !Post.isPublishedAt(tutorial.published_at),
					tags: TutorialPost.tags(tutorial.meta.tags).join(", "),
					href: routes.cms.tutorials.edit.href({ id: tutorial.id }),
					deleteAction: routes.cms.tutorials.destroy.href({ id: tutorial.id }),
				}));
			},
			async render(items) {
				return renderToString(
					<CMSLayout title="Tutorials" activePath={routes.cms.tutorials.index.href()}>
						<CMSTutorialsIndexView items={items} />
					</CMSLayout>,
				);
			},
		},
		action: {
			buildEditProps(tutorial): CMSTutorialsController.ActionView {
				return {
					title: `Edit Tutorial ${tutorial.meta.title}`,
					description: `Editing tutorial at ${routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug })}.`,
					mode: "edit",
					action: routes.cms.tutorials.update.href({ id: tutorial.id }),
					submitLabel: "Save Tutorial",
					deleteAction: routes.cms.tutorials.destroy.href({ id: tutorial.id }),
					values: {
						title: tutorial.meta.title ?? "",
						slug: tutorial.meta.slug ?? "",
						excerpt: tutorial.meta.excerpt ?? "",
						tags: TutorialPost.tags(tutorial.meta.tags).join(", "),
						content: tutorial.meta.content ?? "",
						published_at: toDateInputValue(tutorial.published_at),
					},
				};
			},
			buildNotFoundProps(id): CMSTutorialsController.ActionView {
				return {
					title: "Tutorial Not Found",
					description: `Tutorial ${id} was not found.`,
					mode: "new",
					action: routes.cms.tutorials.index.href(),
					submitLabel: "Create Tutorial",
					values: { title: "", slug: "", excerpt: "", tags: "", content: "", published_at: "" },
				};
			},
			buildNewProps(): CMSTutorialsController.ActionView {
				return {
					title: "New Tutorial",
					description: "Write a new tutorial to share your knowledge with the world.",
					mode: "new",
					action: routes.cms.tutorials.index.href(),
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
			},
			async render(view) {
				return renderToString(
					<CMSLayout title={view.title} activePath={routes.cms.tutorials.index.href()}>
						<CMSTutorialsActionView {...view} />
					</CMSLayout>,
				);
			},
		},
		form: {
			async parse(formData) {
				let result = await validate(formData, TutorialSchema);
				succeeded(result, "Invalid tutorial form data");
				return result.data;
			},
			toCreateInput(data, user) {
				return {
					author_id: user.id,
					published_at: parsePublishedAt(data.published_at),
					meta: {
						title: data.title,
						slug: data.slug || parameterize(data.title),
						excerpt: data.excerpt,
						tags: parseTags(data.tags),
						content: data.content,
					},
				};
			},
			toUpdateInput(data, user) {
				return {
					author_id: user.id,
					published_at: parsePublishedAt(data.published_at),
					meta: {
						title: data.title,
						slug: data.slug || parameterize(data.title),
						excerpt: data.excerpt,
						tags: parseTags(data.tags),
						content: data.content,
					},
				};
			},
		},
		onUpdateMissing(tutorialId) {
			return renderToString(
				<CMSLayout title="Tutorial Not Found" activePath={routes.cms.tutorials.index.href()}>
					<NotFoundView
						title="Tutorial Not Found"
						description={`Tutorial ${tutorialId} was not found.`}
						emoji="🛠️"
					/>
				</CMSLayout>,
			).then((body) => notFound(body));
		},
	}),
});

function parseTags(value: string | undefined) {
	if (!value) return [];
	return value
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}
