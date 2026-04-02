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
import { ArticlePost } from "~/app/repositories/posts/article";
import { CMSLayout } from "~/components/layout/cms";
import routes from "~/routes";
import { CMSArticlesActionView, CMSArticlesIndexView } from "~/views/cms/articles";

const ArticleSchema = object({
	title: defaulted(string(), "Untitled article"),
	slug: optional(string()),
	locale: defaulted(string(), "en"),
	excerpt: optional(string()),
	canonical_url: optional(string()),
	content: defaulted(string(), ""),
	published_at: optional(string()),
});

namespace CMSArticlesController {
	export interface IndexProps extends CMSArticlesIndexView.Props {}
	export interface ActionProps extends CMSArticlesActionView.Props {}
}

export default controller<typeof routes.cms.articles>({
	middleware: [],

	actions: createCMSCrudActions({
		model: ArticlePost,
		paths: {
			indexHref: routes.cms.articles.index.href(),
			loginHref: routes.auth.login.index.href(),
			editHref(id) {
				return routes.cms.articles.edit.href({ id });
			},
		},
		index: {
			mapItems(articles) {
				return articles.map((article) => ({
					id: article.id,
					title: article.meta.title,
					publicHref: routes.post.href({ postType: "articles", postSlug: article.meta.slug }),
					preview: !Post.isPublishedAt(article.published_at),
					href: routes.cms.articles.edit.href({ id: article.id }),
					deleteAction: routes.cms.articles.destroy.href({ id: article.id }),
				}));
			},
			async render(items) {
				return renderToString(
					<CMSLayout title="Articles" activePath={routes.cms.articles.index.href()}>
						<CMSArticlesIndexView items={items} />
					</CMSLayout>,
				);
			},
		},
		action: {
			buildEditProps(article): CMSArticlesController.ActionProps {
				return {
					title: `Edit Article ${article.meta.title}`,
					description: `Editing article at ${routes.post.href({ postType: "articles", postSlug: article.meta.slug })}.`,
					mode: "edit",
					action: routes.cms.articles.update.href({ id: article.id }),
					submitLabel: "Save Article",
					deleteAction: routes.cms.articles.destroy.href({ id: article.id }),
					values: {
						title: article.meta.title ?? "",
						slug: article.meta.slug ?? "",
						locale: article.meta.locale ?? "en",
						excerpt: article.meta.excerpt ?? "",
						canonical_url: article.meta.canonical_url ?? "",
						content: article.meta.content ?? "",
						published_at: toDateInputValue(article.published_at),
					},
				} satisfies CMSArticlesController.ActionProps;
			},
			buildNotFoundProps(id): CMSArticlesController.ActionProps {
				return {
					title: "Article Not Found",
					description: `Article ${id} was not found.`,
					mode: "new",
					action: routes.cms.articles.index.href(),
					submitLabel: "Create Article",
					values: {
						title: "",
						slug: "",
						locale: "en",
						excerpt: "",
						canonical_url: "",
						content: "",
						published_at: "",
					},
				} satisfies CMSArticlesController.ActionProps;
			},
			buildNewProps(): CMSArticlesController.ActionProps {
				return {
					title: "New Article",
					description: "Write a new article to share your knowledge with the world.",
					mode: "new",
					action: routes.cms.articles.index.href(),
					submitLabel: "Create Article",
					values: {
						title: "",
						slug: "",
						locale: "en",
						excerpt: "",
						canonical_url: "",
						content: "",
						published_at: "",
					},
				} satisfies CMSArticlesController.ActionProps;
			},
			async render(viewProps) {
				return renderToString(
					<CMSLayout title={viewProps.title} activePath={routes.cms.articles.index.href()}>
						<CMSArticlesActionView {...viewProps} />
					</CMSLayout>,
				);
			},
		},
		form: {
			async parse(formData) {
				let result = await validate(formData, ArticleSchema);
				succeeded(result, "Invalid article form data");
				return result.data;
			},
			toCreateInput(data, user) {
				return {
					author_id: user.id,
					published_at: parsePublishedAt(data.published_at),
					meta: {
						title: data.title,
						slug: data.slug || parameterize(data.title),
						locale: data.locale,
						excerpt: data.excerpt,
						canonical_url: data.canonical_url,
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
						locale: data.locale,
						excerpt: data.excerpt,
						canonical_url: data.canonical_url,
						content: data.content,
					},
				};
			},
		},
		onUpdateMissing() {
			return notFound("<h1>404 Not Found</h1>");
		},
	}),
});
