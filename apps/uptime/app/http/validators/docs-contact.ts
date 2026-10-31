/**
 * The fields the docs contact form submits, validated before anything is emailed: an address
 * to reply to and a message are required, the name and the page the reader came from are
 * optional, and every field is capped so one submission stays one readable email.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

import { emailAddress } from "~/app/http/validators/email-address";

/** The longest address accepted, the most an email address may hold. */
const MAX_EMAIL_LENGTH = 320;

/** The longest message kept; past this a reader is pasting logs, which a reply can ask for. */
const MAX_MESSAGE_LENGTH = 5000;

/** The longest name or page accepted. */
const MAX_SHORT_LENGTH = 200;

/** A reader's question, as the contact action receives it. */
export const DocsContactSchema = f.object({
	name: f.field(s.defaulted(s.string().pipe(checks.maxLength(MAX_SHORT_LENGTH)), "")),
	email: f.field(
		s.string().pipe(checks.minLength(1), checks.maxLength(MAX_EMAIL_LENGTH), emailAddress()),
	),
	message: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(MAX_MESSAGE_LENGTH))),
	page: f.field(s.defaulted(s.string().pipe(checks.maxLength(MAX_SHORT_LENGTH)), "")),
});

/** A validated docs contact submission. */
export type DocsContactInput = s.InferOutput<typeof DocsContactSchema>;
