/**
 * Loader route that builds the bookmarks ("likes") RSS feed. It lists all saved
 * likes, resolves localized feed metadata via i18next, and emits one RSS item per
 * bookmark linking to the external URL. Exists to let readers subscribe to the links
 * the author saves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RSS } from "@pkg/rss";
import { href } from "react-router";
import { xml } from "remix-utils/responses";

import { getDB } from "~/middleware/drizzle";
import { getI18nextInstance, getLocale } from "~/middleware/i18next";
import { Like } from "~/models/like.server";

import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
	let likes = await Like.list({ db: getDB() });

	let locale = getLocale();
	let i18n = getI18nextInstance();
	let t = i18n.getFixedT(locale, "translation", "rss.bookmarks");

	let rss = new RSS({
		title: t("title"),
		description: t("description"),
		link: new URL(href("/bookmarks.rss"), request.url).toString(),
	});

	for (let like of likes) {
		let link = like.url.toString();

		rss.addItem({
			guid: like.id,
			title: like.title,
			description: `<a href="${link}">${t("cta")}</a>`,
			link,
			pubDate: like.createdAt.toUTCString(),
		});
	}

	return xml(rss.toString());
}
