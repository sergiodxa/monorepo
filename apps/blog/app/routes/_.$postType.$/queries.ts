import { isFailure } from "@pkg/result";
import { type MetaDescriptor, href } from "react-router";

import { getI18nextInstance, getLocale } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { getUser } from "~/middleware/session";
import findArticleBySlug from "~/services/find-article-by-slug";
import findTutorialBySlug from "~/services/find-tutorial-by-slug";
import findTutorialRecommendationsBySlug from "~/services/find-tutorial-recommendations-by-slug";
import { Markdown } from "~/utils/markdown";

export async function queryArticle(request: Request, slug: string) {
	let result = await findArticleBySlug(slug);

	if (isFailure(result)) {
		logger.error("query-article-failed", { slug, error: result.error.message });
		throw new Error("Article not found");
	}

	let article = result.data;
	let user = getUser();
	let isAdmin = user?.role === "admin";
	let isPreview = !article.isPublished;

	if (isPreview && !isAdmin) {
		logger.info("article-forbidden-for-non-admin", { slug, userId: user?.id });
		throw new Error("Article not published yet");
	}

	let i18n = getI18nextInstance();

	return {
		postType: "articles" as const,
		isPreview,
		publishedAt: article.publishedAt,
		article: {
			id: article.id,
			title: article.title,
			body: Markdown.parse(`# ${article.title}\n${article.content}`),
		},
		meta: [
			{
				title: i18n.t("article.meta.title", {
					note: article.title,
					interpolation: { escapeValue: false },
				}),
			},
			{ name: "description", content: article.excerpt },
			{
				tagName: "link",
				rel: "canonical",
				href:
					article.canonicalUrl ??
					new URL(
						href("/:postType/*", { postType: "articles", "*": article.slug }),
						request.url,
					).toString(),
			},
			{
				tagName: "link",
				rel: "alternate",
				hrefLang: "en",
				href: new URL(
					href("/md/:postType/*", {
						postType: "articles",
						"*": article.slug,
					}),
					request.url,
				).toString(),
			},
			{
				"script:ld+json": {
					"@context": "https://schema.org",
					"@type": "Article",
					headline: article.title,
					description: article.excerpt,
					author: {
						"@type": "Person",
						name: article.author.displayName,
						url: new URL("/about", request.url).toString(),
					},
					wordCount: countWords(article.title, article.content),
					datePublished: article.createdAt.toISOString(),
					dateModified: article.updatedAt.toISOString(),
				},
			},
		] satisfies MetaDescriptor[],
	};
}

export async function queryTutorial(request: Request, slug: string) {
	let [tutorialResult, recommendations] = await Promise.all([
		findTutorialBySlug(slug),
		findTutorialRecommendationsBySlug(slug),
	]);

	if (isFailure(tutorialResult)) {
		logger.error("query-tutorial-failed", { slug, error: tutorialResult.error.message });
		throw new Error("Tutorial not found");
	}

	let tutorial = tutorialResult.data;
	let user = getUser();
	let isAdmin = user?.role === "admin";
	let isPreview = !tutorial.isPublished;

	if (isPreview && !isAdmin) {
		logger.info("tutorial-forbidden-for-non-admin", { slug, userId: user?.id });
		throw new Error("Tutorial not published yet");
	}

	let locale = getLocale();
	let i18n = getI18nextInstance();

	let title = i18n.t("tutorial.document.title", {
		title: tutorial.title,
		interpolation: { escapeValue: false },
	});

	return {
		postType: "tutorials" as const,
		isPreview,
		publishedAt: tutorial.publishedAt,
		tutorial: {
			id: tutorial.id,
			slug: tutorial.slug,
			tags: tutorial.tags,
			title: tutorial.title,
			content: Markdown.parse(tutorial.content),
		},
		recommendations,
		meta: [
			{ title },
			{ name: "description", content: tutorial.excerpt },
			{ property: "og:title", content: title },
			{ property: "og:type", content: "article" },
			{ property: "og:url", content: request.url },
			{ property: "og:site_name", content: "Sergio Xalambrí" },
			{ property: "og:locale", content: locale },
			{ property: "twitter:card", content: "summary" },
			{ property: "twitter:creator", content: "@sergiodxa" },
			{ property: "twitter:site", content: "@sergiodxa" },
			{ property: "twitter:title", content: title },
			{
				tagName: "link",
				rel: "canonical",
				href: new URL(
					href("/:postType/*", {
						postType: "tutorials",
						"*": tutorial.slug,
					}),
					request.url,
				).toString(),
			},
			{
				tagName: "link",
				rel: "alternate",
				hrefLang: "en",
				href: new URL(
					href("/md/:postType/*", {
						postType: "tutorials",
						"*": tutorial.slug,
					}),
					request.url,
				).toString(),
			},
			{
				"script:ld+json": {
					"@context": "https://schema.org",
					"@type": "Article",
					headline: tutorial.title,
					description: tutorial.excerpt,
					author: {
						"@type": "Person",
						name: tutorial.author.displayName,
						url: new URL("/about", request.url).toString(),
					},
					wordCount: countWords(tutorial.title, tutorial.content),
					datePublished: tutorial.createdAt.toISOString(),
					dateModified: tutorial.updatedAt.toISOString(),
				},
			},
		] satisfies MetaDescriptor[],
	};
}

function countWords(title: string, content: string) {
	let titleLength = title.split(/\s+/).length;
	return Markdown.plain(content).split(/\s+/).length + titleLength;
}
