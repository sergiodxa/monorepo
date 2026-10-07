/**
 * Parses the CMS bookmark forms: the full create/edit form and the quick add, which sends
 * a URL alone. Title and description may stay empty, since saving reads them from the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, string } from "remix/data-schema";

/** A URL with something in it besides whitespace. */
const URL_FIELD = string().refine((value) => value.trim() !== "", "Enter a URL to bookmark");

/**
 * A parsed bookmark form always carries a URL; a missing title or description parses as an
 * empty string, which asks for the page's own.
 */
export const BookmarkSchema = object({
	url: URL_FIELD,
	title: defaulted(string(), ""),
	description: defaulted(string(), ""),
});

/**
 * The query `/cms/bookmarks/new` and the edit page accept: a URL to prefill the form with,
 * which is how a shared link or a moved bookmark's new address arrives, and the flag an
 * edit page is opened with when a save found the bookmark already existed.
 */
export const BookmarkPrefillSchema = object({
	url: defaulted(string(), ""),
	duplicate: defaulted(string(), ""),
});
