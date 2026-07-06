/**
 * CMS articles management route listing every article (including drafts) with a
 * link to create a new one. Its loader formats each article for display, and its
 * action handles the delete and move-to-tutorial intents before redirecting back
 * to the list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { Button, Form, Heading, Toolbar } from "@pkg/ui";
import { href, redirect } from "react-router";
import { z } from "zod";

import { getDB } from "~/middleware/drizzle";
import { getLocale } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { Article } from "~/models/article.server";
import { assertUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

import { ArticlesList } from "./components/article-list";
import { deleteArticle, moveToTutorial } from "./queries";
import { INTENT } from "./types";

export async function loader(_: Route.LoaderArgs) {
	let db = getDB();
	let articles = await Article.list({ db }, { onlyPublished: false });
	let locale = getLocale();

	return ok({
		articles: articles.map((article) => {
			return {
				id: article.id,
				title: article.title,
				path: article.pathname,
				date: article.createdAt.toLocaleDateString(locale, {
					year: "numeric",
					month: "short",
					day: "numeric",
				}),
				isPublished: article.isPublished,
				publishedAt: article.publishedAt?.toISOString() ?? null,
			};
		}),
	});
}

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let intent = z.enum([INTENT.delete, INTENT.moveToTutorial]).parse(formData.get("intent"));

	try {
		if (intent === INTENT.delete) {
			let id = formData.get("id");
			assertUUID(id);
			await deleteArticle(id);
		}

		if (intent === INTENT.moveToTutorial) {
			let id = formData.get("id");
			assertUUID(id);
			await moveToTutorial(id);
		}

		throw redirect(href("/cms/articles"));
	} catch (exception) {
		if (exception instanceof Response) throw exception;
		if (exception instanceof Error)
			logger.error("cms-articles-action-failed", { error: exception.message });
		throw redirect(href("/cms/articles"));
	}
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Toolbar className="items-center">
				<Heading level={2}>Articles</Heading>
				<div className="grow" />
				<Form method="get" action="/cms/articles/new">
					<Button type="submit" color="primary">
						Write Article
					</Button>
				</Form>
			</Toolbar>

			<ArticlesList articles={loaderData.articles} />
		</div>
	);
}
