import { defaulted, object, string } from "remix/data-schema";

/**
 * Validates CMS bookmark form payloads and normalizes missing title/url values.
 */
export const BookmarkSchema = object({
	title: defaulted(string(), "Untitled bookmark"),
	url: defaulted(string(), "/"),
});
