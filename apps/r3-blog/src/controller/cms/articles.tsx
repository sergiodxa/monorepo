import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { CMSArticlesActionView, CMSArticlesIndexView } from "~/views/cms/articles";

namespace CMSArticlesController {
	export interface IndexProps extends CMSArticlesIndexView.Props {}
	export interface ActionProps extends CMSArticlesActionView.Props {}
}

export default controller<typeof routes.cms.articles>({
	middleware: [],

	actions: {
		async index(ctx) {
			let articles = await ArticlePost.findAll(db(ctx));
			let items = articles.map((article) => ({
				id: article.post.id,
				title: article.meta.title,
				slug: article.meta.slug,
				date: formatListDate(article.post.published_at ?? article.post.created_at),
				href: `/cms/articles/${article.post.id}/edit`,
				editHref: `/cms/articles/${article.post.id}/edit`,
				showHref: `/cms/articles/${article.post.id}`,
				deleteAction: `/cms/articles/${article.post.id}`,
				publicHref: `/articles/${article.meta.slug}`,
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

			let formData = await ctx.request.formData();
			let created = await ArticlePost.create(db(ctx), {
				author_id: user.id,
				published_at: parsePublishedAt(formData),
				meta: {
					title: readString(formData, "title") || "Untitled article",
					slug: readString(formData, "slug") || crypto.randomUUID(),
					locale: readString(formData, "locale") || "en",
					excerpt: readString(formData, "excerpt") || undefined,
					canonical_url: readString(formData, "canonical_url") || undefined,
					content: readString(formData, "content") || "",
				},
			});
			if (!created) return redirect("/cms/articles", { status: redirect.Status.SeeOther });

			return redirect(`/cms/articles/${created.post.id}/edit`, {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let articleId = ctx.params.id;
			if (!articleId) {
				return redirect("/cms/articles", { status: redirect.Status.SeeOther });
			}

			await ArticlePost.destroy(db(ctx), articleId);
			return redirect("/cms/articles", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
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
				action: `/cms/articles/${article.post.id}`,
				submitLabel: "Save Article",
				deleteAction: `/cms/articles/${article.post.id}`,
				values: {
					title: article.meta.title ?? "",
					slug: article.meta.slug ?? "",
					locale: article.meta.locale ?? "en",
					excerpt: article.meta.excerpt ?? "",
					canonical_url: article.meta.canonical_url ?? "",
					content: article.meta.content ?? "",
					published_at: toDateInputValue(article.post.published_at),
				},
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/articles">
					<CMSArticlesActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await ArticlePost.findAll(db(ctx))).length;
			let viewProps: CMSArticlesController.ActionProps = {
				title: "New Article",
				description: `New Article form loaded. Current articles count: ${total}.`,
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

		async show(ctx) {
			let article = await ArticlePost.findById(db(ctx), ctx.params.id);
			if (!article) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/articles/${article.meta.slug}`, { status: redirect.Status.SeeOther });
		},

		async update(ctx) {
			let user = authState().user;
			let articleId = ctx.params.id;
			if (!user || !articleId) {
				return redirect("/cms/articles", { status: redirect.Status.SeeOther });
			}

			let formData = await ctx.request.formData();
			let updated = await ArticlePost.update(db(ctx), articleId, {
				author_id: user.id,
				published_at: parsePublishedAt(formData),
				meta: {
					title: readString(formData, "title") || "Untitled article",
					slug: readString(formData, "slug") || articleId,
					locale: readString(formData, "locale") || "en",
					excerpt: readString(formData, "excerpt") || undefined,
					canonical_url: readString(formData, "canonical_url") || undefined,
					content: readString(formData, "content") || "",
				},
			});

			if (!updated) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/cms/articles/${articleId}/edit`, { status: redirect.Status.SeeOther });
		},
	},
});

function readString(formData: FormData, key: string) {
	let value = formData.get(key);
	if (typeof value !== "string") return "";
	return value.trim();
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
