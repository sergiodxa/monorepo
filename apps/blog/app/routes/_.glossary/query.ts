/**
 * Data helper for the public glossary route. queryGlossary lists all glossary
 * terms, sorts them by term using the current locale's collation, and maps each to
 * the id, slug, title, term and definition fields the page needs. It exists to keep
 * the glossary route's data fetching and locale-aware sorting out of the route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getDB } from "~/middleware/drizzle";
import { getLocale } from "~/middleware/i18next";
import { Glossary } from "~/models/glossary.server";

export async function queryGlossary() {
	let locale = getLocale();
	let db = getDB();

	let glossary = await Glossary.list({ db });
	return glossary
		.sort((a, b) => a.term.localeCompare(b.term, locale))
		.map((item) => {
			return {
				id: item.id,
				slug: item.slug,
				title: item.title,
				term: item.term,
				definition: item.definition,
			};
		});
}
