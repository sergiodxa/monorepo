import { defaulted, object, string } from "remix/data-schema";

export const BookmarkSchema = object({
	title: defaulted(string(), "Untitled bookmark"),
	url: defaulted(string(), "/"),
});
