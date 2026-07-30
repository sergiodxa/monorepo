/**
 * Data-schema for validating CMS bookmark form submissions. `BookmarkSchema`
 * requires title and url, defaulting them to placeholder values when missing.
 * Exists to normalize and validate bookmark input before it reaches the
 * repository layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { defaulted, object, string } from "remix/data-schema";

/**
 * Validates CMS bookmark form payloads and normalizes missing title/url values.
 */
export const BookmarkSchema = object({
	title: defaulted(string(), "Untitled bookmark"),
	url: defaulted(string(), "/"),
});
