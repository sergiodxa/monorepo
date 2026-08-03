/**
 * Form validation schema for the `update-emails` action.
 *
 * The form posts the emails the viewer *wants* — one value per switch left on — and an unchecked
 * switch posts nothing at all, which is why the field is a repeated one with no minimum: turning
 * everything off is a legal choice and arrives as an absent field, not as an error. The action
 * turns that list into the refusals stored on the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import { optionalEmails } from "~/database/schema";

/** Validates the `update-emails` action form body. */
export const UpdateEmailsSchema = f.object({
	emails: f.fields(s.array(s.enum_(optionalEmails))),
});
