/**
 * The fields the docs contact form submits, validated before anything is emailed: an address
 * to reply to and a message are required, the name is optional, and the page the reader came
 * from is kept only when it is a path on this site, so the email never links elsewhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/** The longest address accepted, the most an email address may hold. */
const MAX_EMAIL_LENGTH = 320;

/** The longest message kept; a few screens of prose, short of a pasted log. */
export const MAX_MESSAGE_LENGTH = 5000;

/** The longest name accepted. */
const MAX_NAME_LENGTH = 200;

/** The longest page path accepted, far beyond any address the site serves. */
const MAX_PAGE_LENGTH = 512;

/**
 * `page` when it is a path on this site — one leading `/` that resolves against the site's own
 * origin — and an empty string otherwise, so a link to another site is dropped, not followed.
 *
 * @param page - The path a link or the hidden field carried.
 * @returns The same path, or `""`.
 * @example sameSitePath("/docs/sdxc/deploy") // "/docs/sdxc/deploy"
 */
export function sameSitePath(page: string): string {
	if (!page.startsWith("/") || page.startsWith("//") || page.includes("\\")) return "";
	if (page.length > MAX_PAGE_LENGTH) return "";
	try {
		return new URL(page, "https://sdxc.dev").origin === "https://sdxc.dev" ? page : "";
	} catch {
		return "";
	}
}

/** A reader's question, as the contact action receives it; surrounding whitespace is dropped. */
export const DocsContactSchema = f.object({
	name: f.field(
		s.defaulted(
			s
				.string()
				.pipe(checks.maxLength(MAX_NAME_LENGTH))
				.transform((value) => value.trim()),
			"",
		),
	),
	email: f.field(
		s
			.string()
			.transform((value) => value.trim())
			.pipe(checks.maxLength(MAX_EMAIL_LENGTH), checks.email()),
	),
	message: f.field(
		s
			.string()
			.pipe(checks.maxLength(MAX_MESSAGE_LENGTH))
			.refine((value) => value.trim() !== "", "Expected a message")
			.transform((value) => value.trim()),
	),
	page: f.field(s.defaulted(s.string().transform(sameSitePath), "")),
});

/** A validated docs contact submission. */
export type DocsContactInput = s.InferOutput<typeof DocsContactSchema>;
