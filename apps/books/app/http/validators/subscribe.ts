/**
 * Validator for the newsletter and sample-chapter forms: an email address plus the
 * optional UTM attribution the pages carry through as hidden fields. One schema serves
 * every form on the site, because they all collect exactly these fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { email } from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/**
 * The copy a visitor reads when the address fails validation. Since only
 * `email` can fail, the controller shows this exact message for any
 * validation issue, keeping the wording reader-friendly.
 */
export const INVALID_EMAIL_MESSAGE = "Invalid email address";

/** The subscribe form's shape: the address, plus the UTM fields the pages carry through. */
export const SubscribeSchema = f.object({
	email: f.field(s.string().pipe(email())),
	source: f.field(s.optional(s.string())),
	campaign: f.field(s.optional(s.string())),
	medium: f.field(s.optional(s.string())),
	referral: f.field(s.optional(s.string())),
});

/** The validated subscribe payload, as controllers and use cases receive it. */
export type SubscribeInput = s.InferOutput<typeof SubscribeSchema>;
