/**
 * Form validation schema for the `update-emails` action. The form posts the emails the
 * viewer wants, one per switch left on.
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
