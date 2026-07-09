/**
 * Form validation schemas for the add/remove/retry-verification team-domain actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/** Validates the `add-domain` action form body. */
export const AddDomainSchema = f.object({
	hostname: f.field(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
});

/** Validates the `remove-domain` action form body. */
export const RemoveDomainSchema = f.object({ domain_id: f.field(s.string()) });

/** Validates the `retry-domain-verification` action form body. */
export const RetryDomainVerificationSchema = f.object({ domain_id: f.field(s.string()) });
