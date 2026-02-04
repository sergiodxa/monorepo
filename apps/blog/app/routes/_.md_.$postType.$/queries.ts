import { logger } from "@pkg/logger";
import { isFailure } from "@pkg/result";

import { getI18nextInstance, getLocale } from "~/middleware/i18next";
import findArticleBySlug from "~/services/find-article-by-slug";
import findTutorialBySlug from "~/services/find-tutorial-by-slug";

export async function queryArticle(slug: string) {
	let result = await findArticleBySlug(slug);

	if (isFailure(result)) {
		logger.error("query-article-failed", { slug, error: result.error.message });
		throw new Error("Article not found");
	}

	let article = result.data;
	return [`# ${article.title}`, article.content].join("\n\n");
}

export async function queryTutorial(slug: string) {
	let locale = getLocale();
	let i18next = getI18nextInstance();

	let result = await findTutorialBySlug(slug);

	if (isFailure(result)) {
		logger.error("query-tutorial-failed", { slug, error: result.error.message });
		throw new Error("Tutorial not found");
	}

	let tutorial = result.data;
	let value = [`# ${tutorial.title}`];

	if (tutorial.tags?.[0]) {
		let list = new Intl.ListFormat(locale, {
			style: "long",
			type: "conjunction",
		});

		value.push(`${i18next.t("tutorial.tags")}: ${list.format(tutorial.tags)}`);
	}

	value.push(tutorial.content);

	return value.join("\n\n");
}
