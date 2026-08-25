/**
 * Normalizes CMS bookmark form submissions so the repository layer receives
 * validated input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, string } from "remix/data-schema";

/**
 * A parsed bookmark always carries a title and a url, falling back to
 * placeholder values when the form omits them.
 */
export const BookmarkSchema = object({
	title: defaulted(string(), "Untitled bookmark"),
	url: defaulted(string(), "/"),
});
