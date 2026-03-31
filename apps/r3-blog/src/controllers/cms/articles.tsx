import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { parameterize } from "inflected";
import { renderToString } from "remix/component/server";
import { defaulted, object, optional, string } from "remix/data-schema";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { Post } from "~/models/post";
import { ArticlePost } from "~/models/posts/article";
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

	actions: {
		async index() {
			let articles = await ArticlePost.findAll(db());
			let items = articles.map((article) => ({
				id: article.id,
				title: article.meta.title,
				publicHref: `/articles/${article.meta.slug}`,
				preview: !Post.isPublishedAt(article.published_at),
				href: `/cms/articles/${article.id}/edit`,
				deleteAction: `/cms/articles/${article.id}`,
			}));

			let body = await renderToString(
				<CMSLayout title="Articles" activePath="/cms/articles">
					<CMSArticlesIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let user = authState().user;
			if (!user) return redirect("/login", { status: redirect.Status.SeeOther });

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");

			let created = await ArticlePost.create(db(), {
				author_id: user.id,
				published_at: parsePublishedAt(result.data.published_at),
				meta: {
					title: result.data.title,
					slug: result.data.slug || parameterize(result.data.title),
					locale: result.data.locale,
					excerpt: result.data.excerpt,
					canonical_url: result.data.canonical_url,
					content: result.data.content,
				},
			});
			if (!created) return redirect("/cms/articles", { status: redirect.Status.SeeOther });

			return redirect(`/cms/articles/${created.id}/edit`, {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let articleId = ctx.params.id;
			if (!articleId) {
				return redirect("/cms/articles", { status: redirect.Status.SeeOther });
			}

			await ArticlePost.destroy(db(), articleId);
			return redirect("/cms/articles", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let article = await ArticlePost.findById(db(), ctx.params.id);
			if (!article) {
				let viewProps: CMSArticlesController.ActionProps = {
					title: "Article Not Found",
					description: `Article ${ctx.params.id} was not found.`,
					mode: "new",
					action: "/cms/articles",
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
				};
				let body = await renderToString(
					<CMSLayout title={viewProps.title} activePath="/cms/articles">
						<CMSArticlesActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let viewProps: CMSArticlesController.ActionProps = {
				title: `Edit Article ${article.meta.title}`,
				description: `Editing article at /articles/${article.meta.slug}.`,
				mode: "edit",
				action: `/cms/articles/${article.id}`,
				submitLabel: "Save Article",
				deleteAction: `/cms/articles/${article.id}`,
				values: {
					title: article.meta.title ?? "",
					slug: article.meta.slug ?? "",
					locale: article.meta.locale ?? "en",
					excerpt: article.meta.excerpt ?? "",
					canonical_url: article.meta.canonical_url ?? "",
					content: article.meta.content ?? "",
					published_at: toDateInputValue(article.published_at),
				},
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new() {
			let viewProps: CMSArticlesController.ActionProps = {
				title: "New Article",
				description: "Write a new article to share your knowledge with the world.",
				mode: "new",
				action: "/cms/articles",
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
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let user = authState().user;
			let articleId = ctx.params.id;
			if (!user || !articleId) {
				return redirect("/cms/articles", { status: redirect.Status.SeeOther });
			}

			let result = await validate(ctx.get(FormData), ArticleSchema);
			succeeded(result, "Invalid article form data");

			let updated = await ArticlePost.update(db(), articleId, {
				author_id: user.id,
				published_at: parsePublishedAt(result.data.published_at),
				meta: {
					title: result.data.title,
					slug: result.data.slug || parameterize(result.data.title),
					locale: result.data.locale,
					excerpt: result.data.excerpt,
					canonical_url: result.data.canonical_url,
					content: result.data.content,
				},
			});

			if (!updated) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/cms/articles/${articleId}/edit`, { status: redirect.Status.SeeOther });
		},
	},
});

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
