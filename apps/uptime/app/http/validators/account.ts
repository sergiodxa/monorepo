/**
 * Form validation for the irreversible half of the account page: the typed confirmation that
 * queues an account for deletion.
 *
 * The matching cancel action has no schema, and deliberately so: the request it calls off is
 * identified by who is signed in, so there is no field to validate, and undoing a destructive
 * request should not be gated behind ceremony of its own.
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
