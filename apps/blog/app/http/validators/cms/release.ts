/**
 * Normalizes the CMS form a weekly releases post is edited with: the author changes its title
 * and Markdown content, while its slug and package list stay as the weekly job wrote them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, string } from "remix/data-schema";

import { RELEASE_TITLE } from "~/app/models/releases";

/** A title left out falls back to the one every releases post starts with. */
export const ReleaseSchema = object({
	title: defaulted(string(), RELEASE_TITLE),
	content: defaulted(string(), ""),
});
