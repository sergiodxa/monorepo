/**
 * Form validation for the irreversible half of the account page: the typed confirmation that
 * queues an account for deletion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

/**
 * Validates the `request-account-deletion` form body: a literal typed "DELETE".
 *
 * A typed word rather than a checkbox or a bare confirm button, because deleting an
 * account takes every team the person owns down with it and warrants the same friction.
 */
export const RequestAccountDeletionSchema = f.object({
	confirmation: f.field(s.literal("DELETE")),
});
