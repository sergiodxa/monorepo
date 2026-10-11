/**
 * The glossary entries the glossary tools read. The glossary has no per-term page, so its
 * entries are tools only, and both tools apply the same publish rule through here.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BlogModels } from "~/app/models";

import { isPublishedAt } from "~/app/models/post-values";

/**
 * Reads every published glossary entry.
 *
 * The publish filter is applied here because `glossary.findAll()` returns every row,
 * preview entries included.
 */
export async function published(models: BlogModels) {
	let entries = await models.glossary.findAll();
	return entries.filter((entry) => isPublishedAt(entry.published_at));
}
