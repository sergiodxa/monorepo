/**
 * Data helpers for the tutorials listing route. queryTutorials searches or lists
 * tutorials via the Tutorial model, hiding drafts from non-admins and normalizing
 * results to path/title/isPublished, while getMeta builds the page's title and
 * RSS/canonical link meta. It exists to keep the tutorials route's data and meta
 * logic out of the route module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getDB } from "~/middleware/drizzle";
import { getI18nextInstance } from "~/middleware/i18next";
import { getUser } from "~/middleware/session";
import { Tutorial } from "~/models/tutorial.server";

import type { Route } from "./+types/route";

export async function queryTutorials(query: string | null) {
	let db = getDB();
	let user = getUser();
	let isAdmin = user?.role === "admin";

	let tutorials = query
		? await Tutorial.search({ db }, query, { onlyPublished: !isAdmin })
		: await Tutorial.list({ db }, { onlyPublished: !isAdmin });

	return tutorials.map((tutorial) => {
		if (tutorial instanceof Tutorial) {
			return {
				path: tutorial.pathname,
				title: tutorial.title,
				isPublished: tutorial.isPublished,
			};
		}

		return {
			path: tutorial.item.pathname,
			title: tutorial.item.title,
			isPublished: tutorial.item.isPublished,
		};
	});
}

export function getMeta(url: URL, query: string) {
	let { t } = getI18nextInstance();

	let meta: Route.MetaDescriptors = [];

	if (query === "") {
		meta.push({ title: t("tutorials.meta.title.default") });
	} else {
		meta.push({
			title: t("tutorials.meta.title.search", {
				query: decodeURIComponent(query),
			}),
		});
	}

	meta.push({
		tagName: "link",
		rel: "alternate",
		type: "application/rss+xml",
		href: "/tutorials.rss",
	});

	meta.push({
		tagName: "link",
		rel: "canonical",
		href: new URL("/tutorials", url).toString(),
	});

	return meta;
}
