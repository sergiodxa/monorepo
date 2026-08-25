/**
 * Form validation schema for the `update-emails` action.
 *
 * The form posts the emails the viewer wants, one per switch left on. A repeated field
 * with no minimum lets turning everything off arrive as an absent field; the action turns
 * the list into the refusals stored on the row.
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
