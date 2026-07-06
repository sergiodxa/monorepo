/**
 * RSS feed route that aggregates articles, likes, tutorials, and glossary terms,
 * sorts the combined items by publish date, and serializes them into an XML feed
 * with a localized title and description. It gives readers a single subscribable
 * feed covering all of the site's content types.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RSS } from "@pkg/rss";
import { href } from "react-router";
import { xml } from "remix-utils/responses";

import { getRequest } from "~/middleware/context-storage";
import { getI18nextInstance, getLocale } from "~/middleware/i18next";

import type { Route } from "./+types/route";

import { queryArticles, queryGlossary, queryLikes, queryTutorials } from "./queries";

export async function loader(_: Route.LoaderArgs) {
	let data = await Promise.all([queryArticles(), queryLikes(), queryTutorials(), queryGlossary()]);

	let feed = data.flat().sort((a, b) => {
		return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
	});

	let locale = getLocale();
	let i18n = getI18nextInstance();
	let t = i18n.getFixedT(locale, "translation", "rss");

	let rss = new RSS({
		title: t("title"),
		description: t("description"),
		link: new URL(href("/rss"), getRequest().url).toString(),
	});

	for (let item of feed) rss.addItem(item);

	return xml(rss.toString());
}
